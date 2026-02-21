import { useState, useEffect } from "react"
import { mapClientFields, CLIENT_WITH_CONTACT_QUERY } from "@/lib/field-mapping"
import { Client } from "@/types/lead"
import { ibmDb } from "@/lib/ibm"
import { useAuth } from "@/components/auth/AuthProvider"
import { useNavigate } from "react-router-dom"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Badge component removed - using plain text instead
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Phone, Mail, MapPin, Calendar, DollarSign, Filter, ChevronDown, ChevronUp, Trash2, Bell, MessageSquare, ShoppingCart, FileText, Eye, Plus, Loader2, Users, CheckCircle2 } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { formatPhoneNumber } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { ActionReminder } from "@/components/ActionReminder"
import { LoanManager } from "@/components/LoanManager"
import LoanRequestManager from "@/components/LoanRequestManager"
import { PhoneDialer } from "@/components/PhoneDialer"
import { EmailComposer } from "@/components/EmailComposer"
import { formatNumber, formatCurrency } from "@/lib/utils"
import { useNotifications } from "@/hooks/useNotifications"
import { format } from "date-fns"

// Using imported Client interface from types/lead.ts

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

export default function Clients() {
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()
  const { toast } = useToast()
  const { createNotification } = useNotifications()
  const [clients, setClients] = useState<Client[]>([])
  const [clientLoans, setClientLoans] = useState<{ [key: string]: Loan[] }>({})
  const [loans, setLoans] = useState<Loan[]>([])
  const [loanRequests, setLoanRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [showNotificationForm, setShowNotificationForm] = useState<string | null>(null)
  const [notificationTitle, setNotificationTitle] = useState("")
  const [notificationMessage, setNotificationMessage] = useState("")
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>()
  const [selectedClientForReminder, setSelectedClientForReminder] = useState<Client | null>(null)
  
  // Add Client state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    business_name: "",
    business_address: "",
    status: "Active"
  })

  useEffect(() => {
    if (user) {
      fetchClients()
    }
  }, [user])

  const fetchClients = async () => {
    try {
      const { data: clientsData, error } = await ibmDb
        .from('clients')
        .select(CLIENT_WITH_CONTACT_QUERY)
        .order('created_at', { ascending: false })

      if (error) throw error

      const clientsWithContactData = (clientsData || []).map(mapClientFields)
      
      setClients(clientsWithContactData)
      
      // Fetch loans for all clients
      if (clientsData && clientsData.length > 0) {
        await fetchAllClientLoans((clientsData as any[]).map(c => c.id))
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllClientLoans = async (clientIds: string[]) => {
    try {
      const { data, error } = await ibmDb
        .from('loans')
        .select('*')
        .in('client_id', clientIds)

      if (error) throw error

      // Group loans by client_id
      const loansByClient: { [key: string]: Loan[] } = {}
      data?.forEach((loan: any) => {
        if (!loansByClient[loan.client_id]) {
          loansByClient[loan.client_id] = []
        }
        loansByClient[loan.client_id].push(loan)
      })

      setClientLoans(loansByClient)
    } catch (error) {
      console.error('Error fetching client loans:', error)
    }
  }

  const handleLoansUpdate = () => {
    fetchClients() // This will refetch both clients and loans
  }

  const deleteClient = async (clientId: string, clientName: string) => {
    try {
      // Delete all related records in the correct order to avoid foreign key constraints
      
      // Delete cases associated with this client
      const { error: casesError } = await ibmDb
        .from('cases')
        .delete()
        .eq('client_id', clientId)

      if (casesError) {
        console.error('Error deleting cases:', casesError)
        // Continue with deletion even if no cases exist
      }

      // Delete loans associated with this client
      const { error: loansError } = await ibmDb
        .from('loans')
        .delete()
        .eq('client_id', clientId)

      if (loansError) {
        console.error('Error deleting loans:', loansError)
        // Continue with deletion even if no loans exist
      }

      // Delete pipeline entries
      const { error: pipelineError } = await ibmDb
        .from('pipeline_entries')
        .delete()
        .eq('client_id', clientId)

      if (pipelineError) {
        console.error('Error deleting pipeline entries:', pipelineError)
        // Continue with deletion even if no pipeline entries exist
      }

      // Delete community members where this client is referenced
      const { error: communityMembersError } = await ibmDb
        .from('community_members')
        .delete()
        .eq('client_id', clientId)

      if (communityMembersError) {
        console.error('Error deleting community members:', communityMembersError)
        // Continue with deletion even if no community members exist
      }

      // Finally delete the client
      const { error: clientError } = await ibmDb
        .from('clients')
        .delete()
        .eq('id', clientId)

      if (clientError) throw clientError

      toast({
        title: "Success!",
        description: `${clientName} and all associated data have been deleted successfully.`,
      })

      fetchClients() // Refresh the clients list
    } catch (error) {
      console.error('Error deleting client:', error)
      toast({
        title: "Error",
        description: "Failed to delete client. Please try again.",
        variant: "destructive",
      })
    }
  }

  const createCallReminder = async (clientId: string, clientName: string) => {
    if (!followUpDate) {
      toast({
        title: "Error",
        description: "Please select a follow-up date",
        variant: "destructive",
      })
      return
    }

    try {
      await createNotification({
        title: "Call Reminder",
        message: `Schedule a call with ${clientName} on ${format(followUpDate, 'PPP')}`,
        type: 'call_reminder',
        clientId: clientId,
      })

      setFollowUpDate(undefined)
      setShowNotificationForm(null)
      toast({
        title: "Success",
        description: "Call reminder created successfully",
      })
    } catch (error) {
      console.error('Error creating call reminder:', error)
      toast({
        title: "Error",
        description: "Failed to create call reminder",
        variant: "destructive",
      })
    }
  }

  const createEmailReminder = async (clientId: string, clientName: string) => {
    if (!followUpDate) {
      toast({
        title: "Error",
        description: "Please select a follow-up date",
        variant: "destructive",
      })
      return
    }

    try {
      await createNotification({
        title: "Email Reminder",
        message: `Send follow-up email to ${clientName} on ${format(followUpDate, 'PPP')}`,
        type: 'email_reminder',
        clientId: clientId,
      })

      setFollowUpDate(undefined)
      setShowNotificationForm(null)
      toast({
        title: "Success",
        description: "Email reminder created successfully",
      })
    } catch (error) {
      console.error('Error creating email reminder:', error)
      toast({
        title: "Error",
        description: "Failed to create email reminder",
        variant: "destructive",
      })
    }
  }

  const createFollowUpReminder = async (clientId: string, clientName: string) => {
    if (!followUpDate) {
      toast({
        title: "Error",
        description: "Please select a follow-up date",
        variant: "destructive",
      })
      return
    }

    try {
      await createNotification({
        title: "Follow-up Reminder",
        message: `Follow up with ${clientName} on ${format(followUpDate, 'PPP')}`,
        type: 'follow_up_reminder',
        clientId: clientId,
      })

      setFollowUpDate(undefined)
      setShowNotificationForm(null)
      toast({
        title: "Success",
        description: "Follow-up reminder created successfully",
      })
    } catch (error) {
      console.error('Error creating follow-up reminder:', error)
      toast({
        title: "Error",
        description: "Failed to create follow-up reminder",
        variant: "destructive",
      })
    }
  }

  const saveNotification = async (clientId: string, clientName: string) => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      toast({
        title: "Error",
        description: "Please fill in both title and message for the notification",
        variant: "destructive",
      })
      return
    }

    try {
      await createNotification({
        title: notificationTitle,
        message: notificationMessage,
        type: 'client_note',
        clientId: clientId,
      })

      setNotificationTitle("")
      setNotificationMessage("")
      setShowNotificationForm(null)
      toast({
        title: "Success",
        description: "Notification created successfully",
      })
    } catch (error) {
      console.error('Error creating notification:', error)
      toast({
        title: "Error",
        description: "Failed to create notification",
        variant: "destructive",
      })
    }
  }

  const filteredClients = clients.filter(client =>
    (client.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'default'
      case 'pending': return 'secondary'
      case 'inactive': return 'destructive'
      default: return 'secondary'
    }
  }

  const getStageColor = (stage?: string) => {
    if (!stage) return 'secondary'
    switch (stage) {
      case 'New Lead': return 'secondary'
      case 'Initial Contact': return 'secondary'
      case 'Loan Application Signed': return 'default'
      case 'Waiting for Documentation': return 'default'
      case 'Pre-Approved': return 'default'
      case 'Term Sheet Signed': return 'default'
      case 'Loan Approved': return 'default'
      case 'Closing': return 'default'
      case 'Loan Funded': return 'default'
      default: return 'secondary'
    }
  }

  const totalLoanValue = clients.reduce((sum, client) => sum + (client.total_loan_value || 0), 0)
  const activeClients = clients.filter(c => c.status === 'Active').length
  const avgLoanSize = clients.length > 0 ? totalLoanValue / clients.length : 0

  const addNewClient = async () => {
    if (!newClient.name.trim() || !newClient.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and email are required fields",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      // First create contact entity
      const { data: contactEntity, error: contactError } = await ibmDb
        .from('contact_entities')
        .insert({
          user_id: user?.id,
          name: newClient.name.trim(),
          email: newClient.email.trim().toLowerCase(),
          phone: newClient.phone?.trim() || null,
          business_name: newClient.business_name?.trim() || null,
          business_address: newClient.business_address?.trim() || null,
          stage: 'Loan Funded' // Clients are already funded
        })
        .select()
        .single()

      if (contactError) throw contactError

      // Then create client record
      const { error: clientError } = await ibmDb
        .from('clients')
        .insert({
          user_id: user?.id,
          contact_entity_id: contactEntity.id,
          status: newClient.status,
          total_loans: 0,
          total_loan_value: 0
        })

      if (clientError) throw clientError

      toast({
        title: "Success!",
        description: "New client has been added successfully.",
      })

      // Reset form and close dialog
      setNewClient({
        name: "",
        email: "",
        phone: "",
        business_name: "",
        business_address: "",
        status: "Active"
      })
      setShowAddDialog(false)
      fetchClients() // Refresh the clients list
    } catch (error) {
      console.error('Error adding client:', error)
      toast({
        title: "Error",
        description: `Failed to add new client: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Modern Header */}
      <div className="p-8 space-y-8 animate-fade-in">
          <IBMPageHeader 
            title="Existing Borrowers"
            subtitle="Manage and track your existing borrower relationships and portfolios"
            actions={
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
                  <Filter className="h-3 w-3 mr-2" />
                  Filter
                </Button>
                <Button onClick={() => setShowAddDialog(true)} size="sm" className="h-8 text-xs font-medium">
                  <Plus className="h-3 w-3 mr-2" />
                  Add Borrower
                </Button>
              </>
            }
          />

      {/* Content Area */}
      <div className="space-y-6">
        {/* Client Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border border-blue-600 border border-border shadow-sm animate-fade-in">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Total Borrowers</Label>
                  <div className="flex items-center gap-2 mt-1">
                    
                    <p className="text-2xl font-bold">{clients.length}</p>
                  </div>
                </div>
                <span className="text-xs font-medium">
                  ACTIVE
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Borrowers</p>
                  <p className="text-2xl font-bold text-primary">{activeClients}</p>
                </div>
                
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Loan Value</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalLoanValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Loan Size</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(avgLoanSize)}</p>
                </div>
                
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="flex gap-4 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search borrowers..."
                    className="pl-10 border-[#0A1628]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client List */}
        <div className="grid gap-6">
          {filteredClients.map((client) => {
            const loans = clientLoans[client.id] || []
            const isExpanded = expandedClient === client.id
            
            return (
              <Card key={client.id} className="shadow-soft hover:shadow-medium transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`https://api.dicebear.com/6/initials/svg?seed=${client.name}`} />
                        <AvatarFallback>{(client.name || 'Unknown').split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      
                      <div className="space-y-2">
                        <div>
                          <button 
                            onClick={() => navigate(`/existing-borrowers/${client.id}`)}
                            className="hover:underline cursor-pointer"
                          >
                            <h3 className="font-semibold text-foreground hover:text-primary transition-colors">{client.name}</h3>
                          </button>
                          <p className="text-sm text-muted-foreground">
                            Borrower since {new Date(client.join_date).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <EmailComposer 
                            recipientEmail={client.email}
                            recipientName={client.name}
                            trigger={
                              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
                                <Mail className="h-4 w-4" />
                                {client.email}
                              </button>
                            }
                          />
                          {client.phone && (
                            <PhoneDialer 
                              phoneNumber={client.phone}
                              trigger={
                                <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
                                  <Phone className="h-4 w-4" />
                                  {formatPhoneNumber(client.phone)}
                                </button>
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-2">
                      <div className="flex gap-2">
                        <span className="text-sm font-medium">
                          {client.status}
                        </span>
                        {client.stage && (
                          <span className="text-sm font-medium">
                            {client.stage}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Last activity: {new Date(client.last_activity).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <div className="flex gap-6">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Total Loans</div>
                        <div className="font-semibold">{formatNumber(client.total_loans)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">Total Value</div>
                        <div className="font-semibold text-accent">
                          {formatCurrency(client.total_loan_value)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Hide Loans
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            View Loans
                          </>
                        )}
                      </Button>
                      
                      <PhoneDialer 
                        phoneNumber={client.phone}
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                          >
                            <Phone className="w-3 h-3 mr-1" />
                            Call
                          </Button>
                        }
                      />
                      <EmailComposer 
                        recipientEmail={client.email}
                        recipientName={client.name}
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                          >
                            <Mail className="w-3 h-3 mr-1" />
                            Email
                          </Button>
                        }
                      />
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedClientForReminder(client)}
                        className="h-8 px-3 text-xs"
                      >
                        <Bell className="w-3 h-3 mr-1" />
                        Reminder
                      </Button>
                      {hasRole('admin') && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Borrower</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{client.name}</strong>? This will also delete all associated loans and pipeline entries. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteClient(client.id, client.name)}
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

                  {/* Expanded Loan Section */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t">
                      <LoanRequestManager
                        clientId={client.id}
                        loanRequests={loanRequests.filter(req => req.client_id === client.id)}
                        onLoanRequestsUpdate={setLoanRequests}
                      />
                      
                      <div className="mt-6">
                        <LoanManager
                          clientId={client.id}
                          clientName={client.name}
                          loans={loans}
                          onLoansUpdate={handleLoansUpdate}
                        />
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            )
          })}
          
          {filteredClients.length === 0 && (
            <Card className="shadow-soft">
              <CardContent className="p-12 text-center">
                <div className="text-muted-foreground">
                  {searchTerm ? 'No borrowers found matching your search.' : 'No borrowers yet. Convert some leads to get started!'}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add Client Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Borrower</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={newClient.name}
                    onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter borrower name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newClient.phone}
                    onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="business_name">Business Name</Label>
                  <Input
                    id="business_name"
                    value={newClient.business_name}
                    onChange={(e) => setNewClient(prev => ({ ...prev, business_name: e.target.value }))}
                    placeholder="Enter business name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newClient.status}
                    onValueChange={(value) => setNewClient(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="business_address">Company Address</Label>
                <Textarea
                  id="business_address"
                  value={newClient.business_address}
                  onChange={(e) => setNewClient(prev => ({ ...prev, business_address: e.target.value }))}
                  placeholder="Enter business address"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={addNewClient} 
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Adding..." : "Add Borrower"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Action Reminder Dialog */}
      {selectedClientForReminder && (
        <ActionReminder
          entityId={selectedClientForReminder.id}
          entityName={selectedClientForReminder.name}
          entityType="client"
          isOpen={!!selectedClientForReminder}
          onClose={() => setSelectedClientForReminder(null)}
        />
      )}
      </div>
    </div>
  )
}