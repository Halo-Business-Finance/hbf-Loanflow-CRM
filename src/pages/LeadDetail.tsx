import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ibmDb } from "@/lib/ibm"
const supabase = ibmDb; // IBM migration shim
import { useAuth } from "@/components/auth/AuthProvider"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
// Badge component removed - using plain text instead
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ActionReminder } from "@/components/ActionReminder"
import { ScheduledReminders } from "@/components/ScheduledReminders"
import { PhoneDialer } from "@/components/PhoneDialer"
import { EmailComposer } from "@/components/EmailComposer"
import { ClickablePhone } from "@/components/ui/clickable-phone"
import { useRoleBasedAccess } from "@/hooks/useRoleBasedAccess"
import { BorrowerDocumentsWidget } from "@/components/BorrowerDocumentsWidget"
import { LenderSelect } from "@/components/LenderSelect"
import { LenderInfoWidget } from "@/components/LenderInfoWidget"
import { ServiceProviderSelect } from "@/components/ServiceProviderSelect"
import { ServiceProviderInfoWidget } from "@/components/ServiceProviderInfoWidget"
import { ClientScheduler } from "@/components/calendar/ClientScheduler"

import { formatNumber, formatCurrency, formatPhoneNumber, cn } from "@/lib/utils"
import { useNotifications } from "@/hooks/useNotifications"
import { format } from "date-fns"
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
  Phone as PhoneIcon,
  Calendar,
  Send,
  UserCheck,
  Home,
  CheckCircle,
  XCircle,
  Target,
  FileText,
  Bell,
  Trash2,
  ChevronDown,
  ShoppingCart,
  Percent,
  UserPlus
} from "lucide-react"

import { Lead, Client as ClientType, LOAN_TYPES, LEAD_SOURCES } from "@/types/lead"
import { mapLeadFields, mapClientFields, extractContactEntityData, LEAD_WITH_CONTACT_QUERY, CLIENT_WITH_CONTACT_QUERY } from "@/lib/field-mapping"

