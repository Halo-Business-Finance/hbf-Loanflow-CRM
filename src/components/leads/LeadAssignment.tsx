import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/components/auth/AuthProvider"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, Users, Save, X } from "lucide-react"

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
}

interface LeadAssignmentProps {
  leadId: string
  leadName: string
  currentAssignments?: {
    loan_originator_id?: string | null
    processor_id?: string | null
    underwriter_id?: string | null
  }
  onAssignmentUpdate?: () => void
  trigger?: React.ReactNode
}

export function LeadAssignment({ 
  leadId, 
  leadName, 
  currentAssignments = {}, 
  onAssignmentUpdate,
  trigger 
}: LeadAssignmentProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const { user, hasRole } = useAuth()
  const { toast } = useToast()

  // Assignment state - matches database schema
  const [assignments, setAssignments] = useState({
    loan_originator_id: currentAssignments.loan_originator_id || "",
    processor_id: currentAssignments.processor_id || "",
    underwriter_id: currentAssignments.underwriter_id || ""
  })

  // Fetch team members when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
      // Reset assignments to current values when opening
      setAssignments({
        loan_originator_id: currentAssignments.loan_originator_id || "",
        processor_id: currentAssignments.processor_id || "",
        underwriter_id: currentAssignments.underwriter_id || ""
      })
    }
  }, [isOpen, currentAssignments])

  const fetchTeamMembers = async () => {
    setLoading(true)
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          user_roles!inner(role, is_active)
        `)
        .eq('user_roles.is_active', true)
        .order('first_name')

      if (error) throw error

      const members: TeamMember[] = profiles?.map(profile => ({
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        role: Array.isArray(profile.user_roles) ? profile.user_roles[0]?.role || 'loan_originator' : 'loan_originator'
      })) || []

      setTeamMembers(members)
    } catch (error) {
      console.error('Error fetching team members:', error)
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAssignmentChange = (role: string, userId: string) => {
    setAssignments(prev => ({
      ...prev,
      [`${role}_id`]: userId === "unassigned" ? "" : userId
    }))
  }

  const saveAssignments = async () => {
    if (!hasRole('manager') && !hasRole('admin') && !hasRole('super_admin')) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to assign leads",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      // Prepare the update object, converting empty strings to null
      const updateData = {
        loan_originator_id: assignments.loan_originator_id || null,
        processor_id: assignments.processor_id || null,
        underwriter_id: assignments.underwriter_id || null,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Update the lead
      const { error: leadError } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId)

      if (leadError) throw leadError

      // Note: Assignment fields only exist on leads table, not contact_entities

      toast({
        title: "Success",
        description: `Team assignments updated for ${leadName}`,
      })

      setIsOpen(false)
      onAssignmentUpdate?.()
    } catch (error) {
      console.error('Error saving assignments:', error)
      toast({
        title: "Error",
        description: "Failed to save team assignments",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const getTeamMembersByRole = (targetRole: string) => {
    return teamMembers.filter(member => {
      switch (targetRole) {
        case 'loan_originator':
          return ['loan_originator', 'manager', 'admin', 'super_admin'].includes(member.role)
        case 'processor':
          return ['loan_processor', 'manager', 'admin', 'super_admin'].includes(member.role)
        case 'underwriter':
          return ['underwriter', 'manager', 'admin', 'super_admin'].includes(member.role)
        default:
          return true
      }
    })
  }

  const getAssignedMemberName = (userId: string) => {
    if (!userId) return "Unassigned"
    const member = teamMembers.find(m => m.id === userId)
    return member ? `${member.first_name} ${member.last_name}` : "Unknown User"
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'loan_originator': return 'Loan Originator'
      case 'processor': return 'Loan Processor'
      case 'underwriter': return 'Underwriter'
      default: return role
    }
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <UserPlus className="h-4 w-4" />
      Assign Team
    </Button>
  )

  if (!hasRole('manager') && !hasRole('admin') && !hasRole('super_admin')) {
    return null // Hide for users without permission
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Team Members
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Assign team members to different roles for: <strong>{leadName}</strong>
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading team members...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Assignments Summary */}
            <div className="bg-muted/20 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-3">Current Assignments</h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(assignments).map(([role, userId]) => (
                  <div key={role} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20">
                      {getRoleDisplayName(role.replace('_id', ''))}:
                    </span>
                    <Badge variant={userId ? "default" : "outline"} className="text-xs">
                      {getAssignedMemberName(userId)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Assignment Controls */}
            <div className="space-y-4">
              {['loan_originator', 'processor', 'underwriter'].map((role) => (
                <div key={role} className="space-y-2">
                  <Label htmlFor={role} className="text-sm font-medium">
                    {getRoleDisplayName(role)}
                  </Label>
                  <Select
                    value={assignments[`${role}_id` as keyof typeof assignments]}
                    onValueChange={(value) => handleAssignmentChange(role, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${getRoleDisplayName(role)}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">
                        <div className="flex items-center gap-2">
                          <X className="h-4 w-4 text-muted-foreground" />
                          Unassigned
                        </div>
                      </SelectItem>
                      {getTeamMembersByRole(role).map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {member.first_name?.[0]}{member.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="text-sm">{member.first_name} {member.last_name}</span>
                              <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={saveAssignments}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Assignments
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
