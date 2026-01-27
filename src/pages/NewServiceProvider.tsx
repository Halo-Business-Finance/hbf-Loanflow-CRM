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
import { Building2, MapPin, Phone, Mail, Globe, FileText, User, Plus } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

const PROVIDER_TYPES = [
  { value: "title", label: "Title Company" },
  { value: "escrow", label: "Escrow Company" },
  { value: "both", label: "Title & Escrow" }
]

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
]

export default function NewServiceProvider() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    name: "",
    provider_type: "",
    contact_person: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    service_areas: [] as string[],
    certifications: [] as string[],
    average_closing_days: "",
    success_rate: "",
    notes: "",
    is_active: true
  })

  const [serviceAreaInput, setServiceAreaInput] = useState("")
  const [certificationInput, setCertificationInput] = useState("")

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addServiceArea = () => {
    if (serviceAreaInput.trim()) {
      setFormData(prev => ({
        ...prev,
        service_areas: [...prev.service_areas, serviceAreaInput.trim()]
      }))
      setServiceAreaInput("")
    }
  }

  const removeServiceArea = (index: number) => {
    setFormData(prev => ({
      ...prev,
      service_areas: prev.service_areas.filter((_, i) => i !== index)
    }))
  }

  const addCertification = () => {
    if (certificationInput.trim()) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, certificationInput.trim()]
      }))
      setCertificationInput("")
    }
  }

  const removeCertification = (index: number) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add a service provider",
        variant: "destructive"
      })
      return
    }

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required",
        variant: "destructive"
      })
      return
    }

    if (!formData.provider_type) {
      toast({
        title: "Validation Error",
        description: "Provider type is required",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.from('service_providers').insert([{
        name: formData.name.trim(),
        provider_type: formData.provider_type,
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        website: formData.website.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state || null,
        zip_code: formData.zip_code.trim() || null,
        service_areas: formData.service_areas.length > 0 ? formData.service_areas : null,
        certifications: formData.certifications.length > 0 ? formData.certifications : null,
        average_closing_days: formData.average_closing_days ? parseInt(formData.average_closing_days) : null,
        success_rate: formData.success_rate ? parseFloat(formData.success_rate) : null,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active
      }])

      if (error) throw error

      toast({
        title: "Success",
        description: "Service provider added successfully"
      })
      
      navigate('/service-providers')
    } catch (error: any) {
      console.error('Error creating service provider:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create service provider",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <IBMPageHeader
        title="Add New Service Provider"
        subtitle="Create a new title or escrow company record"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <StandardContentCard 
          title="Company Information"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter company name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider_type">Provider Type *</Label>
              <Select value={formData.provider_type} onValueChange={(value) => handleInputChange('provider_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider type" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => handleInputChange('contact_person', e.target.value)}
                placeholder="Enter contact person name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="(555) 555-5555"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="contact@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://www.company.com"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active">Active Provider</Label>
            </div>
          </div>
        </StandardContentCard>

        {/* Location Information */}
        <StandardContentCard 
          title="Location"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="123 Main Street"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Enter city"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select value={formData.state} onValueChange={(value) => handleInputChange('state', value)}>
                <SelectTrigger>
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
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => handleInputChange('zip_code', e.target.value)}
                placeholder="12345"
                maxLength={10}
              />
            </div>
          </div>
        </StandardContentCard>

        {/* Service Details */}
        <StandardContentCard 
          title="Service Details"
        >
          <div className="space-y-6">
            {/* Service Areas */}
            <div className="space-y-2">
              <Label>Service Areas</Label>
              <div className="flex gap-2">
                <Input
                  value={serviceAreaInput}
                  onChange={(e) => setServiceAreaInput(e.target.value)}
                  placeholder="Enter service area (e.g., Los Angeles County)"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addServiceArea())}
                />
                <Button type="button" onClick={addServiceArea}>Add</Button>
              </div>
              {formData.service_areas.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.service_areas.map((area, index) => (
                    <div key={index} className="flex items-center gap-2 bg-muted px-3 py-1 rounded-md">
                      <span className="text-sm">{area}</span>
                      <button
                        type="button"
                        onClick={() => removeServiceArea(index)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certifications */}
            <div className="space-y-2">
              <Label>Certifications</Label>
              <div className="flex gap-2">
                <Input
                  value={certificationInput}
                  onChange={(e) => setCertificationInput(e.target.value)}
                  placeholder="Enter certification"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
                />
                <Button type="button" onClick={addCertification}>Add</Button>
              </div>
              {formData.certifications.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.certifications.map((cert, index) => (
                    <div key={index} className="flex items-center gap-2 bg-muted px-3 py-1 rounded-md">
                      <span className="text-sm">{cert}</span>
                      <button
                        type="button"
                        onClick={() => removeCertification(index)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="average_closing_days">Average Closing Days</Label>
                <Input
                  id="average_closing_days"
                  type="number"
                  min="0"
                  value={formData.average_closing_days}
                  onChange={(e) => handleInputChange('average_closing_days', e.target.value)}
                  placeholder="30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="success_rate">Success Rate (%)</Label>
                <Input
                  id="success_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.success_rate}
                  onChange={(e) => handleInputChange('success_rate', e.target.value)}
                  placeholder="95.5"
                />
              </div>
            </div>
          </div>
        </StandardContentCard>

        {/* Notes */}
        <StandardContentCard 
          title="Additional Notes"
        >
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Add any additional notes or comments..."
              rows={4}
            />
          </div>
        </StandardContentCard>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/service-providers')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Service Provider"}
          </Button>
        </div>
      </form>
    </div>
  )
}
