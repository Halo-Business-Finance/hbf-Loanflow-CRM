import { useState, useEffect } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardContentCard } from "@/components/StandardContentCard"
import { useToast } from "@/hooks/use-toast"
import { ibmDb } from "@/lib/ibm"
import { useAuth } from "@/components/auth/AuthProvider"
import { User, Briefcase, Phone, Mail, FileText } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

export default function NewLenderContact() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { id: lenderId } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lenderName, setLenderName] = useState<string>("")
  
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
    mobile_phone: "",
    notes: "",
    is_active: true
  })

  // Fetch lender name for display
  useEffect(() => {
    const fetchLender = async () => {
      if (!lenderId) return
      
      const { data, error } = await ibmDb
        .from('lenders')
        .select('name')
        .eq('id', lenderId)
        .single()
      
      if (!error && data) {
        setLenderName(String((data as any).name))
      }
    }
    
    fetchLender()
  }, [lenderId])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add a contact",
        variant: "destructive"
      })
      return
    }

    if (!lenderId) {
      toast({
        title: "Error",
        description: "Lender ID is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Contact name is required",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await ibmDb.from('lender_contacts').insert([{
        lender_id: lenderId,
        name: formData.name.trim(),
        title: formData.title.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        mobile_phone: formData.mobile_phone.trim() || null,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
        user_id: user.id,
      }])

      if (error) throw error

      toast({
        title: "Success",
        description: "Contact added successfully"
      })
      
      navigate(`/lenders/${lenderId}`)
    } catch (error: any) {
      console.error('Error creating contact:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create contact",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Add New Contact"
        subtitle={lenderName ? `Add a contact for ${lenderName}` : "Add a new lender contact"}
      />

      <div className="p-8">
        <form onSubmit={handleSubmit} className="max-w-5xl space-y-8">
          {/* Basic Information */}
          <StandardContentCard
            title={
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <span>Basic Information</span>
              </div>
            }
            className="border-l-4 border-l-primary"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter full name"
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Title / Position
                  </Label>
                  <Select
                    value={formData.title}
                    onValueChange={(value) => handleInputChange("title", value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="Business Development Officer">Business Development Officer</SelectItem>
                      <SelectItem value="Loan Officer">Loan Officer</SelectItem>
                      <SelectItem value="Senior Loan Officer">Senior Loan Officer</SelectItem>
                      <SelectItem value="Branch Manager">Branch Manager</SelectItem>
                      <SelectItem value="Vice President">Vice President</SelectItem>
                      <SelectItem value="Senior Vice President">Senior Vice President</SelectItem>
                      <SelectItem value="President">President</SelectItem>
                      <SelectItem value="Underwriter">Underwriter</SelectItem>
                      <SelectItem value="Loan Processor">Loan Processor</SelectItem>
                      <SelectItem value="Loan Closer">Loan Closer</SelectItem>
                      <SelectItem value="Portfolio Manager">Portfolio Manager</SelectItem>
                      <SelectItem value="Credit Analyst">Credit Analyst</SelectItem>
                      <SelectItem value="Relationship Manager">Relationship Manager</SelectItem>
                      <SelectItem value="Commercial Lender">Commercial Lender</SelectItem>
                      <SelectItem value="SBA Specialist">SBA Specialist</SelectItem>
                      <SelectItem value="Operations Manager">Operations Manager</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleInputChange("is_active", checked)}
                />
                <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                  Active Contact
                </Label>
              </div>
            </div>
          </StandardContentCard>

          <Separator />

          {/* Contact Information */}
          <StandardContentCard
            title={
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                <span>Contact Information</span>
              </div>
            }
            className="border-l-4 border-l-primary"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Office Phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="(555) 123-4567"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile_phone" className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Mobile Phone
                </Label>
                <Input
                  id="mobile_phone"
                  type="tel"
                  value={formData.mobile_phone}
                  onChange={(e) => handleInputChange("mobile_phone", e.target.value)}
                  placeholder="(555) 987-6543"
                  className="h-11"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="contact@lender.com"
                  className="h-11"
                />
              </div>
            </div>
          </StandardContentCard>

          {/* Additional Details */}
          <StandardContentCard
            title={
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span>Additional Details</span>
              </div>
            }
            className="border-l-4 border-l-primary"
          >
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Add any additional information about this contact..."
                rows={5}
                className="resize-none"
              />
            </div>
          </StandardContentCard>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/lenders/${lenderId}`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Contact"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
