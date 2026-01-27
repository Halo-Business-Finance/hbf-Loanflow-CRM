import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardContentCard } from "@/components/StandardContentCard"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/components/auth/AuthProvider"
import { Building2, MapPin, Phone, Mail, Globe, FileText } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

const LENDER_TYPES = [
  "Bank",
  "Credit Union",
  "Private Lender",
  "SBA Preferred Lender",
  "Alternative Lender",
  "Online Lender",
  "Mortgage Company",
  "Other"
]

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
]

export default function NewLender() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    name: "",
    lender_type: "",
    logo_url: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    notes: "",
    is_active: true
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add a lender",
        variant: "destructive"
      })
      return
    }

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Lender name is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.lender_type) {
      toast({
        title: "Validation Error",
        description: "Lender type is required",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.from('lenders').insert([{
        name: formData.name.trim(),
        lender_type: formData.lender_type,
        logo_url: formData.logo_url.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        website: formData.website.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state || null,
        zip_code: formData.zip_code.trim() || null,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
        user_id: user.id
      }])

      if (error) throw error

      toast({
        title: "Success",
        description: "Lender added successfully"
      })
      
      navigate('/lenders')
    } catch (error: any) {
      console.error('Error creating lender:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create lender",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Add New Lender"
        subtitle="Create a new lending partner in your system"
      />

      <div className="p-8">
        <form onSubmit={handleSubmit} className="max-w-5xl space-y-8">
          {/* Basic Information */}
          <StandardContentCard
            title={
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span>Basic Information</span>
              </div>
            }
            className="border-l-4 border-l-primary"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Lender Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter lender name"
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lender_type" className="text-sm font-medium">
                    Lender Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.lender_type}
                    onValueChange={(value) => handleInputChange("lender_type", value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select lender type" />
                    </SelectTrigger>
                    <SelectContent>
                      {LENDER_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url" className="text-sm font-medium">
                  Logo URL
                </Label>
                <Input
                  id="logo_url"
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => handleInputChange("logo_url", e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Enter the URL of the lender's logo image</p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleInputChange("is_active", checked)}
                />
                <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                  Active Lender
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
                  Phone Number
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="website" className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange("website", e.target.value)}
                  placeholder="https://www.lender.com"
                  className="h-11"
                />
              </div>
            </div>
          </StandardContentCard>

          <Separator />

          {/* Address Information */}
          <StandardContentCard
            title={
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span>Address Information</span>
              </div>
            }
            className="border-l-4 border-l-primary"
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium">
                  Street Address
                </Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="123 Main Street"
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="City"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state" className="text-sm font-medium">
                    State
                  </Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => handleInputChange("state", value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip_code" className="text-sm font-medium">
                    ZIP Code
                  </Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => handleInputChange("zip_code", e.target.value)}
                    placeholder="12345"
                    className="h-11"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
          </StandardContentCard>

          <Separator />

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
                placeholder="Add any additional information about this lender..."
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
              onClick={() => navigate('/lenders')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Lender"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
