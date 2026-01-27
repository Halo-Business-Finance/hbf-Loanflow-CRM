import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/components/auth/AuthProvider"
// import HybridLayout from "@/components/HybridLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
// Badge component removed - using plain text instead
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { ActionReminder } from "@/components/ActionReminder"
import { PhoneDialer } from "@/components/PhoneDialer"
import { EmailComposer } from "@/components/EmailComposer"
import { LoanManager } from "@/components/LoanManager"
import LoanRequestManager from "@/components/LoanRequestManager"
import { ClientScheduler } from "@/components/calendar/ClientScheduler"
import { formatPhoneNumber } from "@/lib/utils"
import { formatNumber, formatCurrency } from "@/lib/utils"
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  DollarSign, 
  Building, 
  CreditCard, 
  Save,
  Edit,
  CheckCircle,
  XCircle,
  Bell,
  Calendar,
  Home,
  ShoppingCart,
  Target,
  FileText,
  UserCheck
} from "lucide-react"

interface Client {
  id: string
  contact_entity_id: string
  name: string
  email: string
  phone?: string
  location?: string
  status: string
  total_loans: number
  total_loan_value: number
  join_date: string
  last_activity: string
  business_name?: string
  business_address?: string
  naics_code?: string
  ownership_structure?: string
  owns_property?: boolean
  property_payment_amount?: number
  year_established?: number
  credit_score?: number
  net_operating_income?: number
  bank_lender_name?: string
  annual_revenue?: number
  existing_loan_amount?: number
  notes?: string
  call_notes?: string
  priority?: string
  income?: number
  pos_system?: string
  monthly_processing_volume?: number
  average_transaction_size?: number
  processor_name?: string
  current_processing_rate?: number
  bdo_name?: string
  bdo_telephone?: string
  bdo_email?: string
  // Additional fields from leads
  maturity_date?: string
  interest_rate?: number
  stage?: string
  loan_amount?: number
  loan_type?: string
}

interface Loan {
  id: string
  loan_amount: number
  interest_rate?: number
  loan_term_months?: number
  maturity_date?: string
  loan_type: string
  status: string
  origination_date: string
  monthly_payment?: number
  remaining_balance?: number
  notes?: string
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [client, setClient] = useState<Client | null>(null)
  const [loans, setLoans] = useState<Loan[]>([])
  const [loanRequests, setLoanRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [callNotes, setCallNotes] = useState("")
  const [newCallNote, setNewCallNote] = useState("")
  const [generalNotes, setGeneralNotes] = useState("")
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [userProfile, setUserProfile] = useState<{first_name?: string, last_name?: string} | null>(null)
  const [notesHistory, setNotesHistory] = useState<Array<{
    id: string
    note_type: 'general' | 'call'
    content: string
    created_at: string
    user_name: string
  }>>([])
  const [editableFields, setEditableFields] = useState({
    name: "",
    email: "",
    phone: "",
    
    business_name: "",
    business_address: "",
    business_city: "",
    business_state: "",
    business_zip_code: "",
    naics_code: "",
    ownership_structure: "",
    owns_property: false,
    property_payment_amount: "",
    year_established: "",
    status: "",
    priority: "",
    credit_score: "",
    net_operating_income: "",
    bank_lender_name: "",
    annual_revenue: "",
    existing_loan_amount: "",
    income: "",
    pos_system: "",
    monthly_processing_volume: "",
    average_transaction_size: "",
    processor_name: "",
    current_processing_rate: "",
    bdo_name: "",
    bdo_telephone: "",
    bdo_email: "",
    // Additional fields from leads
    maturity_date: "",
    interest_rate: "",
    stage: "",
    loan_amount: "",
    loan_type: ""
  })

  useEffect(() => {
    if (id && user) {
      fetchClient()
      fetchClientLoans()
      fetchLoanRequests()
      fetchUserProfile()
    }
  }, [id, user])

  useEffect(() => {
    if (client?.contact_entity_id) {
      fetchNotesHistory()
    }
  }, [client?.contact_entity_id])

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const fetchClient = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          contact_entity:contact_entities!contact_entity_id (*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      
      // Merge contact entity data with client data
      const mergedClient = {
        ...data,
        ...data.contact_entity
      }
      setClient(mergedClient)
      setCallNotes(mergedClient.call_notes || "")
      setGeneralNotes(mergedClient.notes || "")
      
      // Set editable fields for edit mode
      setEditableFields({
        name: mergedClient.name || "",
        email: mergedClient.email || "",
        phone: mergedClient.phone || "",
        
        business_name: mergedClient.business_name || "",
        business_address: mergedClient.business_address || "",
        business_city: mergedClient.business_city || "",
        business_state: mergedClient.business_state || "",
        business_zip_code: mergedClient.business_zip_code || "",
        naics_code: mergedClient.naics_code || "",
        ownership_structure: mergedClient.ownership_structure || "",
        owns_property: mergedClient.owns_property || false,
        property_payment_amount: mergedClient.property_payment_amount?.toString() || "",
        year_established: mergedClient.year_established?.toString() || "",
        status: data.status || "",
        priority: mergedClient.priority || "",
        credit_score: mergedClient.credit_score?.toString() || "",
        net_operating_income: mergedClient.net_operating_income?.toString() || "",
        bank_lender_name: mergedClient.bank_lender_name || "",
        annual_revenue: mergedClient.annual_revenue?.toString() || "",
        existing_loan_amount: mergedClient.existing_loan_amount?.toString() || "",
        income: mergedClient.income?.toString() || "",
        pos_system: mergedClient.pos_system || "",
        monthly_processing_volume: mergedClient.monthly_processing_volume?.toString() || "",
        average_transaction_size: mergedClient.average_transaction_size?.toString() || "",
        processor_name: mergedClient.processor_name || "",
        current_processing_rate: mergedClient.current_processing_rate?.toString() || "",
        bdo_name: mergedClient.bdo_name || "",
        bdo_telephone: mergedClient.bdo_telephone || "",
        bdo_email: mergedClient.bdo_email || "",
        // Additional fields from leads
        maturity_date: mergedClient.maturity_date || "",
        interest_rate: mergedClient.interest_rate?.toString() || "",
        stage: mergedClient.stage || "",
        loan_amount: mergedClient.loan_amount?.toString() || "",
        loan_type: mergedClient.loan_type || ""
      })
    } catch (error) {
      console.error('Error fetching client:', error)
      toast({
        title: "Error",
        description: "Failed to fetch client details",
        variant: "destructive",
      })
      navigate('/clients')
    } finally {
      setLoading(false)
    }
  }

