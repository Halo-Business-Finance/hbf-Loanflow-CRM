import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { EmailComposer } from "./EmailComposer"
import { ClickablePhone } from "./ui/clickable-phone"
import { 
  User, 
  Mail, 
  Phone, 
  CreditCard, 
  Percent,
  Edit,
  Save,
  X,
  Trash2
} from "lucide-react"

interface AdditionalBorrower {
  id: string
  first_name?: string
  last_name?: string
  personal_email?: string
  mobile_phone?: string
  email?: string
  phone?: string
  credit_score?: number
  ownership_percentage?: number
}

interface AdditionalBorrowerCardProps {
  borrower: AdditionalBorrower
  borrowerNumber: number
  isEditing: boolean
  onUpdate?: (borrower: AdditionalBorrower) => void
  onDelete?: (borrowerId: string) => void
  onStartEdit?: () => void
  onCancelEdit?: () => void
  onSave?: () => void
}

export function AdditionalBorrowerCard({
  borrower,
  borrowerNumber,
  isEditing,
  onUpdate,
  onDelete,
  onStartEdit,
  onCancelEdit,
  onSave
}: AdditionalBorrowerCardProps) {
  const [editableFields, setEditableFields] = useState(borrower)

  const handleFieldChange = (field: keyof AdditionalBorrower, value: string | number) => {
    const updatedBorrower = { ...editableFields, [field]: value }
    setEditableFields(updatedBorrower)
    onUpdate?.(updatedBorrower)
  }

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-foreground">
              Additional Borrower {borrowerNumber}
            </CardTitle>
            <span className="text-sm font-medium">Co-Applicant</span>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                {onSave && (
                  <Button
                    size="sm"
                    onClick={onSave}
                    className="text-xs"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                )}
                {onCancelEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCancelEdit}
                    className="text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                )}
              </>
            ) : (
              <>
                {onStartEdit && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={onStartEdit}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDelete(borrower.id)}
                    className="text-xs"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">First Name</p>
                  {isEditing ? (
                    <Input
                      value={editableFields.first_name || ""}
                      onChange={(e) => handleFieldChange('first_name', e.target.value)}
                      placeholder="Enter first name"
                    />
                  ) : (
                    <p className="font-medium text-foreground">{borrower.first_name || 'N/A'}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Last Name</p>
                  {isEditing ? (
                    <Input
                      value={editableFields.last_name || ""}
                      onChange={(e) => handleFieldChange('last_name', e.target.value)}
                      placeholder="Enter last name"
                    />
                  ) : (
                    <p className="font-medium text-foreground">{borrower.last_name || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Personal Email</p>
                {isEditing ? (
                  <Input
                    type="email"
                    value={editableFields.personal_email || ""}
                    onChange={(e) => handleFieldChange('personal_email', e.target.value)}
                    placeholder="Enter personal email"
                  />
                ) : (
                  borrower.personal_email ? (
                    <EmailComposer 
                      trigger={
                        <button className="font-medium hover:text-primary transition-colors text-left text-foreground">
                          {borrower.personal_email}
                        </button>
                      }
                    />
                  ) : (
                    <p className="font-medium text-foreground">N/A</p>
                  )
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-muted-foreground mt-1" />
              <div className="flex-1 space-y-1">
                <p className="text-sm text-muted-foreground">Mobile Phone</p>
                {isEditing ? (
                  <Input
                    value={editableFields.mobile_phone || ""}
                    onChange={(e) => handleFieldChange('mobile_phone', e.target.value)}
                    placeholder="Enter mobile phone number"
                    type="tel"
                  />
                ) : (
                  <div>
                    {borrower.mobile_phone ? (
                      <ClickablePhone 
                        phoneNumber={borrower.mobile_phone}
                        className="font-medium"
                      />
                    ) : (
                      <p className="font-medium text-foreground">N/A</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Experian Credit Score</p>
                {isEditing ? (
                  <Input
                    type="number"
                    value={editableFields.credit_score || ""}
                    onChange={(e) => handleFieldChange('credit_score', parseInt(e.target.value) || 0)}
                    placeholder="Enter credit score"
                    min="300"
                    max="850"
                  />
                ) : (
                  <p className="font-medium text-foreground">{borrower.credit_score || 'N/A'}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Company Email</p>
                {isEditing ? (
                  <Input
                    type="email"
                    value={editableFields.email || ""}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="Enter company email"
                  />
                ) : (
                  borrower.email ? (
                    <EmailComposer 
                      trigger={
                        <button className="font-medium hover:text-primary transition-colors text-left text-foreground">
                          {borrower.email}
                        </button>
                      }
                    />
                  ) : (
                    <p className="font-medium text-foreground">N/A</p>
                  )
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-muted-foreground mt-1" />
              <div className="flex-1 space-y-1">
                <p className="text-sm text-muted-foreground">Company Phone</p>
                {isEditing ? (
                  <Input
                    value={editableFields.phone || ""}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="Enter company phone number"
                  />
                ) : (
                  <div>
                    {borrower.phone ? (
                      <ClickablePhone 
                        phoneNumber={borrower.phone}
                        className="font-medium"
                      />
                    ) : (
                      <p className="font-medium text-foreground">N/A</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Percent className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Ownership Percentage</p>
                {isEditing ? (
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={editableFields.ownership_percentage || ""}
                    onChange={(e) => handleFieldChange('ownership_percentage', parseFloat(e.target.value) || 0)}
                    placeholder="Enter ownership percentage"
                  />
                ) : (
                  <p className="font-medium text-foreground">
                    {borrower.ownership_percentage ? `${borrower.ownership_percentage}%` : 'N/A'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}