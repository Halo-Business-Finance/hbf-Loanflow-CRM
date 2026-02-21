import { useState } from "react"
import { ibmDb } from "@/lib/ibm"
const supabase = ibmDb; // IBM migration shim
import { useAuth } from "@/components/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"

import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { Plus, DollarSign, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { LenderSelect } from "@/components/LenderSelect"

interface LoanRequest {
  id: string
  loan_amount: number
  loan_type: string
  interest_rate?: number
  loan_term_months?: number
  purpose?: string
  status: string
  priority: string
  submitted_at?: string
  approved_at?: string
  funded_at?: string
  notes?: string
  lender_id?: string
  created_at: string
}

interface LoanRequestManagerProps {
  leadId?: string
  clientId?: string
  loanRequests: LoanRequest[]
  onLoanRequestsUpdate: (requests: LoanRequest[]) => void
}

const loanTypes = [
  "SBA 7(a) Loan",
  "SBA 504 Loan", 
  "Bridge Loan",
  "Conventional Loan",
  "Equipment Financing",
  "USDA B&I Loan",
  "Working Capital Loan",
  "Line of Credit",
  "Land Loan",
  "Factoring"
]

const statuses = [
  "draft",
  "submitted", 
  "under_review",
  "approved",
  "denied",
  "funded"
]

const priorities = ["high", "medium", "low"]

export default function LoanRequestManager({ 
  leadId, 
  clientId, 
  loanRequests, 
  onLoanRequestsUpdate 
}: LoanRequestManagerProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newRequest, setNewRequest] = useState({
    loan_amount: "",
    loan_type: "SBA 7(a) Loan",
    interest_rate: "",
    loan_term_months: "",
    purpose: "",
    status: "draft",
    priority: "medium",
    notes: "",
    lender_id: ""
  })

  const addLoanRequest = async () => {
    if (!newRequest.loan_amount || !user) {
      toast({
        title: "Error",
        description: "Please fill in the loan amount",
        variant: "destructive",
      })
      return
    }

    try {
      const { data, error } = await supabase
        .from('loan_requests')
        .insert({
          lead_id: leadId || null,
          client_id: clientId || null,
          user_id: user.id,
          loan_amount: parseFloat(newRequest.loan_amount),
          loan_type: newRequest.loan_type,
          interest_rate: newRequest.interest_rate ? parseFloat(newRequest.interest_rate) : null,
          loan_term_months: newRequest.loan_term_months ? parseInt(newRequest.loan_term_months) : null,
          purpose: newRequest.purpose || null,
          status: newRequest.status,
          priority: newRequest.priority,
          notes: newRequest.notes || null,
          lender_id: newRequest.lender_id || null,
          submitted_at: newRequest.status === 'submitted' ? new Date().toISOString() : null
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Success",
        description: "Loan request added successfully",
      })

      // Reset form
      setNewRequest({
        loan_amount: "",
        loan_type: "SBA 7(a) Loan",
        interest_rate: "",
        loan_term_months: "",
        purpose: "",
        status: "draft",
        priority: "medium",
        notes: "",
        lender_id: ""
      })
      setShowAddDialog(false)

      // Update parent component
      onLoanRequestsUpdate([...loanRequests, data])
    } catch (error) {
      console.error('Error adding loan request:', error)
      toast({
        title: "Error",
        description: "Failed to add loan request",
        variant: "destructive",
      })
    }
  }

  const deleteLoanRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('loan_requests')
        .delete()
        .eq('id', requestId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Loan request deleted successfully",
      })

      // Update parent component
      onLoanRequestsUpdate(loanRequests.filter(req => req.id !== requestId))
    } catch (error) {
      console.error('Error deleting loan request:', error)
      toast({
        title: "Error",
        description: "Failed to delete loan request",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'submitted': return 'default'
      case 'under_review': return 'default'
      case 'approved': return 'default'
      case 'denied': return 'destructive'
      case 'funded': return 'default'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4" />
      case 'submitted': return <AlertCircle className="w-4 h-4" />
      case 'under_review': return <Clock className="w-4 h-4" />
      case 'approved': return <CheckCircle className="w-4 h-4" />
      case 'denied': return <XCircle className="w-4 h-4" />
      case 'funded': return <CheckCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Loan Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Loan Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="loan_amount">Loan Amount *</Label>
                  <Input
                    id="loan_amount"
                    type="number"
                    value={newRequest.loan_amount}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, loan_amount: e.target.value }))}
                    placeholder="250000"
                  />
                </div>
                <div>
                  <Label htmlFor="loan_type">Loan Type</Label>
                  <Select value={newRequest.loan_type} onValueChange={(value) => setNewRequest(prev => ({ ...prev, loan_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interest_rate">Interest Rate (%)</Label>
                  <Input
                    id="interest_rate"
                    type="number"
                    step="0.01"
                    value={newRequest.interest_rate}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, interest_rate: e.target.value }))}
                    placeholder="5.75"
                  />
                </div>
                <div>
                  <Label htmlFor="loan_term_months">Term (Months)</Label>
                  <Input
                    id="loan_term_months"
                    type="number"
                    value={newRequest.loan_term_months}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, loan_term_months: e.target.value }))}
                    placeholder="60"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="purpose">Purpose</Label>
                <Input
                  id="purpose"
                  value={newRequest.purpose}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, purpose: e.target.value }))}
                  placeholder="Business expansion, equipment purchase, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={newRequest.status} onValueChange={(value) => setNewRequest(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newRequest.priority} onValueChange={(value) => setNewRequest(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map(priority => (
                        <SelectItem key={priority} value={priority}>
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="lender">Lender</Label>
                <LenderSelect
                  value={newRequest.lender_id}
                  onChange={(lenderId) => setNewRequest(prev => ({ ...prev, lender_id: lenderId }))}
                  placeholder="Select lender (optional)"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newRequest.notes}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this loan request..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={addLoanRequest}>
                Add Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loanRequests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No loan requests found. Add one to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {loanRequests.map((request) => (
            <Card key={request.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {formatCurrency(request.loan_amount)}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteLoanRequest(request.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{request.loan_type}</span>
                  <span className="flex items-center gap-1 text-sm">
                    {getStatusIcon(request.status)}
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1).replace('_', ' ')}
                  </span>
                  <span className="text-sm">
                    {request.priority.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {request.interest_rate && (
                    <div>
                      <span className="text-muted-foreground">Interest Rate:</span>
                      <div className="font-medium">{request.interest_rate}%</div>
                    </div>
                  )}
                  {request.loan_term_months && (
                    <div>
                      <span className="text-muted-foreground">Term:</span>
                      <div className="font-medium">{request.loan_term_months} months</div>
                    </div>
                  )}
                </div>

                {request.purpose && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Purpose:</span>
                    <div className="font-medium">{request.purpose}</div>
                  </div>
                )}

                {request.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes:</span>
                    <div className="font-medium">{request.notes}</div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Created: {new Date(request.created_at).toLocaleDateString()}
                  {request.submitted_at && (
                    <span className="ml-4">
                      Submitted: {new Date(request.submitted_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}