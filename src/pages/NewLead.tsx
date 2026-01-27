import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StandardPageLayout } from "@/components/StandardPageLayout"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardContentCard } from "@/components/StandardContentCard"
import { ResponsiveContainer } from "@/components/ResponsiveContainer"
import { LOAN_TYPES, STAGES, PRIORITIES } from "@/types/lead"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/components/auth/AuthProvider"
import { useSecureForm } from "@/hooks/useSecureForm"
import { User, Building2, DollarSign, CreditCard, Landmark, FileText, UserPlus } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export default function NewLead() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null }>>([])
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobilePhone: "",
    personalEmail: "",
    homeAddress: "",
    homeCity: "",
    homeState: "",
    homeZipCode: "",
    
    // Business Information
    businessName: "",
    businessAddress: "",
    businessCity: "",
    businessState: "",
    businessZipCode: "",
    yearEstablished: "",
    naicsCode: "",
    ownershipStructure: "",
    ownershipPercentage: "",
    
    // Financial Information
    annualRevenue: "",
    income: "",
    creditScore: "",
    existingLoanAmount: "",
    netOperatingIncome: "",
    propertyPaymentAmount: "",
    ownsProperty: false,
    
    // Loan Information
    loanAmount: "",
    loanType: "",
    interestRate: "",
    
    // Merchant Processing
    posSystem: "",
    processorName: "",
    currentProcessingRate: "",
    monthlyProcessingVolume: "",
    averageTransactionSize: "",
    
    // Banking & BDO
    bdoName: "",
    bdoTelephone: "",
    bdoEmail: "",
    bankLenderName: "",
    
    // Lead Management
    stage: "Initial Contact",
    priority: "Medium",
    notes: "",
    callNotes: ""
  })

  const [displayValues, setDisplayValues] = useState({
    income: "",
    annualRevenue: "",
    existingLoanAmount: "",
    netOperatingIncome: "",
    propertyPaymentAmount: ""
  })

  const formatCurrencyInput = (value: string): string => {
    const numbers = value.replace(/[^0-9]/g, '')
    if (!numbers) return ''
    return Number(numbers).toLocaleString('en-US')
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleCurrencyChange = (field: string, value: string) => {
    const numbers = value.replace(/[^0-9]/g, '')
    setFormData(prev => ({ ...prev, [field]: numbers }))
    setDisplayValues(prev => ({ ...prev, [field]: formatCurrencyInput(value) }))
  }

  const { validateFormData, sanitizeNumeric } = useSecureForm()

  // Fetch users for assignment dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('is_active', true)
        .order('first_name')
      
      if (!error && data) {
        setUsers(data)
      }
    }
    fetchUsers()
  }, [])

  const handleSubmit = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast({
        title: "Required Fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create a lead",
        variant: "destructive"
      })
      return
    }

    // Server-side validation and sanitization of critical fields
    const { isValid, sanitizedData, errors } = await validateFormData({
      email: formData.email,
      phone: formData.phone,
      business_name: formData.businessName,
      business_address: formData.businessAddress,
      notes: formData.notes || '',
      call_notes: formData.callNotes || '',
      credit_score: formData.creditScore || ''
    })

    if (!isValid) {
      const errList = Object.values(errors).flat().slice(0, 4).join(', ')
      toast({
        title: "Validation Error",
        description: errList || "Please correct the highlighted fields",
        variant: "destructive"
      })
      return
    }

    // Sanitize numeric amounts
    const sanitizeNumber = async (v?: string) => {
      if (!v) return undefined
      const res = await sanitizeNumeric(String(v))
      const cleaned = res.sanitized?.replace(/[^0-9.\-]/g, '')
      const num = cleaned ? Number(cleaned) : undefined
      return Number.isFinite(num!) ? num : undefined
    }

    const annual_revenue = await sanitizeNumber(formData.annualRevenue)
    const income = await sanitizeNumber(formData.income)
    const existing_loan_amount = await sanitizeNumber(formData.existingLoanAmount)
    const net_operating_income = await sanitizeNumber(formData.netOperatingIncome)
    const property_payment_amount = await sanitizeNumber(formData.propertyPaymentAmount)
    const loan_amount = await sanitizeNumber(formData.loanAmount)
    const interest_rate = await sanitizeNumber(formData.interestRate)
    const ownership_percentage = await sanitizeNumber(formData.ownershipPercentage)
    const current_processing_rate = await sanitizeNumber(formData.currentProcessingRate)
    const monthly_processing_volume = await sanitizeNumber(formData.monthlyProcessingVolume)
    const average_transaction_size = await sanitizeNumber(formData.averageTransactionSize)
    const credit_score = sanitizedData.credit_score ? Number(sanitizedData.credit_score) : undefined

    try {
      // Create contact entity with sanitized fields
      const contactData = {
        // Personal fields
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: sanitizedData.email,
        personal_email: formData.personalEmail?.trim() || null,
        phone: sanitizedData.phone || null,
        mobile_phone: formData.mobilePhone?.trim() || null,
        home_address: formData.homeAddress?.trim() || null,
        home_city: formData.homeCity?.trim() || null,
        home_state: formData.homeState?.trim() || null,
        home_zip_code: formData.homeZipCode?.trim() || null,
        
        // Business fields
        business_name: sanitizedData.business_name || formData.businessName?.trim() || null,
        business_address: sanitizedData.business_address || formData.businessAddress?.trim() || null,
        business_city: formData.businessCity?.trim() || null,
        business_state: formData.businessState?.trim() || null,
        business_zip_code: formData.businessZipCode?.trim() || null,
        year_established: formData.yearEstablished ? Number(formData.yearEstablished) : undefined,
        naics_code: formData.naicsCode?.trim() || null,
        ownership_structure: formData.ownershipStructure?.trim() || null,
        ownership_percentage,
        
        // Financial fields
        annual_revenue,
        income,
        credit_score,
        existing_loan_amount,
        net_operating_income,
        property_payment_amount,
        owns_property: !!formData.ownsProperty,
        
        // Loan fields
        loan_amount,
        loan_type: formData.loanType || null,
        interest_rate,
        
        // Merchant processing
        pos_system: formData.posSystem || null,
        processor_name: formData.processorName || null,
        current_processing_rate,
        monthly_processing_volume,
        average_transaction_size,
        
        // Banking & BDO
        bdo_name: formData.bdoName || null,
        bdo_telephone: formData.bdoTelephone || null,
        bdo_email: formData.bdoEmail || null,
        bank_lender_name: formData.bankLenderName || null,
        
        // Lead management
        priority: formData.priority.toLowerCase(),
        stage: formData.stage,
        notes: sanitizedData.notes || null,
        call_notes: sanitizedData.call_notes || null,
        user_id: user.id
      }

      const { data: contactEntity, error: contactError } = await supabase
        .from('contact_entities')
        .insert(contactData)
        .select()
        .single()

      if (contactError) {
        throw new Error(`Failed to create contact: ${contactError.message}`)
      }

      // Create lead record (assigned to selected user or unassigned)
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_id: assignedUserId,
          contact_entity_id: contactEntity.id
        })
        .select()
        .single()

      if (leadError) {
        throw new Error(`Failed to create lead: ${leadError.message}`)
      }

      // Create audit log entry for lead creation
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: 'lead_created',
          table_name: 'leads',
          record_id: leadData.id,
          new_values: {
            name: `${formData.firstName} ${formData.lastName}`,
            business_name: sanitizedData.business_name || formData.businessName,
            email: sanitizedData.email,
            phone: sanitizedData.phone
          }
        })

      toast({
        title: "Lead Created",
        description: "New lead has been added to your pipeline",
      })

      navigate(`/leads/${leadData.id}`)

    } catch (error: any) {
      console.error('Error creating lead:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create lead",
        variant: "destructive"
      })
    }
  }

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Create New Lead"
        subtitle="Add a new lead to your SBA & Commercial Loan pipeline"
      />
      <ResponsiveContainer>
        <div className="p-6 lg:p-8 space-y-6 animate-fade-in max-w-[1600px] mx-auto">
        
        {/* Lead Assignment */}
        <StandardContentCard 
          title={
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <span>Lead Assignment</span>
            </div>
          }
          className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assign this lead to a team member or leave unassigned for later assignment
            </p>
            <Separator className="my-4" />
            <div className="space-y-2">
              <Label htmlFor="assignedUser" className="text-sm font-semibold">Assign To</Label>
              <Select value={assignedUserId || "unassigned"} onValueChange={(value) => setAssignedUserId(value === "unassigned" ? null : value)}>
                <SelectTrigger id="assignedUser" className="h-11">
                  <SelectValue placeholder="Select user or leave unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned (will appear in Lead Assignment)</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </StandardContentCard>
        
        {/* Row 1: Personal, Financial, and Business Information */}
        <div className="grid gap-6 lg:grid-cols-3">
          <StandardContentCard 
            title={
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <span>Personal Information</span>
              </div>
            }
            className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Basic borrower details and contact information
              </p>
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-semibold">First Name *</Label>
                    <Input 
                      id="firstName" 
                      placeholder="Enter first name"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-semibold">Last Name *</Label>
                    <Input 
                      id="lastName" 
                      placeholder="Enter last name"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">Email Address *</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-semibold">Phone Number</Label>
                    <Input 
                      id="phone" 
                      placeholder="(555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobilePhone" className="text-sm font-semibold">Mobile Phone</Label>
                    <Input 
                      id="mobilePhone" 
                      placeholder="(555) 987-6543"
                      value={formData.mobilePhone}
                      onChange={(e) => handleInputChange("mobilePhone", e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="personalEmail" className="text-sm font-semibold">Personal Email</Label>
                  <Input 
                    id="personalEmail" 
                    type="email" 
                    placeholder="Personal email address"
                    value={formData.personalEmail}
                    onChange={(e) => handleInputChange("personalEmail", e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="homeAddress" className="text-sm font-semibold">Home Address</Label>
                  <Input 
                    id="homeAddress" 
                    placeholder="123 Main St"
                    value={formData.homeAddress}
                    onChange={(e) => handleInputChange("homeAddress", e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="homeCity" className="text-sm font-semibold">City</Label>
                    <Input 
                      id="homeCity" 
                      placeholder="City"
                      value={formData.homeCity}
                      onChange={(e) => handleInputChange("homeCity", e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="homeState" className="text-sm font-semibold">State</Label>
                    <Input 
                      id="homeState" 
                      placeholder="State"
                      value={formData.homeState}
                      onChange={(e) => handleInputChange("homeState", e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="homeZipCode" className="text-sm font-semibold">Zip Code</Label>
                    <Input 
                      id="homeZipCode" 
                      placeholder="ZIP"
                      value={formData.homeZipCode}
                      onChange={(e) => handleInputChange("homeZipCode", e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>
              </div>
            </div>
          </StandardContentCard>

          <StandardContentCard 
            title={
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span>Financial Information</span>
              </div>
            }
            className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Income, employment, and financial details
              </p>
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="income">Annual Income</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        id="income" 
                        type="text"
                        placeholder="75,000"
                        value={displayValues.income}
                        onChange={(e) => handleCurrencyChange("income", e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annualRevenue">Annual Revenue</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        id="annualRevenue" 
                        type="text"
                        placeholder="500,000"
                        value={displayValues.annualRevenue}
                        onChange={(e) => handleCurrencyChange("annualRevenue", e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="creditScore">Credit Score</Label>
                    <Input 
                      id="creditScore" 
                      type="number"
                      placeholder="750"
                      value={formData.creditScore}
                      onChange={(e) => handleInputChange("creditScore", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="existingLoanAmount">Existing Loan Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        id="existingLoanAmount" 
                        type="text"
                        placeholder="50,000"
                        value={displayValues.existingLoanAmount}
                        onChange={(e) => handleCurrencyChange("existingLoanAmount", e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="netOperatingIncome">Net Operating Income</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        id="netOperatingIncome" 
                        type="text"
                        placeholder="100,000"
                        value={displayValues.netOperatingIncome}
                        onChange={(e) => handleCurrencyChange("netOperatingIncome", e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="propertyPaymentAmount">Property Payment</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        id="propertyPaymentAmount" 
                        type="text"
                        placeholder="2,500"
                        value={displayValues.propertyPaymentAmount}
                        onChange={(e) => handleCurrencyChange("propertyPaymentAmount", e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ownsProperty"
                    checked={formData.ownsProperty}
                    onChange={(e) => handleInputChange("ownsProperty", e.target.checked)}
                    className="rounded border-input"
                  />
                  <Label htmlFor="ownsProperty" className="font-normal cursor-pointer">
                    Owns Property
                  </Label>
                </div>
              </div>
            </div>
          </StandardContentCard>

          <StandardContentCard 
            title={
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span>Business Information</span>
              </div>
            }
            className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Details about the borrower's business
              </p>
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input 
                    id="businessName" 
                    placeholder="Enter business name"
                    value={formData.businessName}
                    onChange={(e) => handleInputChange("businessName", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Input 
                    id="businessAddress" 
                    placeholder="Enter business address"
                    value={formData.businessAddress}
                    onChange={(e) => handleInputChange("businessAddress", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessCity">City</Label>
                    <Input 
                      id="businessCity" 
                      placeholder="City"
                      value={formData.businessCity}
                      onChange={(e) => handleInputChange("businessCity", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessState">State</Label>
                    <Input 
                      id="businessState" 
                      placeholder="State"
                      value={formData.businessState}
                      onChange={(e) => handleInputChange("businessState", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessZipCode">Zip Code</Label>
                    <Input 
                      id="businessZipCode" 
                      placeholder="ZIP"
                      value={formData.businessZipCode}
                      onChange={(e) => handleInputChange("businessZipCode", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="yearEstablished">Year</Label>
                    <Input 
                      id="yearEstablished" 
                      type="number"
                      placeholder="YYYY"
                      min="1950"
                      max="2100"
                      value={formData.yearEstablished}
                      onChange={(e) => handleInputChange("yearEstablished", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="naicsCode">NAICS Code</Label>
                    <Input 
                      id="naicsCode" 
                      placeholder="Enter NAICS code"
                      value={formData.naicsCode}
                      onChange={(e) => handleInputChange("naicsCode", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ownershipStructure">Ownership Structure</Label>
                    <Select value={formData.ownershipStructure} onValueChange={(value) => handleInputChange("ownershipStructure", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select structure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                        <SelectItem value="Partnership">Partnership</SelectItem>
                        <SelectItem value="LLC">LLC</SelectItem>
                        <SelectItem value="Corporation">Corporation</SelectItem>
                        <SelectItem value="S-Corp">S-Corp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownershipPercentage">Ownership %</Label>
                    <Input 
                      id="ownershipPercentage" 
                      type="number"
                      placeholder="100"
                      value={formData.ownershipPercentage}
                      onChange={(e) => handleInputChange("ownershipPercentage", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </StandardContentCard>
        </div>

        {/* Row 2: Loan, Merchant Processing, and Banking/BDO Information */}
        <div className="grid gap-6 lg:grid-cols-3">
          <StandardContentCard 
            title={
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span>Loan Information</span>
              </div>
            }
            className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Loan requirements and financial details
              </p>
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="loanAmount">Loan Amount</Label>
                    <Input 
                      id="loanAmount" 
                      type="number"
                      placeholder="$250,000"
                      value={formData.loanAmount}
                      onChange={(e) => handleInputChange("loanAmount", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loanType">Loan Type</Label>
                    <Select value={formData.loanType} onValueChange={(value) => handleInputChange("loanType", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select loan type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOAN_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interestRate">Interest Rate (%)</Label>
                  <Input 
                    id="interestRate" 
                    type="number"
                    step="0.01"
                    placeholder="5.5"
                    value={formData.interestRate}
                    onChange={(e) => handleInputChange("interestRate", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stage">Loan Stage</Label>
                    <Select value={formData.stage} onValueChange={(value) => handleInputChange("stage", value)}>
                      <SelectTrigger className="bg-[#0f62fe] text-white hover:bg-[#0353e9]">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.filter(stage => stage !== "All").map((stage) => (
                          <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
                      <SelectTrigger className="bg-[#0f62fe] text-white hover:bg-[#0353e9]">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.filter(priority => priority !== "All").map((priority) => (
                          <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </StandardContentCard>

          <StandardContentCard 
            title={
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                <span>Merchant Processing</span>
              </div>
            }
            className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Point of sale and processing information
              </p>
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="posSystem">POS System</Label>
                  <Input 
                    id="posSystem" 
                    placeholder="e.g., Square, Clover"
                    value={formData.posSystem}
                    onChange={(e) => handleInputChange("posSystem", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="processorName">Processor Name</Label>
                  <Input 
                    id="processorName" 
                    placeholder="Payment processor"
                    value={formData.processorName}
                    onChange={(e) => handleInputChange("processorName", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentProcessingRate">Current Processing Rate (%)</Label>
                  <Input 
                    id="currentProcessingRate" 
                    type="number"
                    step="0.01"
                    placeholder="2.9"
                    value={formData.currentProcessingRate}
                    onChange={(e) => handleInputChange("currentProcessingRate", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthlyProcessingVolume">Monthly Volume</Label>
                    <Input 
                      id="monthlyProcessingVolume" 
                      type="number"
                      placeholder="$50,000"
                      value={formData.monthlyProcessingVolume}
                      onChange={(e) => handleInputChange("monthlyProcessingVolume", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="averageTransactionSize">Avg Transaction</Label>
                    <Input 
                      id="averageTransactionSize" 
                      type="number"
                      placeholder="$75"
                      value={formData.averageTransactionSize}
                      onChange={(e) => handleInputChange("averageTransactionSize", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </StandardContentCard>

          <StandardContentCard 
            title={
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span>Banking & BDO Information</span>
              </div>
            }
            className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Banking relationship and business development officer details
              </p>
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bankLenderName">Bank / Lender Name</Label>
                  <Input 
                    id="bankLenderName" 
                    placeholder="Enter bank name"
                    value={formData.bankLenderName}
                    onChange={(e) => handleInputChange("bankLenderName", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bdoName">BDO Name</Label>
                  <Input 
                    id="bdoName" 
                    placeholder="Business development officer"
                    value={formData.bdoName}
                    onChange={(e) => handleInputChange("bdoName", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bdoTelephone">BDO Telephone</Label>
                    <Input 
                      id="bdoTelephone" 
                      placeholder="(555) 123-4567"
                      value={formData.bdoTelephone}
                      onChange={(e) => handleInputChange("bdoTelephone", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bdoEmail">BDO Email</Label>
                    <Input 
                      id="bdoEmail" 
                      type="email"
                      placeholder="bdo@bank.com"
                      value={formData.bdoEmail}
                      onChange={(e) => handleInputChange("bdoEmail", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </StandardContentCard>
        </div>

        {/* Row 4: Notes Section - Full Width */}
        <StandardContentCard 
          title={
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span>Additional Notes</span>
            </div>
          }
          className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Any additional information or comments
            </p>
            <Separator className="my-4" />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-semibold">General Notes</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Enter any additional notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="callNotes" className="text-sm font-semibold">Call Notes</Label>
                <Textarea 
                  id="callNotes" 
                  placeholder="Notes from phone conversations"
                  value={formData.callNotes}
                  onChange={(e) => handleInputChange("callNotes", e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </div>
        </StandardContentCard>

        {/* Actions */}
        <div className="flex gap-4 justify-end pb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/leads')}
            className="min-w-[120px]"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            className="min-w-[120px] bg-primary hover:bg-primary/90"
          >
            Create Lead
          </Button>
        </div>
      </div>
    </ResponsiveContainer>
  </StandardPageLayout>
  )
}