  const fetchLoanRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('loan_requests')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setLoanRequests(data || [])
    } catch (error) {
      console.error('Error fetching loan requests:', error)
    }
  }

  const fetchClientLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setLoans(data || [])
    } catch (error) {
      console.error('Error fetching loans:', error)
    }
  }

  const saveCallNotes = async () => {
    if (!client || !user) return

    try {
      const trimmed = newCallNote.trim()
      // If empty, just return silently - user doesn't want to add a note
      if (!trimmed) return
      
      if (!client.contact_entity_id) {
        throw new Error('No contact entity ID found for client')
      }
      
      // Insert into history
      const { error: historyError } = await supabase
        .from('notes_history')
        .insert({
          contact_id: client.contact_entity_id,
          note_type: 'call',
          content: trimmed,
          user_id: user.id
        })
      
      if (historyError) {
        console.error('Error saving note history:', historyError)
        toast({ title: 'Error', description: 'Failed to save note', variant: 'destructive' })
        return
      }
      
      // Update client's last_activity
      await supabase
        .from('clients')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', client.id)
      
      setNewCallNote('')
      fetchNotesHistory()
      toast({ title: 'Saved', description: 'Call note added to history' })
      fetchClient()
    } catch (error) {
      console.error('Error saving call notes:', error)
      toast({
        title: "Error",
        description: `Failed to save call notes: ${error.message}`,
        variant: "destructive",
      })
    }
  }

  const saveGeneralNotes = async () => {
    if (!client || !user) return

    try {
      const trimmed = generalNotes.trim()
      
      // Update the contact_entities notes field
      const { error } = await supabase
        .from('contact_entities')
        .update({ notes: trimmed })
        .eq('id', client.contact_entity_id)
      
      if (error) {
        console.error('Error saving notes:', error)
        toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' })
        return
      }
      
      toast({ title: 'Saved', description: 'Notes saved successfully' })
      fetchClient()
    } catch (error) {
      console.error('Error saving general notes:', error)
      toast({
        title: "Error",
        description: "Failed to save general notes",
        variant: "destructive",
      })
    }
  }

  // Fetch notes history
  const fetchNotesHistory = async () => {
    if (!client?.contact_entity_id) return
    const { data, error } = await supabase
      .from('notes_history')
      .select(`
        id,
        note_type,
        content,
        created_at,
        user_id
      `)
      .eq('contact_id', client.contact_entity_id)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching notes history:', error)
      return
    }

    // Fetch user names
    const userIds = [...new Set(data.map(n => n.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds)
    
    const profileMap = new Map(profiles?.map(p => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]) || [])
    
    setNotesHistory(data.map(note => ({
      id: note.id,
      note_type: note.note_type as 'general' | 'call',
      content: note.content,
      created_at: note.created_at,
      user_name: profileMap.get(note.user_id) || 'Unknown User'
    })))
  }

  const saveClientChanges = async () => {
    if (!client) return

    try {
      const updateData: any = {
        name: editableFields.name,
        email: editableFields.email,
        phone: editableFields.phone || null,
        
        business_name: editableFields.business_name || null,
        business_address: editableFields.business_address || null,
        business_city: editableFields.business_city || null,
        business_state: editableFields.business_state || null,
        business_zip_code: editableFields.business_zip_code || null,
        naics_code: editableFields.naics_code || null,
        ownership_structure: editableFields.ownership_structure || null,
        owns_property: editableFields.owns_property,
        property_payment_amount: editableFields.property_payment_amount ? parseFloat(editableFields.property_payment_amount) : null,
        year_established: editableFields.year_established ? parseInt(editableFields.year_established) : null,
        status: editableFields.status,
        priority: editableFields.priority,
        credit_score: editableFields.credit_score ? parseInt(editableFields.credit_score) : null,
        net_operating_income: editableFields.net_operating_income ? parseFloat(editableFields.net_operating_income) : null,
        bank_lender_name: editableFields.bank_lender_name || null,
        annual_revenue: editableFields.annual_revenue ? parseFloat(editableFields.annual_revenue) : null,
        existing_loan_amount: editableFields.existing_loan_amount ? parseFloat(editableFields.existing_loan_amount) : null,
        income: editableFields.income ? parseFloat(editableFields.income) : null,
        pos_system: editableFields.pos_system || null,
        monthly_processing_volume: editableFields.monthly_processing_volume ? parseFloat(editableFields.monthly_processing_volume) : null,
        average_transaction_size: editableFields.average_transaction_size ? parseFloat(editableFields.average_transaction_size) : null,
        processor_name: editableFields.processor_name || null,
        current_processing_rate: editableFields.current_processing_rate ? parseFloat(editableFields.current_processing_rate) : null,
        bdo_name: editableFields.bdo_name || null,
        bdo_telephone: editableFields.bdo_telephone || null,
        bdo_email: editableFields.bdo_email || null,
        // Additional fields from leads
        maturity_date: editableFields.maturity_date || null,
        interest_rate: editableFields.interest_rate ? parseFloat(editableFields.interest_rate) : null,
        stage: editableFields.stage || null,
        loan_amount: editableFields.loan_amount ? parseFloat(editableFields.loan_amount) : null,
        loan_type: editableFields.loan_type || null,
        updated_at: new Date().toISOString()
      }

      // Update contact_entities table (where core data lives)
      const { error: contactError } = await supabase
        .from('contact_entities')
        .update({
          name: updateData.name,
          email: updateData.email,
          phone: updateData.phone,
          business_name: updateData.business_name,
          business_address: updateData.business_address,
          business_city: updateData.business_city,
          business_state: updateData.business_state,
          business_zip_code: updateData.business_zip_code,
          naics_code: updateData.naics_code,
          ownership_structure: updateData.ownership_structure,
          owns_property: updateData.owns_property,
          property_payment_amount: updateData.property_payment_amount,
          year_established: updateData.year_established,
          priority: updateData.priority,
          credit_score: updateData.credit_score,
          net_operating_income: updateData.net_operating_income,
          bank_lender_name: updateData.bank_lender_name,
          annual_revenue: updateData.annual_revenue,
          existing_loan_amount: updateData.existing_loan_amount,
          income: updateData.income,
          pos_system: updateData.pos_system,
          monthly_processing_volume: updateData.monthly_processing_volume,
          average_transaction_size: updateData.average_transaction_size,
          processor_name: updateData.processor_name,
          current_processing_rate: updateData.current_processing_rate,
          bdo_name: updateData.bdo_name,
          bdo_telephone: updateData.bdo_telephone,
          bdo_email: updateData.bdo_email,
          maturity_date: updateData.maturity_date,
          interest_rate: updateData.interest_rate,
          stage: updateData.stage,
          loan_amount: updateData.loan_amount,
          loan_type: updateData.loan_type,
          updated_at: updateData.updated_at
        })
        .eq('id', client.contact_entity_id)

      if (contactError) throw contactError

      // Also update client-specific fields in clients table
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          status: updateData.status,
          updated_at: updateData.updated_at
        })
        .eq('id', client.id)

      if (clientError) throw clientError

      setIsEditing(false)
      toast({
        title: "Success",
        description: "Client information updated successfully",
      })
      
      // Refresh client data
      fetchClient()
      fetchLoanRequests()
    } catch (error) {
      console.error('Error updating client:', error)
      toast({
        title: "Error",
        description: "Failed to update client information",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'default'
      case 'pending': return 'secondary'
      case 'inactive': return 'destructive'
      default: return 'secondary'
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'New Lead': return 'outline'
      case 'Initial Contact': return 'secondary'
      case 'Loan Application Signed': return 'default'
      case 'Waiting for Documentation': return 'secondary'
      case 'Pre-Approved': return 'default'
      case 'Term Sheet Signed': return 'secondary'
      case 'Loan Approved': return 'outline'
      case 'Closing': return 'default'
      case 'Loan Funded': return 'default'
      case 'Archive': return 'secondary'
      default: return 'secondary'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'secondary'
    }
  }

  const handleLoansUpdate = () => {
    fetchClientLoans()
    fetchClient() // Refresh client totals
    fetchLoanRequests()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12 p-6">
        <h2 className="text-2xl font-bold">Client not found</h2>
        <Button onClick={() => navigate('/clients')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clients
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="modern" 
              className="h-10 px-4 rounded-lg font-medium"
              onClick={() => navigate('/clients')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Clients
            </Button>
             <div className="bg-gradient-to-r from-card to-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border/50 shadow-medium">
               <div className="flex items-center gap-3 mb-3">
                 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg">
                   <UserCheck className="w-6 h-6 text-accent-foreground" />
                 </div>
                 <div>
                   <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">{client.name}</h1>
                   <p className="text-sm text-muted-foreground">Client since {new Date(client.join_date).toLocaleDateString()}</p>
                 </div>
               </div>
               <div className="flex items-center gap-3 flex-wrap">
                <span className="px-3 py-1 rounded-full font-medium shadow-sm text-sm">
                  {client.status}
                </span>
                  {client.priority && (
                    <span className="px-3 py-1 rounded-full font-medium shadow-sm text-sm">
                      {client.priority} Priority
                    </span>
                  )}
                  {client.stage && (
                    <span className="px-3 py-1 rounded-full font-medium shadow-sm text-sm">
                      {client.stage}
                    </span>
                  )}
               </div>
             </div>
           </div>
          
          <div className="flex flex-col gap-3">
            {/* First Row - Communication Buttons */}
            <div className="flex gap-3 flex-wrap">
              <PhoneDialer 
                phoneNumber={client?.phone}
                trigger={
                  <Button 
                    variant="gradient-blue"
                    className="h-10 px-4 rounded-lg font-medium shadow-md"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                }
              />
              <EmailComposer 
                trigger={
                  <Button 
                    variant="gradient-green"
                    className="h-10 px-4 rounded-lg font-medium shadow-md"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                }
              />
              <Button 
                variant="gradient"
                className="h-10 px-4 rounded-lg font-medium shadow-md"
                onClick={() => setShowReminderDialog(true)}
              >
                <Bell className="w-4 h-4 mr-2" />
                Set Reminder
              </Button>
            </div>
            
            {/* Second Row - Edit/Save Button */}
            <div className="flex gap-3 flex-wrap">
              <Button
                variant={isEditing ? "gradient" : "modern"}
                className="h-10 px-4 rounded-lg font-medium shadow-md"
                onClick={() => {
                  if (isEditing) {
                    saveClientChanges()
                  } else {
                    setIsEditing(true)
                  }
                }}
              >
                {isEditing ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Client
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Client Overview */}
          <Card>
            <CardHeader>
              <CardTitle>
                Client Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Loans</div>
                  <div className="text-2xl font-bold">{formatNumber(client.total_loans)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Total Loan Value</div>
                  <div className="text-2xl font-bold text-accent">{formatCurrency(client.total_loan_value)}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Last Activity</div>
                  <div className="text-lg font-semibold">{new Date(client.last_activity).toLocaleDateString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle>
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      {isEditing ? (
                        <Input
                          value={editableFields.name}
                          onChange={(e) => setEditableFields({...editableFields, name: e.target.value})}
                          placeholder="Enter full name"
                        />
                      ) : (
                        <p className="font-medium">{client.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Email</p>
                      {isEditing ? (
                        <Input
                          type="email"
                          value={editableFields.email}
                          onChange={(e) => setEditableFields({...editableFields, email: e.target.value})}
                          placeholder="Enter email address"
                        />
                      ) : (
                        <p className="font-medium">{client.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Phone</p>
                      {isEditing ? (
                        <Input
                          value={editableFields.phone}
                          onChange={(e) => setEditableFields({...editableFields, phone: e.target.value})}
                          placeholder="Enter phone number"
                        />
                      ) : (
                        <p className="font-medium">{client.phone ? formatPhoneNumber(client.phone) : 'N/A'}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Status</p>
                      {isEditing ? (
                        <Select value={editableFields.status} onValueChange={(value) => setEditableFields({...editableFields, status: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm font-medium">{client.status}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Priority</p>
                      {isEditing ? (
                        <Select value={editableFields.priority} onValueChange={(value) => setEditableFields({...editableFields, priority: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium">{client.priority || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle>
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Business Name</p>
                      {isEditing ? (
                        <Input
                          value={editableFields.business_name}
                          onChange={(e) => setEditableFields({...editableFields, business_name: e.target.value})}
                          placeholder="Enter business name"
                        />
                      ) : (
                        <p className="font-medium">{client.business_name || 'N/A'}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Home className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Company Address</p>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editableFields.business_address}
                            onChange={(e) => setEditableFields({...editableFields, business_address: e.target.value})}
                            placeholder="Enter street address"
                            rows={2}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              value={editableFields.business_city}
                              onChange={(e) => setEditableFields({...editableFields, business_city: e.target.value})}
                              placeholder="City"
                            />
                            <Input
                              value={editableFields.business_state}
                              onChange={(e) => setEditableFields({...editableFields, business_state: e.target.value})}
                              placeholder="State"
                            />
                          </div>
                          <Input
                            value={editableFields.business_zip_code}
                            onChange={(e) => setEditableFields({...editableFields, business_zip_code: e.target.value})}
                            placeholder="ZIP Code"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {(client as any).business_address && <p className="font-medium">{(client as any).business_address}</p>}
                          {((client as any).business_city || (client as any).business_state || (client as any).business_zip_code) && (
                            <p className="font-medium">
                              {[(client as any).business_city, (client as any).business_state, (client as any).business_zip_code].filter(Boolean).join(', ')}
                            </p>
                          )}
                          {!(client as any).business_address && !(client as any).business_city && !(client as any).business_state && !(client as any).business_zip_code && (
                            <p className="font-medium">N/A</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Year Established</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editableFields.year_established}
                          onChange={(e) => setEditableFields({...editableFields, year_established: e.target.value})}
                          placeholder="Enter year established"
                        />
                      ) : (
                        <p className="font-medium">{client.year_established || 'N/A'}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">NAICS Code</p>
                      {isEditing ? (
                        <Input
                          value={editableFields.naics_code}
                          onChange={(e) => setEditableFields({...editableFields, naics_code: e.target.value})}
                          placeholder="Enter NAICS code (e.g., 541110)"
                          maxLength={6}
                        />
                      ) : (
                        <p className="font-medium">{client.naics_code || 'N/A'}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Building className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Ownership Structure</p>
                      {isEditing ? (
                        <Select value={editableFields.ownership_structure} onValueChange={(value) => setEditableFields({...editableFields, ownership_structure: value})}>
                          <SelectTrigger className="bg-background border-border z-50">
                            <SelectValue placeholder="Select ownership structure" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border-border shadow-lg z-50">
                            <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                            <SelectItem value="partnership">Partnership</SelectItem>
                            <SelectItem value="llc">Limited Liability Company (LLC)</SelectItem>
                            <SelectItem value="corporation">Corporation (C-Corp)</SelectItem>
                            <SelectItem value="s_corporation">S Corporation (S-Corp)</SelectItem>
                            <SelectItem value="limited_partnership">Limited Partnership (LP)</SelectItem>
                            <SelectItem value="llp">Limited Liability Partnership (LLP)</SelectItem>
                            <SelectItem value="professional_corporation">Professional Corporation (PC)</SelectItem>
                            <SelectItem value="nonprofit">Nonprofit Corporation</SelectItem>
                            <SelectItem value="cooperative">Cooperative</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium">
                          {client.ownership_structure ? 
                            {
                              'sole_proprietorship': 'Sole Proprietorship',
                              'partnership': 'Partnership',
                              'llc': 'Limited Liability Company (LLC)',
                              'corporation': 'Corporation (C-Corp)',
                              's_corporation': 'S Corporation (S-Corp)',
                              'limited_partnership': 'Limited Partnership (LP)',
                              'llp': 'Limited Liability Partnership (LLP)',
                              'professional_corporation': 'Professional Corporation (PC)',
                              'nonprofit': 'Nonprofit Corporation',
                              'cooperative': 'Cooperative'
                            }[client.ownership_structure] || client.ownership_structure
                            : 'N/A'
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Annual Revenue</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editableFields.annual_revenue}
                          onChange={(e) => setEditableFields({...editableFields, annual_revenue: e.target.value})}
                          placeholder="Enter annual revenue"
                        />
                      ) : (
                        <p className="font-medium">{formatCurrency(client.annual_revenue)}</p>
                      )}
                    </div>
                  </div>


                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Property Ownership</p>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editableFields.owns_property}
                            onCheckedChange={(checked) => setEditableFields({...editableFields, owns_property: checked})}
                          />
                          <span className="text-sm">
                            {editableFields.owns_property ? 'Owns Property' : 'Does not own property'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {client.owns_property ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <p className="font-medium">
                            {client.owns_property ? 'Owns Property' : 'Does not own property'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Information */}
          <Card>
            <CardHeader>
              <CardTitle>
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Net Operating Income</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editableFields.net_operating_income}
                          onChange={(e) => setEditableFields({...editableFields, net_operating_income: e.target.value})}
                          placeholder="Enter net operating income"
                        />
                      ) : (
                        <p className="font-medium">{formatCurrency(client.net_operating_income)}</p>
                      )}
                    </div>
                  </div>


                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Existing Loan Amount</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editableFields.existing_loan_amount}
                          onChange={(e) => setEditableFields({...editableFields, existing_loan_amount: e.target.value})}
                          placeholder="Enter existing loan amount"
                        />
                      ) : (
                        <p className="font-medium">{formatCurrency(client.existing_loan_amount)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Target className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Interest Rate (%)</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editableFields.interest_rate}
                          onChange={(e) => setEditableFields({...editableFields, interest_rate: e.target.value})}
                          placeholder="Enter interest rate"
                        />
                      ) : (
                        <p className="font-medium">{client.interest_rate ? `${client.interest_rate}%` : 'N/A'}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Maturity Date</p>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editableFields.maturity_date}
                          onChange={(e) => setEditableFields({...editableFields, maturity_date: e.target.value})}
                        />
                      ) : (
                        <p className="font-medium">{client.maturity_date ? new Date(client.maturity_date).toLocaleDateString() : 'N/A'}</p>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Information */}
          {(client.owns_property || client.property_payment_amount || isEditing) && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Property Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Property Payment Amount</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editableFields.property_payment_amount}
                          onChange={(e) => setEditableFields({...editableFields, property_payment_amount: e.target.value})}
                          placeholder="Enter monthly/yearly payment amount"
                        />
                      ) : (
                        <p className="font-medium">{formatCurrency(client.property_payment_amount)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}


          {/* Loan Information */}
          <Card>
            <CardHeader>
              <CardTitle>
                Loan Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Loan Amount</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editableFields.loan_amount}
                          onChange={(e) => setEditableFields({...editableFields, loan_amount: e.target.value})}
                          placeholder="Enter loan amount"
                        />
                      ) : (
                        <p className="font-medium text-lg">{formatCurrency(client.loan_amount)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Loan Type</p>
                      {isEditing ? (
                        <Select value={editableFields.loan_type} onValueChange={(value) => setEditableFields({...editableFields, loan_type: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select loan type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SBA">SBA Loan</SelectItem>
                            <SelectItem value="Term">Term Loan</SelectItem>
                            <SelectItem value="Line of Credit">Line of Credit</SelectItem>
                            <SelectItem value="Equipment">Equipment Loan</SelectItem>
                            <SelectItem value="Real Estate">Real Estate Loan</SelectItem>
                            <SelectItem value="Working Capital">Working Capital</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium">{client.loan_type || 'N/A'}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Interest Rate</p>
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editableFields.interest_rate}
                          onChange={(e) => setEditableFields({...editableFields, interest_rate: e.target.value})}
                          placeholder="Enter interest rate (%)"
                        />
                      ) : (
                        <p className="font-medium">
                          {client.interest_rate ? `${client.interest_rate}%` : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Maturity Date</p>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editableFields.maturity_date}
                          onChange={(e) => setEditableFields({...editableFields, maturity_date: e.target.value})}
                        />
                      ) : (
                        <p className="font-medium">
                          {client.maturity_date ? new Date(client.maturity_date).toLocaleDateString() : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Bank/Lender Name</p>
                      {isEditing ? (
                        <Input
                          value={editableFields.bank_lender_name}
                          onChange={(e) => setEditableFields({...editableFields, bank_lender_name: e.target.value})}
                          placeholder="Enter bank or lender name"
                        />
                      ) : (
                        <p className="font-medium">{client.bank_lender_name || 'N/A'}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Loan Stage</p>
                      {isEditing ? (
                        <Select value={editableFields.stage} onValueChange={(value) => setEditableFields({...editableFields, stage: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="New Lead">New Lead</SelectItem>
                             <SelectItem value="Initial Contact">Initial Contact</SelectItem>
                             <SelectItem value="Loan Application Signed">Loan Application Signed</SelectItem>
                             <SelectItem value="Waiting for Documentation">Waiting for Documentation</SelectItem>
                             <SelectItem value="Pre-Approved">Pre-Approved</SelectItem>
                             <SelectItem value="Term Sheet Signed">Term Sheet Signed</SelectItem>
                             <SelectItem value="Loan Approved">Loan Approved</SelectItem>
                             <SelectItem value="Closing">Closing</SelectItem>
                             <SelectItem value="Loan Funded">Loan Funded</SelectItem>
                           </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium">{client.stage || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* BDO Information Section */}
              <div className="col-span-full mt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  BDO Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-200/10">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">BDO Name</p>
                      {isEditing ? (
                        <Input
                          value={editableFields.bdo_name}
                          onChange={(e) => setEditableFields({...editableFields, bdo_name: e.target.value})}
                          placeholder="Enter BDO name"
                        />
                      ) : (
                        <p className="font-medium">
                          {client.bdo_name || 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">BDO Telephone</p>
                      {isEditing ? (
                        <Input
                          value={editableFields.bdo_telephone}
                          onChange={(e) => setEditableFields({...editableFields, bdo_telephone: e.target.value})}
                          placeholder="Enter BDO telephone"
                        />
                      ) : (
                        <p className="font-medium">
                          {client.bdo_telephone || 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">BDO Email</p>
                      {isEditing ? (
                        <Input
                          type="email"
                          value={editableFields.bdo_email}
                          onChange={(e) => setEditableFields({...editableFields, bdo_email: e.target.value})}
                          placeholder="Enter BDO email"
                        />
                      ) : (
                        <p className="font-medium">
                          {client.bdo_email || 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loan Requests Section */}
          <Card>
            <CardHeader>
              <CardTitle>
                Loan Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LoanRequestManager
                clientId={client.id}
                loanRequests={loanRequests}
                onLoanRequestsUpdate={setLoanRequests}
              />
            </CardContent>
          </Card>
          {(client.pos_system || client.monthly_processing_volume || client.average_transaction_size || client.processor_name || client.current_processing_rate || isEditing) && (
            <Card>
              <CardHeader>
                <CardTitle>
                  POS Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="w-4 h-4" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">POS System</p>
                        {isEditing ? (
                          <Input
                            value={editableFields.pos_system}
                            onChange={(e) => setEditableFields({...editableFields, pos_system: e.target.value})}
                            placeholder="Enter POS system"
                          />
                        ) : (
                          <p className="font-medium">{client.pos_system || 'N/A'}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Monthly Processing Volume</p>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editableFields.monthly_processing_volume}
                            onChange={(e) => setEditableFields({...editableFields, monthly_processing_volume: e.target.value})}
                            placeholder="Enter monthly volume"
                          />
                        ) : (
                          <p className="font-medium">{formatCurrency(client.monthly_processing_volume)}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Average Transaction Size</p>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editableFields.average_transaction_size}
                            onChange={(e) => setEditableFields({...editableFields, average_transaction_size: e.target.value})}
                            placeholder="Enter average transaction size"
                          />
                        ) : (
                          <p className="font-medium">{formatCurrency(client.average_transaction_size)}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Building className="w-4 h-4" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Current Processor</p>
                        {isEditing ? (
                          <Input
                            value={editableFields.processor_name}
                            onChange={(e) => setEditableFields({...editableFields, processor_name: e.target.value})}
                            placeholder="Enter processor name"
                          />
                        ) : (
                          <p className="font-medium">{client.processor_name || 'N/A'}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4" />
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Current Processing Rate (%)</p>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editableFields.current_processing_rate}
                            onChange={(e) => setEditableFields({...editableFields, current_processing_rate: e.target.value})}
                            placeholder="Enter processing rate"
                          />
                        ) : (
                          <p className="font-medium">{client.current_processing_rate ? `${client.current_processing_rate}%` : 'N/A'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loan Management */}
          <Card>
            <CardHeader>
              <CardTitle>
                Loan Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LoanManager
                clientId={client.id}
                clientName={client.name}
                loans={loans}
                onLoansUpdate={handleLoansUpdate}
              />
            </CardContent>
          </Card>

          {/* Client Scheduling */}
          <ClientScheduler 
            clientId={client.contact_entity_id || client.id}
            clientName={client.name}
            clientType="client"
          />

          {/* General Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle>General Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="generalNotes">Add New Note</Label>
                <Textarea
                  id="generalNotes"
                  placeholder="Type your note here..."
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  rows={4}
                />
                <Button onClick={saveGeneralNotes} disabled={!generalNotes.trim()}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Note
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Call Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle>Call Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Call Note Input */}
              <div className="space-y-2">
                <Label htmlFor="newCallNote">Add New Call Note</Label>
                <Textarea
                  id="newCallNote"
                  placeholder="Enter your call notes here..."
                  value={newCallNote}
                  onChange={(e) => setNewCallNote(e.target.value)}
                  rows={4}
                />
                <Button onClick={saveCallNotes} disabled={!newCallNote.trim()}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Call Note
                </Button>
              </div>

              {/* Call Notes History */}
              <div className="space-y-2">
                <Label>Call Notes History</Label>
                <div className="max-h-[500px] overflow-y-auto space-y-2">
                  {notesHistory.filter(n => n.note_type === 'call').length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4">No call notes yet...</p>
                  ) : (
                    notesHistory
                      .filter(n => n.note_type === 'call')
                      .map(note => (
                        <div key={note.id} className="pb-2 border-b border-border last:border-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-xs text-muted-foreground">
                              {new Date(note.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                            <span className="text-xs text-muted-foreground">{note.user_name}</span>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Action Reminder Dialog */}
      {client && (
        <ActionReminder
          entityId={client.id}
          entityName={client.name}
          entityType="client"
          isOpen={showReminderDialog}
          onClose={() => setShowReminderDialog(false)}
        />
      )}
    </div>
  )
}

