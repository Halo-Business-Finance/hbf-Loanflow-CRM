import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ibmDb } from "@/lib/ibm"
import { useAuth } from "@/components/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Badge component removed - using plain text instead
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useDocuments, LeadDocument } from "@/hooks/useDocuments"
import { DocumentUploadModal } from "@/components/DocumentUploadModal"
import { DocumentViewer } from "@/components/DocumentViewer"
import { formatDistanceToNow } from "date-fns"
import { formatPhoneNumber } from "@/lib/utils"
import { 
  ArrowLeft, 
  Search, 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  CheckCircle, 
  User,
  DollarSign,
  Calendar,
  Eye
} from "lucide-react"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"

export default function LeadDocuments() {
  const { leadId } = useParams<{ leadId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { documents, loading, uploadDocument, updateDocumentStatus, downloadDocument, deleteDocument } = useDocuments()
  
  const [lead, setLead] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedDocument, setSelectedDocument] = useState<LeadDocument | null>(null)
  const [showDocumentViewer, setShowDocumentViewer] = useState(false)

  // Validate leadId from route
  useEffect(() => {
    if (!user) return
    const isValidUuid = (v?: string) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

    if (!isValidUuid(leadId) || leadId === ':leadId') {
      navigate('/leads', { replace: true })
      return
    }

    fetchLeadDetails()
  }, [leadId, user])

  const fetchLeadDetails = async () => {
    // Guard for invalid route param
    const isValidUuid = (v?: string) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
    if (!isValidUuid(leadId)) return

    try {
      const { data, error } = await ibmDb
        .from('leads')
        .select(`
          id,
          contact_entity_id,
          user_id,
          contact_entity:contact_entities!contact_entity_id(
            name,
            email,
            phone,
            business_name,
            loan_amount,
            loan_type,
            stage
          )
        `)
        .eq('id', leadId)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        toast({
          title: "Error",
          description: "Lead not found or you don't have permission to view it",
          variant: "destructive",
        })
        navigate('/leads')
        return
      }

      setLead(data)
    } catch (error) {
      console.error('Error fetching lead details:', error)
      toast({
        title: "Error",
        description: "Failed to fetch lead details",
        variant: "destructive",
      })
      navigate('/leads')
    }
  }

  // Filter documents for this specific lead
  const leadDocuments = documents.filter(doc => doc.lead_id === leadId)

  const filteredDocuments = leadDocuments.filter(doc => {
    const matchesSearch = doc.document_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.document_type.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'verified': return 'default'
      case 'pending': return 'secondary'
      case 'rejected': return 'destructive'
      default: return 'secondary'
    }
  }

  const statusCounts = {
    total: leadDocuments.length,
    verified: leadDocuments.filter(doc => doc.status === 'verified').length,
    pending: leadDocuments.filter(doc => doc.status === 'pending').length,
    rejected: leadDocuments.filter(doc => doc.status === 'rejected').length
  }

  const handleViewDocument = (document: LeadDocument) => {
    setSelectedDocument(document)
    setShowDocumentViewer(true)
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not uploaded'
    return formatDistanceToNow(new Date(dateString), { addSuffix: true })
  }

  const handleUploadForLead = async (
    _leadId: string, 
    contactEntityId: string, 
    file: File, 
    documentType: string, 
    notes?: string
  ) => {
    if (!leadId) return
    return await uploadDocument(leadId, contactEntityId, file, documentType, notes)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <div className="text-lg">Loading documents...</div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <div className="text-lg">Lead not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <IBMPageHeader 
        title={`Document Portal - ${lead.contact_entity?.name || 'Unknown Lead'}`}
        subtitle="Manage financial documents for this lead"
        actions={
          <>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/leads/${leadId}`)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Lead
            </Button>
            <Button onClick={() => setShowUploadModal(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          </>
        }
      />

        {/* Lead Information Card */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Lead Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Contact</div>
                <div className="font-medium">{lead.contact_entity?.name}</div>
                <div className="text-sm text-muted-foreground">{lead.contact_entity?.email}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Business</div>
                <div className="font-medium">{lead.contact_entity?.business_name || 'Not specified'}</div>
                <div className="text-sm text-muted-foreground">
                  {lead.contact_entity?.phone ? formatPhoneNumber(lead.contact_entity.phone) : 'No phone'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Loan Details</div>
                <div className="font-medium">
                  {lead.contact_entity?.loan_amount 
                    ? `$${lead.contact_entity.loan_amount.toLocaleString()}` 
                    : 'Amount not specified'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {lead.contact_entity?.loan_type || 'Type not specified'} • 
                  <span className="ml-1 text-xs font-medium">
                    {lead.contact_entity?.stage || 'No stage'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  className="pl-10 border-[#0A1628]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-md bg-background"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Document Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.total}</div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statusCounts.verified}</div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statusCounts.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Documents List */}
        <div className="grid gap-6">
          {filteredDocuments.length === 0 ? (
            <Card className="shadow-soft">
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No documents found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== "all" 
                    ? "Try adjusting your search or filters" 
                    : "Upload the first document for this lead"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <Button onClick={() => setShowUploadModal(true)} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload First Document
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredDocuments.map((document) => (
              <Card key={document.id} className="shadow-soft hover:shadow-medium transition-shadow">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header Row */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-foreground">{document.document_name}</h3>
                          <span className="text-xs font-medium">
                            {document.document_type}
                          </span>
                        </div>
                        <p className="text-muted-foreground">Document ID: {document.id.slice(0, 8)}</p>
                      </div>
                      
                      <div className="text-right space-y-1">
                        <span className="text-sm font-medium">
                          {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                        </span>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(document.uploaded_at)}
                        </div>
                      </div>
                    </div>

                    {/* File Information */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        <div className="flex-1">
                          <div className="font-medium">{document.document_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatFileSize(document.file_size)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Upload Date</div>
                          <div className="font-medium">{formatDate(document.uploaded_at)}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Status</div>
                          <div className="font-medium capitalize">{document.status}</div>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {document.notes && (
                      <div className="pt-4 border-t">
                        <div className="text-sm text-muted-foreground mb-1">Notes:</div>
                        <div className="text-sm">{document.notes}</div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t">
                      {document.file_path && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 gap-2"
                            onClick={() => handleViewDocument(document)}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 gap-2"
                            onClick={() => downloadDocument(document)}
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </>
                      )}
                      
                      {document.status === 'pending' && (
                        <Button 
                          size="sm" 
                          className="flex-1 gap-2"
                          onClick={() => updateDocumentStatus(document.id, 'verified')}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Verify
                        </Button>
                      )}

                      {document.status === 'pending' && (
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          className="flex-1 gap-2"
                          onClick={() => updateDocumentStatus(document.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      )}

                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => deleteDocument(document.id, document.file_path)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Upload Modal */}
        <DocumentUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUploadForLead}
          preSelectedLeadId={leadId}
        />

        <DocumentViewer
          document={selectedDocument}
          isOpen={showDocumentViewer}
          onClose={() => {
            setShowDocumentViewer(false)
            setSelectedDocument(null)
          }}
        />
    </div>
  )
}