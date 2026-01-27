import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { FileText, Download, Upload, Folder, MoreHorizontal, Link, Share, CheckSquare, ChevronRight, ChevronDown, Trash2 } from "lucide-react"
import { useDocuments } from "@/hooks/useDocuments"
import { format } from "date-fns"
import { DocumentUploadModal } from "@/components/DocumentUploadModal"
import { DocumentViewer } from "@/components/DocumentViewer"

interface BorrowerDocumentsWidgetProps {
  leadId: string
  contactEntityId: string
}

export function BorrowerDocumentsWidget({ leadId, contactEntityId }: BorrowerDocumentsWidgetProps) {
  const { documents, loading, downloadDocument, uploadDocument, deleteDocument } = useDocuments()
  const [leadDocuments, setLeadDocuments] = useState<any[]>([])
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [viewingDocument, setViewingDocument] = useState<any | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (documents) {
      const filtered = documents.filter(doc => doc.lead_id === leadId)
      setLeadDocuments(filtered)
    }
  }, [documents, leadId])

  const handleUpload = async (
    uploadLeadId: string,
    uploadContactEntityId: string,
    file: File,
    documentType: string,
    notes?: string,
    customDocumentName?: string
  ) => {
    await uploadDocument(uploadLeadId, uploadContactEntityId, file, documentType, notes, customDocumentName)
    setIsUploadModalOpen(false)
  }

  const handleDeleteDocument = async (documentId: string, filePath: string) => {
    try {
      await deleteDocument(documentId, filePath)
      toast({
        title: "Success",
        description: "Document deleted successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      })
    }
  }

  const handleBulkDelete = async () => {
    try {
      const docsToDelete = leadDocuments.filter(doc => selectedDocuments.has(doc.id))
      await Promise.all(
        docsToDelete.map(doc => deleteDocument(doc.id, doc.file_path))
      )
      setSelectedDocuments(new Set())
      toast({
        title: "Success",
        description: `${docsToDelete.length} document(s) deleted successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete documents",
        variant: "destructive",
      })
    }
  }

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(documentId)) {
        newSet.delete(documentId)
      } else {
        newSet.add(documentId)
      }
      return newSet
    })
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown"
    const mb = bytes / (1024 * 1024)
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  const folders = [
    { id: 'business-tax', name: 'Business Tax Returns', icon: Folder, documentType: 'Business Tax Returns' },
    { id: 'personal-tax', name: 'Personal Tax Returns', icon: Folder, documentType: 'Personal Tax Returns' },
    { id: 'financial-statements', name: 'P&L and Balance Sheet', icon: Folder, documentType: 'P&L and Balance Sheet' },
    { id: 'bank-statements', name: 'Bank Statements', icon: Folder, documentType: 'Bank Statements' },
    { id: 'debt-schedule', name: 'Debt Schedule and Notes', icon: Folder, documentType: 'Debt Schedule and Notes' },
    { id: 'loan-application', name: 'Loan Application & Driver\'s License', icon: Folder, documentType: 'Loan Application & Driver\'s License' },
    { id: 'ar-ap', name: 'AR & AP', icon: Folder, documentType: 'AR & AP' },
    { id: 'projections', name: 'Projections, Resume & Business Plan', icon: Folder, documentType: 'Projections, Resume & Business Plan' },
    { id: 'sba-bank', name: 'SBA & Bank Documents', icon: Folder, documentType: 'SBA & Bank Documents' },
    { id: 'corp-docs', name: 'Corp Articles, Operating Agreement & EIN Form', icon: Folder, documentType: 'Corp Articles, Operating Agreement & EIN Form' },
    { id: 'miscellaneous', name: 'Miscellaneous', icon: Folder, documentType: 'Miscellaneous' }
  ]

  const getDocumentsForFolder = (documentType: string) => {
    return leadDocuments.filter(doc => doc.document_type === documentType)
  }

  return (
    <Card className="border-0 shadow-sm bg-card">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium text-foreground">Loan Documents</span>
            {selectedDocuments.size > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedDocuments.size} selected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedDocuments.size > 0 && (
              <Button
                onClick={handleBulkDelete}
                size="sm"
                variant="destructive"
                className="h-8 px-3 gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({selectedDocuments.size})
              </Button>
            )}
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              size="sm"
              className="h-8 px-3 gap-2"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Loading documents...
          </div>
        ) : (
          <div className="w-full">
            {leadDocuments.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center italic">
                No documents uploaded yet
              </div>
            )}
            {/* Folders */}
            <div className="divide-y">
              {folders.map((folder) => {
                const folderDocs = getDocumentsForFolder(folder.documentType)
                return (
                  <div key={folder.id}>
                    {/* Folder Header */}
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                      <button
                        onClick={() => toggleFolder(folder.id)}
                        className="cursor-pointer hover:opacity-70 transition-opacity"
                      >
                        {expandedFolders.has(folder.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <Folder className="h-5 w-5 text-yellow-500" />
                      <span className="text-sm font-medium">{folder.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {folderDocs.length}
                      </Badge>
                    </div>

                    {/* Folder Contents */}
                    {expandedFolders.has(folder.id) && (
                      <div className="bg-muted/20">
                        {folderDocs.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-muted-foreground italic">
                            No documents in this folder yet
                          </div>
                        ) : (
                          <div className="divide-y">
                            {folderDocs.map((doc) => (
                              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                                <Checkbox
                                  checked={selectedDocuments.has(doc.id)}
                                  onCheckedChange={() => toggleDocumentSelection(doc.id)}
                                />
                                <div 
                                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                  onClick={() => setViewingDocument(doc)}
                                >
                                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{doc.document_name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {format(new Date(doc.updated_at), 'MMM d, yyyy')} • {formatFileSize(doc.file_size)}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => downloadDocument(doc)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteDocument(doc.id, doc.file_path)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>

      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
        preSelectedLeadId={leadId}
      />

      <DocumentViewer
        document={viewingDocument}
        isOpen={!!viewingDocument}
        onClose={() => setViewingDocument(null)}
      />
    </Card>
  )
}
