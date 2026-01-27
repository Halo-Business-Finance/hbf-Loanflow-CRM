import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DialogFooter } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { Lead, ContactEntity, LOAN_TYPES, LEAD_SOURCES } from "@/types/lead"
import { useRoleBasedAccess } from "@/hooks/useRoleBasedAccess"
import { useSecureForm } from "@/hooks/useSecureForm"
import { toast } from "sonner"

interface LeadFormProps {
  lead?: Lead | null
  onSubmit: (data: ContactEntity) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function LeadForm({ lead, onSubmit, onCancel, isSubmitting = false }: LeadFormProps) {
  const { validateFormData } = useSecureForm()
  
  const [formData, setFormData] = useState<ContactEntity>({
    name: lead?.name || "",
    email: lead?.email || "",
    phone: lead?.phone || "",
    business_name: lead?.business_name || "",
    business_address: lead?.business_address || "",
    business_city: lead?.business_city || "",
    business_state: lead?.business_state || "",
    business_zip_code: lead?.business_zip_code || "",
    annual_revenue: lead?.annual_revenue || undefined,
    loan_amount: lead?.loan_amount || undefined,
    loan_type: lead?.loan_type || "SBA 7(a) Loan",
    credit_score: lead?.credit_score || undefined,
    net_operating_income: lead?.net_operating_income || undefined,
    source: lead?.source || "",
    priority: lead?.priority || "medium",
    stage: lead?.stage || "New Lead",
    notes: lead?.notes || "",
    naics_code: lead?.naics_code || "",
    ownership_structure: lead?.ownership_structure || ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Use secure form validation
      const validationResult = await validateFormData(formData)
      
      if (!validationResult.isValid) {
        // Display validation errors securely
        const errorMessages = Object.entries(validationResult.errors)
          .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
          .join('\n')
        
        toast.error('Form validation failed', {
          description: 'Please check your input and try again.'
        })
        console.warn('Validation errors:', errorMessages)
        return
      }
      
      // Submit sanitized data with proper typing
      await onSubmit(validationResult.sanitizedData as ContactEntity)
    } catch (error) {
      console.error('Form submission error:', error)
      toast.error('Submission failed', {
        description: 'Please try again or contact support.'
      })
    }
  }

  const handleInputChange = (field: keyof ContactEntity, value: any) => {
    // Update form data immediately for responsive UI
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{/* Make responsive grid */}
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone || ""}
            onChange={(e) => handleInputChange("phone", e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="business_name">Company Name</Label>
          <Input
            id="business_name"
            value={formData.business_name || ""}
            onChange={(e) => handleInputChange("business_name", e.target.value)}
          />
        </div>
        
        {/* Company Address - Full width on mobile */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="business_address">Company Address</Label>
          <div className="space-y-2">
            <Input
              id="business_address"
              value={formData.business_address || ""}
              onChange={(e) => handleInputChange("business_address", e.target.value)}
              placeholder="Street Address"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={formData.business_city || ""}
                onChange={(e) => handleInputChange("business_city", e.target.value)}
                placeholder="City"
              />
              <Input
                value={formData.business_state || ""}
                onChange={(e) => handleInputChange("business_state", e.target.value)}
                placeholder="State"
              />
            </div>
            <Input
              value={formData.business_zip_code || ""}
              onChange={(e) => handleInputChange("business_zip_code", e.target.value)}
              placeholder="ZIP Code"
              className="max-w-xs"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="loan_amount">Loan Amount</Label>
          <Input
            id="loan_amount"
            type="number"
            value={formData.loan_amount || ""}
            onChange={(e) => handleInputChange("loan_amount", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="loan_type">Loan Type</Label>
          <Select
            value={formData.loan_type || ""}
            onValueChange={(value) => handleInputChange("loan_type", value)}
          >
            <SelectTrigger>
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
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="credit_score">Credit Score (450-850)</Label>
          <Input
            id="credit_score"
            type="number"
            min="450"
            max="850"
            maxLength={3}
            value={formData.credit_score || ""}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : undefined;
              // Ensure only 3 digits and within range
              if (value === undefined || (value >= 450 && value <= 850 && e.target.value.length <= 3)) {
                handleInputChange("credit_score", value);
              }
            }}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="annual_revenue">Annual Revenue</Label>
          <Input
            id="annual_revenue"
            type="number"
            value={formData.annual_revenue || ""}
            onChange={(e) => handleInputChange("annual_revenue", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="source">Lead Source</Label>
          <Select
            value={formData.source || ""}
            onValueChange={(value) => handleInputChange("source", value)}
          >
            <SelectTrigger>
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="stage">Loan Stage</Label>
          <Select
            value={formData.stage || ""}
            onValueChange={(value) => handleInputChange("stage", value)}
          >
            <SelectTrigger>
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
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={formData.priority || ""}
            onValueChange={(value) => handleInputChange("priority", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Notes section - Full width */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes || ""}
          onChange={(e) => handleInputChange("notes", e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>
      
      {/* Footer buttons - Responsive */}
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {lead ? "Update Lead" : "Create Lead"}
        </Button>
      </DialogFooter>
    </form>
  )
}