export default function LeadDetail() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { createNotification } = useNotifications()
  const { canDeleteLeads } = useRoleBasedAccess()
  
  // Debug logging
  console.log('LeadDetail component - params:', params, 'id:', id, 'window.location:', window.location.pathname)

  const [lead, setLead] = useState<Lead | null>(null)
  const [client, setClient] = useState<ClientType | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [callNotes, setCallNotes] = useState("")
  const [generalNotes, setGeneralNotes] = useState("")
  const [showReminderDialog, setShowReminderDialog] = useState(false)
  const [remindersRefreshKey, setRemindersRefreshKey] = useState(0)
  const [notesHistory, setNotesHistory] = useState<Array<{
    id: string
    note_type: 'general' | 'call'
    content: string
    created_at: string
    user_name: string
  }>>([])
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [assignments, setAssignments] = useState({
    loan_originator_id: "",
    processor_id: "",
    underwriter_id: ""
  })
  const [additionalBorrowers, setAdditionalBorrowers] = useState<any[]>([])
  const [currentBorrowerIndex, setCurrentBorrowerIndex] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [showAddBorrowerDialog, setShowAddBorrowerDialog] = useState(false)
  const [companyLoans, setCompanyLoans] = useState<any[]>([])
  const [selectedLenderId, setSelectedLenderId] = useState<string | null>(null)
  const [selectedTitleCompanyId, setSelectedTitleCompanyId] = useState<string | null>(null)
  const [selectedEscrowCompanyId, setSelectedEscrowCompanyId] = useState<string | null>(null)
  const [newBorrower, setNewBorrower] = useState({
    first_name: "",
    last_name: "",
    email: "",
    home_address: "",
    home_city: "",
    home_state: "",
    home_zip_code: "",
    ownership_percentage: ""
  })
  const [editableFields, setEditableFields] = useState({
    name: "",
    email: "",
    phone: "",
    phone_ext: "",
    ownership_percentage: "",
    home_address: "",
    home_city: "",
    home_state: "",
    home_zip_code: "",
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
    loan_amount: "",
    loan_type: "",
    stage: "",
    priority: "",
    source: "",
    credit_score: "",
    net_operating_income: "",
    bank_lender_name: "",
    annual_revenue: "",
    interest_rate: "",
    maturity_date: "",
    existing_loan_amount: "",
    bdo_name: "",
    bdo_telephone: "",
    bdo_email: "",
    first_name: "",
    last_name: "",
    personal_email: "",
    mobile_phone: "",
    processor_name: "",
    pos_system: "",
    monthly_processing_volume: "",
    average_transaction_size: "",
    current_processing_rate: ""
  })

  const isValidUuid = (value?: string) =>
    !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)


  useEffect(() => {
    console.log('LeadDetail useEffect - id:', id, 'user:', user?.id)
    
    if (!user) return

    if (!isValidUuid(id) || id === ':id') {
      navigate('/leads', { replace: true })
      return
    }
    
    fetchLead()
    fetchTeamMembers()
    fetchAdditionalBorrowers()
    fetchCompanyLoans()
  }, [id, user])

  const fetchAdditionalBorrowers = async () => {
    if (!id) return
    
    try {
      const { data, error } = await supabase
        .from('additional_borrowers')
        .select('*, contact_entity:contact_entities!contact_entity_id(*)')
        .eq('lead_id', id)
        .order('borrower_order')

      if (error) throw error
      setAdditionalBorrowers(data || [])
    } catch (error) {
      console.error('Error fetching additional borrowers:', error)
    }
  }

  const fetchCompanyLoans = async () => {
    if (!id) return

    try {
      // First get the lead to find its contact_entity_id
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('contact_entity_id')
        .eq('id', id)
        .maybeSingle()

      if (leadError) {
        console.error('Error fetching lead for company loans:', leadError)
        return
      }

      if (!leadData?.contact_entity_id) {
        console.log('No contact_entity_id found for this lead')
        setCompanyLoans([])
        return
      }

      console.log('Fetching company loans for contact_entity_id:', leadData.contact_entity_id)

      // Find all leads associated with this contact entity (company)
      const { data: companyLeadsData, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          loan_amount,
          stage,
          created_at,
          is_converted_to_client,
          converted_at
        `)
        .eq('contact_entity_id', leadData.contact_entity_id)
        .order('created_at', { ascending: false })

      if (leadsError) {
        console.error('Error fetching company loans:', leadsError)
        return
      }

      console.log('Company loans found:', companyLeadsData?.length || 0)
      setCompanyLoans(companyLeadsData || [])
    } catch (error) {
      console.error('Error in fetchCompanyLoans:', error)
    }
  }

  const handleFlipToBorrower = (index: number) => {
    if (index === currentBorrowerIndex) return
    
    setIsFlipping(true)
    setTimeout(() => {
      setCurrentBorrowerIndex(index)
      setIsFlipping(false)
    }, 300)
  }

  const handleAddBorrower = () => {
    setShowAddBorrowerDialog(true)
  }

  const saveNewBorrower = async () => {
    if (!lead || !user) return

    try {
      // Create contact entity for the new borrower
      const { data: contactData, error: contactError } = await supabase
        .from('contact_entities')
        .insert({
          user_id: user.id,
          name: `${newBorrower.first_name} ${newBorrower.last_name}`.trim(),
          first_name: newBorrower.first_name,
          last_name: newBorrower.last_name,
          email: newBorrower.email,
          home_address: newBorrower.home_address,
          home_city: newBorrower.home_city,
          home_state: newBorrower.home_state,
          home_zip_code: newBorrower.home_zip_code,
          ownership_percentage: newBorrower.ownership_percentage ? parseFloat(newBorrower.ownership_percentage) : null
        })
        .select()
        .single()

      if (contactError) throw contactError

      // Create additional borrower record
      const borrowerOrder = additionalBorrowers.length + 1
      const { error: borrowerError } = await supabase
        .from('additional_borrowers')
        .insert({
          lead_id: lead.id,
          contact_entity_id: contactData.id,
          borrower_order: borrowerOrder,
          is_primary: false
        })

      if (borrowerError) throw borrowerError

      toast({
        title: "Success",
        description: "Additional borrower added successfully",
      })

      // Reset form and close dialog
      setNewBorrower({
        first_name: "",
        last_name: "",
        email: "",
        home_address: "",
        home_city: "",
        home_state: "",
        home_zip_code: "",
        ownership_percentage: ""
      })
      setShowAddBorrowerDialog(false)
      
      // Refresh borrowers list
      fetchAdditionalBorrowers()
    } catch (error) {
      console.error('Error adding borrower:', error)
      toast({
        title: "Error",
        description: "Failed to add borrower",
        variant: "destructive",
      })
    }
  }

  const deleteCurrentBorrower = async () => {
    if (currentBorrowerIndex === 0 || !lead || !user) {
      toast({
        title: "Error",
        description: "Cannot delete the primary borrower",
        variant: "destructive",
      })
      return
    }

    const borrower = additionalBorrowers[currentBorrowerIndex - 1]
    if (!borrower) return

    try {
      // Delete the additional borrower record
      const { error: borrowerError } = await supabase
        .from('additional_borrowers')
        .delete()
        .eq('id', borrower.id)

      if (borrowerError) throw borrowerError

      // Optionally delete the contact entity as well
      const { error: contactError } = await supabase
        .from('contact_entities')
        .delete()
        .eq('id', borrower.contact_entity_id)

      if (contactError) {
        console.error('Error deleting contact entity:', contactError)
        // Continue even if contact deletion fails
      }

      toast({
        title: "Success",
        description: "Borrower deleted successfully",
      })

      // Navigate to primary borrower
      setCurrentBorrowerIndex(0)
      
      // Refresh borrowers list
      fetchAdditionalBorrowers()
    } catch (error) {
      console.error('Error deleting borrower:', error)
      toast({
        title: "Error",
        description: "Failed to delete borrower",
        variant: "destructive",
      })
    }
  }

  // Get current borrower data based on index
  const getCurrentBorrowerData = () => {
    if (currentBorrowerIndex === 0) {
      // Primary borrower (lead contact)
      return {
        first_name: editableFields.first_name,
        last_name: editableFields.last_name,
        home_address: editableFields.home_address,
        home_city: editableFields.home_city,
        home_state: editableFields.home_state,
        home_zip_code: editableFields.home_zip_code,
        email: editableFields.email,
        isPrimary: true
      }
    } else {
      // Additional borrower
      const borrower = additionalBorrowers[currentBorrowerIndex - 1]
      return {
        first_name: borrower?.contact_entity?.first_name || '',
        last_name: borrower?.contact_entity?.last_name || '',
        home_address: borrower?.contact_entity?.home_address || '',
        home_city: borrower?.contact_entity?.home_city || '',
        home_state: borrower?.contact_entity?.home_state || '',
        home_zip_code: borrower?.contact_entity?.home_zip_code || '',
        email: borrower?.contact_entity?.email || '',
        isPrimary: false
      }
    }
  }

  const currentBorrower = getCurrentBorrowerData()

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_roles(role)')
        .eq('is_active', true)
        .order('first_name')

      if (error) throw error

      const formattedMembers = data?.map((member: any) => ({
        id: member.id,
        name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unknown',
        role: member.user_roles?.[0]?.role || 'agent'
      })) || []

      setTeamMembers(formattedMembers)
    } catch (error) {
      console.error('Error fetching team members:', error)
    }
  }

  const fetchLead = async () => {
    try {
      console.log('Fetching lead with ID:', id)
      
      if (!isValidUuid(id)) {
        // Guard against invalid URLs
        navigate('/leads', { replace: true })
        return
      }
      
      // Avoid PostgREST FK embedding issues by fetching in two steps
      const { data: leadRow, error: leadErr } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      console.log('Lead fetch result (base row):', { leadRow, leadErr })

      if (leadErr) throw leadErr
      
      if (!leadRow) {
        toast({
          title: "Error",
          description: "Lead not found or you don't have permission to view it",
          variant: "destructive",
        })
        navigate('/leads')
        return
      }
      
      // Fetch related contact entity separately (embedding can fail without FK)
      let contactEntity: any | null = null
      if (leadRow.contact_entity_id) {
        const { data: ce, error: ceErr } = await supabase
          .from('contact_entities')
          .select('*')
          .eq('id', leadRow.contact_entity_id)
          .maybeSingle()
        if (ceErr) {
          console.warn('Contact entity fetch warning:', ceErr)
        } else {
          contactEntity = ce
        }
      }
      
      const mergedLead = {
        ...leadRow,
        contact_entity: contactEntity,
        ...(contactEntity || {}),
        id: leadRow.id, // Preserve the actual lead ID
        contact_entity_id: leadRow.contact_entity_id // Store contact entity ID separately
      }
      setLead(mergedLead)
      setCallNotes(mergedLead.call_notes || "")
      setGeneralNotes(mergedLead.notes || "")
      setAssignments({
        loan_originator_id: (leadRow as any).loan_originator_id || "",
        processor_id: (leadRow as any).processor_id || "",
        underwriter_id: (leadRow as any).underwriter_id || ""
      })
      
      // Set selected lender ID
      setSelectedLenderId(mergedLead.lender_id || null)
      setSelectedTitleCompanyId(mergedLead.title_company_id || null)
      setSelectedEscrowCompanyId(mergedLead.escrow_company_id || null)
      
      setEditableFields({
        name: mergedLead.name || "",
        email: mergedLead.email || "",
        phone: mergedLead.phone || "",
        phone_ext: (mergedLead as any).phone_ext || "",
        ownership_percentage: mergedLead.ownership_percentage?.toString() || "",
        home_address: (mergedLead as any).home_address || "",
        home_city: (mergedLead as any).home_city || "",
        home_state: (mergedLead as any).home_state || "",
        home_zip_code: (mergedLead as any).home_zip_code || "",
        business_name: mergedLead.business_name || "",
        business_address: mergedLead.business_address || "",
        business_city: mergedLead.business_city || "",
        business_state: mergedLead.business_state || "",
        business_zip_code: mergedLead.business_zip_code || "",
        naics_code: mergedLead.naics_code || "",
        ownership_structure: mergedLead.ownership_structure || "",
        owns_property: mergedLead.owns_property || false,
        property_payment_amount: mergedLead.property_payment_amount?.toString() || "",
        year_established: mergedLead.year_established?.toString() || "",
        loan_amount: mergedLead.loan_amount?.toString() || "",
        loan_type: mergedLead.loan_type || "",
        stage: mergedLead.stage || "",
        priority: mergedLead.priority || "",
        source: (mergedLead as any).source || "",
        credit_score: mergedLead.credit_score?.toString() || "",
        net_operating_income: mergedLead.net_operating_income?.toString() || "",
        bank_lender_name: mergedLead.bank_lender_name || "",
        annual_revenue: mergedLead.annual_revenue?.toString() || "",
        interest_rate: mergedLead.interest_rate?.toString() || "",
        maturity_date: mergedLead.maturity_date || "",
        existing_loan_amount: mergedLead.existing_loan_amount?.toString() || "",
        bdo_name: mergedLead.bdo_name || "",
        bdo_telephone: mergedLead.bdo_telephone || "",
        bdo_email: mergedLead.bdo_email || "",
        first_name: mergedLead.first_name || "",
        last_name: mergedLead.last_name || "",
        personal_email: mergedLead.personal_email || "",
        mobile_phone: mergedLead.mobile_phone || "",
        processor_name: mergedLead.processor_name || "",
        pos_system: mergedLead.pos_system || "",
        monthly_processing_volume: mergedLead.monthly_processing_volume?.toString() || "",
        average_transaction_size: mergedLead.average_transaction_size?.toString() || "",
        current_processing_rate: mergedLead.current_processing_rate?.toString() || ""
      })
      
      if (leadRow.is_converted_to_client) {
        await fetchClientData(leadRow.id)
      }
    } catch (error) {
      console.error('Error fetching lead:', error)
      toast({
        title: "Error",
        description: "Failed to fetch lead details",
        variant: "destructive",
      })
      navigate('/leads')
    } finally {
      setLoading(false)
    }
  }

  const fetchClientData = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(CLIENT_WITH_CONTACT_QUERY)
        .eq('lead_id', leadId)
        .single()

      if (error) return
      
      const mergedClient = mapClientFields(data)
      setClient(mergedClient)
    } catch (error) {
      console.error('Error fetching client:', error)
    }
  }

  const saveLeadChanges = async () => {
    if (!lead || !user) return

    try {
      // Check if stage changed from "New Lead" to something else
      const stageChanged = lead.stage === "New Lead" && editableFields.stage !== "New Lead"
      
      // Auto-assign current user as loan originator if stage changed from New Lead
      let updatedAssignments = { ...assignments }
      if (stageChanged && !assignments.loan_originator_id) {
        updatedAssignments.loan_originator_id = user.id
        setAssignments(updatedAssignments)
      }

      // Add timestamp to call notes if they've been modified
      let timestampedCallNotes = callNotes
      if (callNotes !== lead.call_notes) {
        const timestamp = new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
        const noteEntry = callNotes.trim()
        
        // If there are existing notes, add a separator
        if (lead.call_notes && lead.call_notes.trim()) {
          timestampedCallNotes = `${lead.call_notes}\n\n[${timestamp}]\n${noteEntry}`
        } else {
          timestampedCallNotes = `[${timestamp}]\n${noteEntry}`
        }
        setCallNotes(timestampedCallNotes)
      }

      const contactUpdateData: any = {
        name: editableFields.name,
        email: editableFields.email,
        phone: editableFields.phone,
        ownership_percentage: editableFields.ownership_percentage ? parseFloat(editableFields.ownership_percentage) : null,
        home_address: editableFields.home_address,
        home_city: editableFields.home_city,
        home_state: editableFields.home_state,
        home_zip_code: editableFields.home_zip_code,
        business_name: editableFields.business_name,
        business_address: editableFields.business_address,
        business_city: editableFields.business_city,
        business_state: editableFields.business_state,
        business_zip_code: editableFields.business_zip_code,
        naics_code: editableFields.naics_code,
        ownership_structure: editableFields.ownership_structure,
        owns_property: editableFields.owns_property,
        property_payment_amount: editableFields.property_payment_amount ? parseFloat(editableFields.property_payment_amount) : null,
        year_established: editableFields.year_established ? parseInt(editableFields.year_established) : null,
        loan_amount: editableFields.loan_amount ? parseFloat(editableFields.loan_amount) : null,
        loan_type: editableFields.loan_type,
        stage: editableFields.stage,
        priority: editableFields.priority,
        source: editableFields.source,
        credit_score: editableFields.credit_score ? parseInt(editableFields.credit_score) : null,
        net_operating_income: editableFields.net_operating_income ? parseFloat(editableFields.net_operating_income) : null,
        bank_lender_name: editableFields.bank_lender_name,
        lender_id: selectedLenderId,
        title_company_id: selectedTitleCompanyId,
        escrow_company_id: selectedEscrowCompanyId,
        annual_revenue: editableFields.annual_revenue ? parseFloat(editableFields.annual_revenue) : null,
        interest_rate: editableFields.interest_rate ? parseFloat(editableFields.interest_rate) : null,
        maturity_date: editableFields.maturity_date || null,
        existing_loan_amount: editableFields.existing_loan_amount ? parseFloat(editableFields.existing_loan_amount) : null,
        bdo_name: editableFields.bdo_name,
        bdo_telephone: editableFields.bdo_telephone,
        bdo_email: editableFields.bdo_email,
        first_name: editableFields.first_name,
        last_name: editableFields.last_name,
        personal_email: editableFields.personal_email,
        mobile_phone: editableFields.mobile_phone,
        processor_name: editableFields.processor_name,
        pos_system: editableFields.pos_system,
        monthly_processing_volume: editableFields.monthly_processing_volume ? parseFloat(editableFields.monthly_processing_volume) : null,
        average_transaction_size: editableFields.average_transaction_size ? parseFloat(editableFields.average_transaction_size) : null,
        current_processing_rate: editableFields.current_processing_rate ? parseFloat(editableFields.current_processing_rate) : null,
        call_notes: timestampedCallNotes,
        notes: generalNotes
      }

      const { error: contactError } = await supabase
        .from('contact_entities')
        .update(contactUpdateData)
        .eq('id', lead.contact_entity_id)

      if (contactError) throw contactError

      const leadUpdateData: any = {
        last_contact: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        loan_originator_id: updatedAssignments.loan_originator_id || null,
        processor_id: updatedAssignments.processor_id || null,
        underwriter_id: updatedAssignments.underwriter_id || null
      }

      const { error: leadError } = await supabase
        .from('leads')
        .update(leadUpdateData)
        .eq('id', lead.id)

      if (leadError) throw leadError

      // Create audit log entry for the activity
      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          user_id: user?.id,
          action: 'lead_updated',
          table_name: 'contact_entities',
          record_id: lead.contact_entity_id,
          new_values: {
            call_notes: timestampedCallNotes,
            notes: generalNotes,
            ...contactUpdateData
          }
        })

      if (auditError) {
        console.error('Error creating audit log:', auditError)
      }

      const successMessage = stageChanged && updatedAssignments.loan_originator_id === user.id
        ? "Lead updated and you've been assigned as the Loan Originator"
        : "Lead information updated successfully"

      toast({
        title: "Success",
        description: successMessage,
      })
      
      setIsEditing(false)
      fetchLead()
    } catch (error) {
      console.error('Error updating lead:', error)
      toast({
        title: "Error",
        description: `Failed to update lead information: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      })
    }
  }

  // Fetch notes history
  const fetchNotesHistory = async () => {
    if (!lead?.contact_entity_id) return
    const { data, error } = await supabase
      .from('notes_history')
      .select(`
        id,
        note_type,
        content,
        created_at,
        user_id
      `)
      .eq('contact_id', lead.contact_entity_id)
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

  // Save General Notes on blur (always editable)
  const saveGeneralNotesImmediate = async () => {
    if (!lead?.contact_entity_id || !user) return
    const trimmed = generalNotes.trim()
    
    try {
      // Update the contact_entities notes field
      const { error } = await supabase
        .from('contact_entities')
        .update({ notes: trimmed })
        .eq('id', lead.contact_entity_id)
      
      if (error) {
        console.error('Error saving notes:', error)
        toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' })
        return
      }
      
      // Update local state
      setLead({ ...lead, notes: trimmed })
      toast({ title: 'Saved', description: 'Notes saved successfully' })
    } catch (error) {
      console.error('Error saving general notes:', error)
      toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' })
    }
  }

  // Save Call Notes on blur with timestamp
  const saveCallNotesImmediate = async () => {
    if (!lead?.contact_entity_id || !user) return
    const trimmed = callNotes.trim()
    // If empty, just return silently - user doesn't want to add a note
    if (!trimmed) return
    
    // Insert into history
    const { error: historyError } = await supabase
      .from('notes_history')
      .insert({
        contact_id: lead.contact_entity_id,
        note_type: 'call',
        content: trimmed,
        user_id: user.id
      })
    
    if (historyError) {
      console.error('Error saving note history:', historyError)
      toast({ title: 'Error', description: 'Failed to save note', variant: 'destructive' })
      return
    }
    
    setCallNotes('')
    fetchNotesHistory()
    toast({ title: 'Saved', description: 'Call note added to history' })
  }

  const deleteLead = async () => {
    if (!lead) return

    try {
      console.log('Attempting to delete lead:', lead.id, 'User ID:', user?.id)
      
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id)

      if (error) {
        console.error('Delete error details:', error)
        throw error
      }

      // Create audit log entry for the deletion
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user?.id,
          action: 'lead_deleted',
          table_name: 'leads',
          record_id: lead.id,
          old_values: {
            name: lead.name,
            business_name: lead.business_name
          }
        })
      
      console.log('Lead deleted successfully')
      toast({
        title: "Success!",
        description: `${lead.name || 'Lead'} has been deleted successfully.`,
      })

      navigate('/leads')
    } catch (error: any) {
      console.error('Error deleting lead:', error)
      
      // More detailed error handling
      let errorMessage = "Failed to delete lead"
      if (error.message?.includes('row-level security')) {
        errorMessage = "You don't have permission to delete this lead. Only admins or the lead owner can delete leads."
      } else if (error.message) {
        errorMessage = `Failed to delete lead: ${error.message}`
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const getPriorityColor = (priority?: string) => {
    if (!priority) return 'secondary'
    switch (priority.toLowerCase()) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStageColor = (stage?: string) => {
    if (!stage) return 'secondary'
    switch (stage) {
      case 'New Lead': return 'outline'
      case 'Initial Contact': return 'secondary'
      case 'Loan Application Signed': return 'default'
      case 'Waiting for Documentation': return 'default'
      case 'Pre-Approved': return 'default'
      case 'Term Sheet Signed': return 'default'
      case 'Loan Approved': return 'default'
      case 'Closing': return 'default'
      case 'Loan Funded': return 'default'
      case 'Archive': return 'secondary'
      default: return 'secondary'
    }
  }

  const getLoanProgress = (stage?: string): number => {
    if (!stage) return 0
    switch (stage) {
      case 'New Lead': return 0
      case 'Initial Contact': return 11
      case 'Loan Application Signed': return 22
      case 'Waiting for Documentation': return 33
      case 'Pre-Approved': return 44
      case 'Term Sheet Signed': return 56
      case 'Loan Approved': return 67
      case 'Closing': return 89
      case 'Loan Funded': return 100
      default: return 0
    }
  }

  const convertToClient = async () => {
    if (!lead || !user) return

    try {
      // Check if already converted
      if (lead.is_converted_to_client) {
        toast({
          title: "Already Converted",
          description: "This lead has already been converted to a client.",
        })
        return
      }

      // Create client record
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: lead.user_id,
          lead_id: lead.id,
          contact_entity_id: lead.contact_entity_id,
          status: 'Active',
          total_loans: 1,
          total_loan_value: lead.loan_amount || 0
        })
        .select()
        .single()

      if (clientError) throw clientError

      // Mark lead as converted
      const { error: leadError } = await supabase
        .from('leads')
        .update({ 
          is_converted_to_client: true, 
          converted_at: new Date().toISOString() 
        })
        .eq('id', lead.id)

      if (leadError) throw leadError

      // Create audit log
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: 'lead_converted',
          table_name: 'leads',
          record_id: lead.id,
          new_values: {
            client_id: clientData.id,
            stage: 'Loan Funded'
          }
        })

      toast({
        title: "Success!",
        description: `${lead.name || 'Lead'} has been converted to an existing borrower.`,
      })

      // Refresh lead data
      await fetchLead()
    } catch (error: any) {
      console.error('Error converting lead:', error)
      toast({
        title: "Error",
        description: `Failed to convert lead: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      })
    }
  }

  // Watch for stage changes and auto-convert when funded
  useEffect(() => {
    if (lead && editableFields.stage === 'Loan Funded' && !lead.is_converted_to_client) {
      convertToClient()
    }
  }, [editableFields.stage])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading lead details...</p>
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Lead not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
        {/* Modern Header */}
        <div className="bg-white border-b border-border sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/leads')}
                  className="h-8 w-8 p-0 hover:opacity-70 rounded-md"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold text-foreground">
                      {lead.business_name || lead.name || 'Lead Details'}
                    </h1>
                    <div className="flex items-center gap-2">
                      {lead.is_converted_to_client && (
                        <span className="text-xs font-medium px-2 py-1 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1 inline" />
                          Converted
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lead ID: {lead.lead_number ? String(lead.lead_number).padStart(3, '0') : 'N/A'} • Created {format(new Date(lead.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <PhoneDialer 
                  phoneNumber={lead.phone}
                  trigger={
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <PhoneIcon className="h-3 w-3 mr-2" />
                      Call
                    </Button>
                  }
                />
                <EmailComposer 
                  recipientEmail={lead.email}
                  recipientName={lead.name}
                  trigger={
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Mail className="h-3 w-3 mr-2" />
                      Email
                    </Button>
                  }
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowReminderDialog(true)}
                  className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Bell className="h-3 w-3 mr-2" />
                  Set Reminder
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={isEditing ? saveLeadChanges : () => setIsEditing(true)}
                  className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Edit className="h-3 w-3 mr-2" />
                  {isEditing ? 'Save Changes' : 'Edit'}
                </Button>
                
                {(canDeleteLeads || (lead.user_id === user?.id)) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive"
                        size="sm"
                        className="h-8 text-xs font-medium"
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Lead</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete <strong>{lead?.name || 'this lead'}</strong>? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={deleteLead}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Lead
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                    className="h-8 text-xs font-medium"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6">
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scheduled Reminders */}
            {lead && (
              <ScheduledReminders
                key={remindersRefreshKey}
                entityId={lead.id}
                entityType="lead"
              />
            )}

            {/* Lead Status Card */}
            <Card className="border border-border shadow-sm lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  Lead Status
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Lead Source</Label>
                    {isEditing ? (
                      <Select
                        value={editableFields.source}
                        onValueChange={(value) => setEditableFields({...editableFields, source: value})}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-0">
                          <SelectValue placeholder="Select lead source" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_SOURCES.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1 h-8 px-3 flex items-center text-xs font-medium bg-blue-600 text-white rounded-md">
                        {editableFields.source || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Loan Stage</Label>
                    {isEditing ? (
                      <Select
                        value={editableFields.stage}
                        onValueChange={(value) => setEditableFields({...editableFields, stage: value})}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-0">
                          <SelectValue placeholder="Select loan stage" />
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
                      <div className="mt-1 h-8 px-3 flex items-center text-xs font-medium bg-blue-600 text-white rounded-md">
                        {editableFields.stage || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
                    {isEditing ? (
                      <Select
                        value={editableFields.priority}
                        onValueChange={(value) => setEditableFields({...editableFields, priority: value})}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-0">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1 h-8 px-3 flex items-center text-xs font-medium bg-blue-600 text-white rounded-md">
                        {editableFields.priority || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Assignments - Only show when stage is not "New Lead" */}
                {editableFields.stage && editableFields.stage !== "New Lead" && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-medium text-foreground mb-3">Team Assignments</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Loan Originator</Label>
                        {isEditing ? (
                          <Select
                            value={assignments.loan_originator_id || "unassigned"}
                            onValueChange={(value) => setAssignments({...assignments, loan_originator_id: value === "unassigned" ? "" : value})}
                          >
                            <SelectTrigger className="mt-1 h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-0">
                              <SelectValue placeholder="Select originator" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {teamMembers.map(member => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="mt-1 h-8 px-3 flex items-center text-xs font-medium bg-blue-600 text-white rounded-md">
                            {teamMembers.find(m => m.id === assignments.loan_originator_id)?.name || 'Unassigned'}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Loan Processor</Label>
                        {isEditing ? (
                          <Select
                            value={assignments.processor_id || "unassigned"}
                            onValueChange={(value) => setAssignments({...assignments, processor_id: value === "unassigned" ? "" : value})}
                          >
                            <SelectTrigger className="mt-1 h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-0">
                              <SelectValue placeholder="Select processor" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {teamMembers.map(member => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="mt-1 h-8 px-3 flex items-center text-xs font-medium bg-blue-600 text-white rounded-md">
                            {teamMembers.find(m => m.id === assignments.processor_id)?.name || 'Unassigned'}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Loan Underwriter</Label>
                        {isEditing ? (
                          <Select
                            value={assignments.underwriter_id || "unassigned"}
                            onValueChange={(value) => setAssignments({...assignments, underwriter_id: value === "unassigned" ? "" : value})}
                          >
                            <SelectTrigger className="mt-1 h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-0">
                              <SelectValue placeholder="Select underwriter" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {teamMembers.map(member => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="mt-1 h-8 px-3 flex items-center text-xs font-medium bg-blue-600 text-white rounded-md">
                            {teamMembers.find(m => m.id === assignments.underwriter_id)?.name || 'Unassigned'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Loan Progress Bar */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium text-muted-foreground">Loan Progress</Label>
                    <span className="text-xs font-semibold text-[#0f62fe]">
                      {getLoanProgress(editableFields.stage)}%
                    </span>
                  </div>
                  <Progress value={getLoanProgress(editableFields.stage)} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    {editableFields.stage === 'Loan Funded' 
                      ? '✓ Loan funded - Moving to existing borrowers' 
                      : `Current stage: ${editableFields.stage || 'Not set'}`}
                  </p>
                </div>

                {/* Company Loan History */}
                <div className="border-t pt-4 mt-4">
                  <Label className="text-xs font-medium text-muted-foreground mb-3 block">
                    Company Loan History
                  </Label>
                  {companyLoans.length > 1 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {companyLoans
                        .filter(loan => loan.id !== id)
                        .map((loan) => (
                          <div 
                            key={loan.id}
                            className="p-3 rounded-md border border-[#0f62fe]/20 hover:border-[#0f62fe] cursor-pointer transition-colors"
                            onClick={() => navigate(`/leads/${loan.id}`)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-foreground">
                                {loan.loan_amount 
                                  ? `$${Number(loan.loan_amount).toLocaleString()}` 
                                  : 'Amount TBD'}
                              </span>
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded",
                                loan.stage === 'Loan Funded' 
                                  ? "bg-green-100 text-green-800"
                                  : "bg-blue-100 text-blue-800"
                              )}>
                                {loan.stage || 'In Progress'}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {loan.is_converted_to_client 
                                ? `Funded ${new Date(loan.converted_at).toLocaleDateString()}` 
                                : `Started ${new Date(loan.created_at).toLocaleDateString()}`}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">
                      No previous loans found for this company.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Borrower Information Card */}
            <Card className="border border-border shadow-sm relative">
              <style>
                {`
                  @keyframes flipOut {
                    0% { transform: rotateY(0deg); }
                    100% { transform: rotateY(90deg); }
                  }
                  @keyframes flipIn {
                    0% { transform: rotateY(-90deg); }
                    100% { transform: rotateY(0deg); }
                  }
                  .flip-out {
                    animation: flipOut 0.3s ease-in-out;
                  }
                  .flip-in {
                    animation: flipIn 0.3s ease-in-out;
                  }
                `}
              </style>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base font-semibold text-foreground">
                      Borrower Information
                    </CardTitle>
                    {additionalBorrowers.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>
                          {currentBorrowerIndex + 1} of {additionalBorrowers.length + 1}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {additionalBorrowers.length > 0 && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleFlipToBorrower(Math.max(0, currentBorrowerIndex - 1))}
                          disabled={currentBorrowerIndex === 0 || isFlipping}
                        >
                          <ChevronDown className="h-4 w-4 rotate-90" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleFlipToBorrower(Math.min(additionalBorrowers.length, currentBorrowerIndex + 1))}
                          disabled={currentBorrowerIndex === additionalBorrowers.length || isFlipping}
                        >
                          <ChevronDown className="h-4 w-4 -rotate-90" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleAddBorrower}
                    >
                      <UserPlus className="h-3 w-3 mr-2" />
                      Add Borrower
                    </Button>
                    {currentBorrowerIndex > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete Borrower
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Borrower</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this borrower? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={deleteCurrentBorrower}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className={`pt-0 space-y-4 ${isFlipping ? 'flip-out' : 'flip-in'}`}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">First Name</Label>
                    {isEditing && currentBorrower.isPrimary ? (
                      <Input
                        value={editableFields.first_name}
                        onChange={(e) => setEditableFields({...editableFields, first_name: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {currentBorrower.first_name || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Last Name</Label>
                    {isEditing && currentBorrower.isPrimary ? (
                      <Input
                        value={editableFields.last_name}
                        onChange={(e) => setEditableFields({...editableFields, last_name: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {currentBorrower.last_name || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Home Address</Label>
                  {isEditing && currentBorrower.isPrimary ? (
                    <Input
                      value={editableFields.home_address}
                      onChange={(e) => setEditableFields({...editableFields, home_address: e.target.value})}
                      className="mt-1 h-8 text-sm"
                    />
                  ) : (
                    <div className="field-display mt-1">
                      {currentBorrower.home_address || 'N/A'}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">City</Label>
                    {isEditing && currentBorrower.isPrimary ? (
                      <Input
                        value={editableFields.home_city}
                        onChange={(e) => setEditableFields({...editableFields, home_city: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {currentBorrower.home_city || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">State</Label>
                    {isEditing && currentBorrower.isPrimary ? (
                      <Input
                        value={editableFields.home_state}
                        onChange={(e) => setEditableFields({...editableFields, home_state: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {currentBorrower.home_state || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">ZIP Code</Label>
                    {isEditing && currentBorrower.isPrimary ? (
                      <Input
                        value={editableFields.home_zip_code}
                        onChange={(e) => setEditableFields({...editableFields, home_zip_code: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {currentBorrower.home_zip_code || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                  {isEditing && currentBorrower.isPrimary ? (
                    <Input
                      type="email"
                      value={editableFields.email}
                      onChange={(e) => setEditableFields({...editableFields, email: e.target.value})}
                      className="mt-1 h-8 text-sm"
                    />
                  ) : (
                    <div className="field-display mt-1">
                      {currentBorrower.email || 'N/A'}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Company Phone</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.phone ? formatPhoneNumber(editableFields.phone) : ''}
                        onChange={(e) => setEditableFields({...editableFields, phone: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.phone ? formatPhoneNumber(editableFields.phone) : 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Ext</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.phone_ext || ''}
                        onChange={(e) => setEditableFields({...editableFields, phone_ext: e.target.value})}
                        className="mt-1 h-8 text-sm"
                        placeholder="123"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.phone_ext || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Mobile Phone</Label>
                  {isEditing ? (
                    <Input
                      value={editableFields.mobile_phone ? formatPhoneNumber(editableFields.mobile_phone) : ''}
                      onChange={(e) => setEditableFields({...editableFields, mobile_phone: e.target.value})}
                      className="mt-1 h-8 text-sm"
                    />
                  ) : (
                    <div className="field-display mt-1">
                      {editableFields.mobile_phone ? formatPhoneNumber(editableFields.mobile_phone) : 'N/A'}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Ownership Percentage</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={editableFields.ownership_percentage}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (value >= 0 && value <= 100) {
                          setEditableFields({...editableFields, ownership_percentage: e.target.value});
                        }
                      }}
                      className="mt-1 h-8 text-sm"
                      placeholder="0-100"
                    />
                  ) : (
                    <div className="field-display mt-1">
                      {editableFields.ownership_percentage ? `${editableFields.ownership_percentage}%` : 'N/A'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Company Information Card */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Business Name</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.business_name}
                        onChange={(e) => setEditableFields({...editableFields, business_name: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.business_name || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Year Established</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.year_established}
                        onChange={(e) => setEditableFields({...editableFields, year_established: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.year_established || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Business Address</Label>
                  {isEditing ? (
                    <Input
                      value={editableFields.business_address}
                      onChange={(e) => setEditableFields({...editableFields, business_address: e.target.value})}
                      className="mt-1 h-8 text-sm"
                    />
                  ) : (
                    <div className="field-display mt-1">
                      {editableFields.business_address || 'N/A'}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">City</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.business_city}
                        onChange={(e) => setEditableFields({...editableFields, business_city: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.business_city || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">State</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.business_state}
                        onChange={(e) => setEditableFields({...editableFields, business_state: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.business_state || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">ZIP Code</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.business_zip_code}
                        onChange={(e) => setEditableFields({...editableFields, business_zip_code: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.business_zip_code || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Annual Revenue</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.annual_revenue}
                        onChange={(e) => setEditableFields({...editableFields, annual_revenue: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.annual_revenue ? formatCurrency(parseFloat(editableFields.annual_revenue)) : 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">NAICS Code</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.naics_code}
                        onChange={(e) => setEditableFields({...editableFields, naics_code: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.naics_code || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Ownership Structure</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.ownership_structure}
                        onChange={(e) => setEditableFields({...editableFields, ownership_structure: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.ownership_structure || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Processor Name</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.processor_name}
                        onChange={(e) => setEditableFields({...editableFields, processor_name: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.processor_name || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">POS System</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.pos_system}
                        onChange={(e) => setEditableFields({...editableFields, pos_system: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.pos_system || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Monthly Processing Volume</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editableFields.monthly_processing_volume}
                        onChange={(e) => setEditableFields({...editableFields, monthly_processing_volume: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.monthly_processing_volume ? formatCurrency(parseFloat(editableFields.monthly_processing_volume)) : 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Average Transaction Size</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editableFields.average_transaction_size}
                        onChange={(e) => setEditableFields({...editableFields, average_transaction_size: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.average_transaction_size ? formatCurrency(parseFloat(editableFields.average_transaction_size)) : 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Current Processing Rate</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editableFields.current_processing_rate}
                        onChange={(e) => setEditableFields({...editableFields, current_processing_rate: e.target.value})}
                        className="mt-1 h-8 text-sm"
                        placeholder="2.5"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.current_processing_rate ? `${editableFields.current_processing_rate}%` : 'N/A'}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* General Notes Card */}
            <Card className="border-0 shadow-sm lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  General Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Add New Note</Label>
                  <Textarea
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    onBlur={saveGeneralNotesImmediate}
                    placeholder="Type your note and click outside to save..."
                    className="mt-1 min-h-[80px] text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Financial Information Card */}
            <Card className="border-0 shadow-sm lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  Loan Request Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Loan Type</Label>
                    {isEditing ? (
                      <Select
                        value={editableFields.loan_type}
                        onValueChange={(value) => setEditableFields({...editableFields, loan_type: value})}
                      >
                        <SelectTrigger className="mt-1 h-8 text-sm">
                          <SelectValue placeholder="Select loan type" />
                        </SelectTrigger>
                        <SelectContent>
                          {LOAN_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.loan_type || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Loan Amount</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editableFields.loan_amount}
                        onChange={(e) => setEditableFields({...editableFields, loan_amount: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.loan_amount ? formatCurrency(parseFloat(editableFields.loan_amount)) : 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Interest Rate</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editableFields.interest_rate}
                        onChange={(e) => setEditableFields({...editableFields, interest_rate: e.target.value})}
                        className="mt-1 h-8 text-sm"
                        placeholder="5.25"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.interest_rate ? `${editableFields.interest_rate}%` : 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Credit Score</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editableFields.credit_score}
                        onChange={(e) => setEditableFields({...editableFields, credit_score: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.credit_score || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Net Operating Income</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editableFields.net_operating_income}
                        onChange={(e) => setEditableFields({...editableFields, net_operating_income: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.net_operating_income ? formatCurrency(parseFloat(editableFields.net_operating_income)) : 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Existing Loan Amount</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editableFields.existing_loan_amount}
                        onChange={(e) => setEditableFields({...editableFields, existing_loan_amount: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.existing_loan_amount ? formatCurrency(parseFloat(editableFields.existing_loan_amount)) : 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Bank/Lender</Label>
                    {isEditing ? (
                      <div className="mt-1">
                        <LenderSelect
                          value={selectedLenderId}
                          onChange={(lenderId) => {
                            setSelectedLenderId(lenderId)
                            // Also fetch lender name to update the text field
                            supabase
                              .from('lenders')
                              .select('name')
                              .eq('id', lenderId)
                              .single()
                              .then(({ data }) => {
                                if (data) {
                                  setEditableFields({...editableFields, bank_lender_name: data.name})
                                }
                              })
                          }}
                        />
                      </div>
                    ) : (
                      <div className="field-display mt-1">
                        {selectedLenderId && editableFields.bank_lender_name ? (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-left font-normal"
                            onClick={() => navigate(`/lenders/${selectedLenderId}`)}
                          >
                            {editableFields.bank_lender_name}
                          </Button>
                        ) : (
                          <span>N/A</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Maturity Date</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editableFields.maturity_date}
                        onChange={(e) => setEditableFields({...editableFields, maturity_date: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.maturity_date ? format(new Date(editableFields.maturity_date), 'MMM dd, yyyy') : 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Title and Escrow Companies */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Title Company</Label>
                    {isEditing ? (
                      <div className="mt-1">
                        <ServiceProviderSelect
                          value={selectedTitleCompanyId}
                          onChange={setSelectedTitleCompanyId}
                          providerType="title"
                          placeholder="Select title company..."
                        />
                      </div>
                    ) : (
                      <div className="field-display mt-1">
                        {selectedTitleCompanyId ? (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-left font-normal"
                            onClick={() => navigate(`/service-providers/${selectedTitleCompanyId}`)}
                          >
                            View Title Company
                          </Button>
                        ) : (
                          <span>Not assigned</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Escrow Company</Label>
                    {isEditing ? (
                      <div className="mt-1">
                        <ServiceProviderSelect
                          value={selectedEscrowCompanyId}
                          onChange={setSelectedEscrowCompanyId}
                          providerType="escrow"
                          placeholder="Select escrow company..."
                        />
                      </div>
                    ) : (
                      <div className="field-display mt-1">
                        {selectedEscrowCompanyId ? (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-left font-normal"
                            onClick={() => navigate(`/service-providers/${selectedEscrowCompanyId}`)}
                          >
                            View Escrow Company
                          </Button>
                        ) : (
                          <span>Not assigned</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">BDO Name</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.bdo_name}
                        onChange={(e) => setEditableFields({...editableFields, bdo_name: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.bdo_name || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">BDO Phone</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.bdo_telephone}
                        onChange={(e) => setEditableFields({...editableFields, bdo_telephone: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.bdo_telephone || 'N/A'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">BDO Email</Label>
                    {isEditing ? (
                      <Input
                        value={editableFields.bdo_email}
                        onChange={(e) => setEditableFields({...editableFields, bdo_email: e.target.value})}
                        className="mt-1 h-8 text-sm"
                      />
                    ) : (
                      <div className="field-display mt-1">
                        {editableFields.bdo_email || 'N/A'}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loan Documents Widget */}
            {lead && (
              <div className="lg:col-span-2">
                <BorrowerDocumentsWidget 
                  leadId={lead.id} 
                  contactEntityId={lead.contact_entity_id || lead.id}
                />
              </div>
            )}

            {/* Client Scheduling Widget */}
            {lead && (
              <div className="lg:col-span-2">
                <ClientScheduler 
                  clientId={lead.contact_entity_id || lead.id}
                  clientName={lead.name || lead.business_name || 'Lead'}
                  clientType="lead"
                />
              </div>
            )}

            {/* Lender Information Widget */}
            {selectedLenderId && (
              <div className="lg:col-span-2">
                <LenderInfoWidget lenderId={selectedLenderId} />
              </div>
            )}

            {/* Title Company Widget */}
            {selectedTitleCompanyId && (
              <div className="lg:col-span-2">
                <ServiceProviderInfoWidget 
                  providerId={selectedTitleCompanyId} 
                  providerType="title"
                  leadId={id!}
                />
              </div>
            )}

            {/* Escrow Company Widget */}
            {selectedEscrowCompanyId && (
              <div className="lg:col-span-2">
                <ServiceProviderInfoWidget 
                  providerId={selectedEscrowCompanyId} 
                  providerType="escrow"
                  leadId={id!}
                />
              </div>
            )}

            {/* Call Notes Card */}
            <Card className="border-0 shadow-sm lg:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold text-foreground">
                  Call Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Add New Call Note</Label>
                  <Textarea
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    onBlur={saveCallNotesImmediate}
                    placeholder="Type your call note and click outside to save..."
                    className="mt-1 min-h-[80px] text-sm"
                  />
                </div>
                
                {/* Call Notes History */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Call Notes History</Label>
                  <div className="max-h-[400px] overflow-y-auto p-4 rounded-lg border space-y-3">
                    {notesHistory.filter(n => n.note_type === 'call').length === 0 ? (
                      <p className="text-sm text-muted-foreground italic text-center py-4">No call notes yet...</p>
                    ) : (
                      notesHistory
                        .filter(n => n.note_type === 'call')
                        .map(note => (
                          <div key={note.id} className="flex gap-3 p-3 rounded-lg border animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                              <Phone className="w-4 h-4 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {note.user_name}
                                </span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {new Date(note.created_at).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                                {note.content}
                              </p>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Action Reminder Dialog */}
        {lead && (
          <ActionReminder
            entityId={lead.id}
            entityName={lead.name || lead.business_name || 'Lead'}
            entityType="lead"
            isOpen={showReminderDialog}
            onClose={() => {
              setShowReminderDialog(false)
              setRemindersRefreshKey(prev => prev + 1)
            }}
          />
        )}

        {/* Add Borrower Dialog */}
        <Dialog open={showAddBorrowerDialog} onOpenChange={setShowAddBorrowerDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Additional Borrower</DialogTitle>
              <DialogDescription>
                Add a new borrower to this loan application
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-first-name">First Name *</Label>
                  <Input
                    id="new-first-name"
                    value={newBorrower.first_name}
                    onChange={(e) => setNewBorrower({...newBorrower, first_name: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="new-last-name">Last Name *</Label>
                  <Input
                    id="new-last-name"
                    value={newBorrower.last_name}
                    onChange={(e) => setNewBorrower({...newBorrower, last_name: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="new-email">Email *</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newBorrower.email}
                  onChange={(e) => setNewBorrower({...newBorrower, email: e.target.value})}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="new-home-address">Home Address</Label>
                <Input
                  id="new-home-address"
                  value={newBorrower.home_address}
                  onChange={(e) => setNewBorrower({...newBorrower, home_address: e.target.value})}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="new-city">City</Label>
                  <Input
                    id="new-city"
                    value={newBorrower.home_city}
                    onChange={(e) => setNewBorrower({...newBorrower, home_city: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="new-state">State</Label>
                  <Input
                    id="new-state"
                    value={newBorrower.home_state}
                    onChange={(e) => setNewBorrower({...newBorrower, home_state: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="new-zip">ZIP Code</Label>
                  <Input
                    id="new-zip"
                    value={newBorrower.home_zip_code}
                    onChange={(e) => setNewBorrower({...newBorrower, home_zip_code: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="new-ownership">Ownership Percentage</Label>
                <Input
                  id="new-ownership"
                  type="number"
                  min="0"
                  max="100"
                  value={newBorrower.ownership_percentage}
                  onChange={(e) => setNewBorrower({...newBorrower, ownership_percentage: e.target.value})}
                  className="mt-1"
                  placeholder="e.g., 50"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddBorrowerDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={saveNewBorrower}
                disabled={!newBorrower.first_name || !newBorrower.last_name || !newBorrower.email}
              >
                Add Borrower
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }