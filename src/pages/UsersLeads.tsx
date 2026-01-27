
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Badge component removed - using plain text instead
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { formatPhoneNumber } from "@/lib/utils"

import { 
  Search, 
  Users, 
  Eye, 
  Phone, 
  Mail, 
  DollarSign, 
  Calendar, 
  Filter, 
  TrendingUp, 
  Shield,
  MapPin,
  Briefcase,
  Star,
  Building,
  Globe
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/components/auth/AuthProvider"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { mapLeadFields, LEAD_WITH_CONTACT_QUERY } from "@/lib/field-mapping"
import { Lead } from "@/types/lead"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"

interface UserWithLeads {
  id: string
  email: string
  name?: string
  role: string
  leads: Lead[]
  totalLeadValue: number
  activeLeads: number
  convertedLeads: number
}

export default function UsersLeads() {
  const [usersWithLeads, setUsersWithLeads] = useState<UserWithLeads[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const { user, hasRole } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (hasRole('admin') || hasRole('super_admin')) {
      fetchUsersWithLeads()
    } else {
      toast({
        title: "Access Denied",
        description: "You need admin privileges to view this page",
        variant: "destructive"
      })
      navigate('/leads')
    }
  }, [user, hasRole])

  const fetchUsersWithLeads = async () => {
    try {
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          is_active
        `)
        .eq('is_active', true)

      if (rolesError) throw rolesError

      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select(LEAD_WITH_CONTACT_QUERY)
        .order('created_at', { ascending: false })

      if (leadsError) throw leadsError

      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')

      if (usersError) throw usersError

      const userLeadsMap = new Map<string, UserWithLeads>()

      userRoles.forEach(userRole => {
        const userProfile = usersData?.find(u => u.id === userRole.user_id)
        const fullName = userProfile 
          ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
          : 'Unknown User'

        userLeadsMap.set(userRole.user_id, {
          id: userRole.user_id,
          email: userProfile?.email || 'No email',
          name: fullName || userProfile?.email || 'Unknown User',
          role: userRole.role,
          leads: [],
          totalLeadValue: 0,
          activeLeads: 0,
          convertedLeads: 0
        })
      })

      // Use enhanced field mapping
      leadsData?.forEach(leadItem => {
        const userLeads = userLeadsMap.get(leadItem.user_id)
        if (userLeads && leadItem.contact_entity) {
          const lead = mapLeadFields(leadItem)

          userLeads.leads.push(lead)
          userLeads.totalLeadValue += lead.loan_amount || 0
          
          if (lead.is_converted_to_client) {
            userLeads.convertedLeads++
          } else {
            userLeads.activeLeads++
          }
        }
      })

      const usersArray = Array.from(userLeadsMap.values())
      setUsersWithLeads(usersArray)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching users with leads:', error)
      toast({
        title: "Error",
        description: "Failed to load users and leads data",
        variant: "destructive"
      })
      setLoading(false)
    }
  }

  const filteredUsers = usersWithLeads.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.leads.some(lead => 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.business_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  const totalStats = {
    totalUsers: usersWithLeads.length,
    totalLeads: usersWithLeads.reduce((sum, user) => sum + user.leads.length, 0),
    totalValue: usersWithLeads.reduce((sum, user) => sum + user.totalLeadValue, 0),
    avgLeadsPerUser: usersWithLeads.length > 0 ? (usersWithLeads.reduce((sum, user) => sum + user.leads.length, 0) / usersWithLeads.length).toFixed(1) : '0'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'  
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Loan Funded': return 'bg-green-100 text-green-800'
      case 'Closing': return 'bg-blue-100 text-blue-800'
      case 'Loan Approved': return 'bg-purple-100 text-purple-800'
      case 'Term Sheet Signed': return 'bg-indigo-100 text-indigo-800'
      case 'Pre-Approved': return 'bg-orange-100 text-orange-800'
      case 'Waiting for Documentation': return 'bg-yellow-100 text-yellow-800'
      case 'Loan Application Signed': return 'bg-yellow-100 text-yellow-800'
      case 'Initial Contact': return 'bg-gray-100 text-gray-800'
      case 'New Lead': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <div />
          <div className="flex-1">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading users and leads...</p>
              </div>
            </div>
          </div>
        </div>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div />
        <div className="flex-1">
          <div className="min-h-screen bg-background">
            {/* Header */}
            <IBMPageHeader 
              title="Users & Leads Analytics"
              subtitle="Comprehensive view of user performance and detailed lead information"
              actions={
                <Button 
                  variant="outline" 
                  onClick={fetchUsersWithLeads}
                  size="sm"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              }
            />

            {/* Main Content */}
            <div className="container mx-auto p-6 space-y-6">
              {/* Search */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users, leads, businesses, or any field..."
                        className="pl-10 border-[#0A1628]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Button variant="outline">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalStats.totalUsers}</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-secondary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalStats.totalLeads}</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-accent">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Lead Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(totalStats.totalValue)}</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avg Leads/User</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalStats.avgLeadsPerUser}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Enhanced Users and Leads List with All Fields */}
              <div className="space-y-6">
                {filteredUsers.map((userWithLeads) => (
                  <Card key={userWithLeads.id}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={`https://api.dicebear.com/6/initials/svg?seed=${userWithLeads.name}`} />
                            <AvatarFallback>
                              {userWithLeads.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="text-lg font-semibold">{userWithLeads.name}</h3>
                            <p className="text-sm text-muted-foreground">{userWithLeads.email}</p>
                            <span className="text-sm font-medium">
                              {userWithLeads.role}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-2xl font-bold text-secondary">{userWithLeads.activeLeads}</div>
                              <div className="text-xs text-muted-foreground">Active</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-accent">{userWithLeads.convertedLeads}</div>
                              <div className="text-xs text-muted-foreground">Converted</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-primary">{formatCurrency(userWithLeads.totalLeadValue)}</div>
                              <div className="text-xs text-muted-foreground">Total Value</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {userWithLeads.leads.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No leads assigned to this user</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {userWithLeads.leads.map((lead) => (
                            <Card key={lead.id} className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-primary/20">
                              <div className="space-y-4">
                                {/* Header with name, business, and stage */}
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="font-semibold text-lg">{lead.name}</h4>
                                    <p className="text-muted-foreground">{lead.business_name || 'No business name'}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1">
                                    <span className={`text-sm font-medium ${getStageColor(lead.stage || '')}`}>
                                      {lead.stage || 'No stage'}
                                    </span>
                                    <span className={`text-sm font-medium ${getPriorityColor(lead.priority || '')}`}>
                                      <Star className="h-3 w-3 mr-1 inline" />
                                      {lead.priority || 'medium'} priority
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Comprehensive Information Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                  {/* Contact Information */}
                                  <div className="space-y-2">
                                    <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Contact Information</h5>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-3 w-3 text-muted-foreground" />
                                        <span className="truncate">{lead.email || 'No email'}</span>
                                      </div>
                                      {lead.phone && (
                                        <div className="flex items-center gap-2">
                                          <Phone className="h-3 w-3 text-muted-foreground" />
                                          <span>{formatPhoneNumber(lead.phone)}</span>
                                        </div>
                                      )}
                                      {lead.location && (
                                        <div className="flex items-center gap-2">
                                          <MapPin className="h-3 w-3 text-muted-foreground" />
                                          <span className="truncate">{lead.location}</span>
                                        </div>
                                      )}
                                      {lead.website && (
                                        <div className="flex items-center gap-2">
                                          <Globe className="h-3 w-3 text-muted-foreground" />
                                          <span className="truncate">{lead.website}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Business Information */}
                                  <div className="space-y-2">
                                    <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Business Details</h5>
                                    <div className="space-y-1">
                                      {lead.business_address && (
                                        <div className="text-xs">
                                          <span className="font-medium">Address:</span> {lead.business_address}
                                        </div>
                                      )}
                                      {lead.industry && (
                                        <div className="flex items-center gap-2">
                                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                                          <span>{lead.industry}</span>
                                        </div>
                                      )}
                                      {lead.business_type && (
                                        <div className="text-xs">
                                          <span className="font-medium">Type:</span> {lead.business_type}
                                        </div>
                                      )}
                                      {lead.ownership_structure && (
                                        <div className="text-xs">
                                          <span className="font-medium">Structure:</span> {lead.ownership_structure}
                                        </div>
                                      )}
                                      {lead.year_established && (
                                        <div className="text-xs">
                                          <span className="font-medium">Established:</span> {lead.year_established}
                                        </div>
                                      )}
                                      {lead.years_in_business && (
                                        <div className="text-xs">
                                          <span className="font-medium">Years in Business:</span> {lead.years_in_business}
                                        </div>
                                      )}
                                      {lead.employees && (
                                        <div className="text-xs">
                                          <span className="font-medium">Employees:</span> {lead.employees}
                                        </div>
                                      )}
                                      {lead.naics_code && (
                                        <div className="text-xs">
                                          <span className="font-medium">NAICS:</span> {lead.naics_code}
                                        </div>
                                      )}
                                      {lead.tax_id && (
                                        <div className="text-xs">
                                          <span className="font-medium">Tax ID:</span> {lead.tax_id}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Financial Information */}
                                  <div className="space-y-2">
                                    <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Financial Details</h5>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <DollarSign className="h-3 w-3 text-primary" />
                                        <span className="font-bold text-primary">{formatCurrency(lead.loan_amount || 0)}</span>
                                      </div>
                                      {lead.requested_amount && lead.requested_amount !== lead.loan_amount && (
                                        <div className="text-xs">
                                          <span className="font-medium">Requested:</span> {formatCurrency(lead.requested_amount)}
                                        </div>
                                      )}
                                      {lead.loan_type && (
                                        <div className="text-xs">
                                          <span className="font-medium">Loan Type:</span> {lead.loan_type}
                                        </div>
                                      )}
                                      {lead.purpose_of_loan && (
                                        <div className="text-xs">
                                          <span className="font-medium">Purpose:</span> {lead.purpose_of_loan}
                                        </div>
                                      )}
                                      {lead.annual_revenue && (
                                        <div className="text-xs">
                                          <span className="font-medium">Annual Revenue:</span> {formatCurrency(lead.annual_revenue)}
                                        </div>
                                      )}
                                      {lead.monthly_revenue && (
                                        <div className="text-xs">
                                          <span className="font-medium">Monthly Revenue:</span> {formatCurrency(lead.monthly_revenue)}
                                        </div>
                                      )}
                                      {lead.net_operating_income && (
                                        <div className="text-xs">
                                          <span className="font-medium">NOI:</span> {formatCurrency(lead.net_operating_income)}
                                        </div>
                                      )}
                                      {lead.credit_score && (
                                        <div className="text-xs">
                                          <span className="font-medium">Credit Score:</span> {lead.credit_score}
                                        </div>
                                      )}
                                      {lead.debt_to_income_ratio && (
                                        <div className="text-xs">
                                          <span className="font-medium">DTI Ratio:</span> {lead.debt_to_income_ratio}%
                                        </div>
                                      )}
                                      {lead.interest_rate && (
                                        <div className="text-xs">
                                          <span className="font-medium">Interest Rate:</span> {lead.interest_rate}%
                                        </div>
                                      )}
                                      {lead.existing_loan_amount && (
                                        <div className="text-xs">
                                          <span className="font-medium">Existing Loan:</span> {formatCurrency(lead.existing_loan_amount)}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Lead Management & Activity */}
                                  <div className="space-y-2">
                                    <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Lead Management</h5>
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs">Created: {new Date(lead.created_at).toLocaleDateString()}</span>
                                      </div>
                                      {lead.source && (
                                        <div className="text-xs">
                                          <span className="font-medium">Source:</span> {lead.source}
                                        </div>
                                      )}
                                      {lead.referral_source && (
                                        <div className="text-xs">
                                          <span className="font-medium">Referral:</span> {lead.referral_source}
                                        </div>
                                      )}
                                      {lead.campaign_source && (
                                        <div className="text-xs">
                                          <span className="font-medium">Campaign:</span> {lead.campaign_source}
                                        </div>
                                      )}
                                      {lead.lead_score && (
                                        <div className="flex items-center gap-2">
                                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                                          <span className="text-xs">Score: {lead.lead_score}</span>
                                        </div>
                                      )}
                                      {lead.conversion_probability && (
                                        <div className="text-xs">
                                          <span className="font-medium">Conversion Prob:</span> {lead.conversion_probability}%
                                        </div>
                                      )}
                                      {lead.last_contact && (
                                        <div className="text-xs">
                                          <span className="font-medium">Last Contact:</span> {new Date(lead.last_contact).toLocaleDateString()}
                                        </div>
                                      )}
                                      {lead.next_follow_up && (
                                        <div className="text-xs">
                                          <span className="font-medium">Next Follow-up:</span> {new Date(lead.next_follow_up).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Bank/BDO Information */}
                                {(lead.bank_lender_name || lead.bdo_name || lead.bdo_email || lead.bdo_telephone) && (
                                  <div className="pt-3 border-t">
                                    <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">Banking Information</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                      {lead.bank_lender_name && (
                                        <div>
                                          <span className="font-medium">Bank/Lender:</span> {lead.bank_lender_name}
                                        </div>
                                      )}
                                      {lead.bdo_name && (
                                        <div>
                                          <span className="font-medium">BDO Name:</span> {lead.bdo_name}
                                        </div>
                                      )}
                                      {lead.bdo_email && (
                                        <div className="flex items-center gap-2">
                                          <Mail className="h-3 w-3" />
                                          <span>BDO: {lead.bdo_email}</span>
                                        </div>
                                      )}
                                      {lead.bdo_telephone && (
                                        <div className="flex items-center gap-2">
                                          <Phone className="h-3 w-3" />
                                          <span>BDO: {lead.bdo_telephone}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Notes Section */}
                                {(lead.notes || lead.call_notes) && (
                                  <div className="pt-3 border-t">
                                    <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">Notes & Communication</h5>
                                    <div className="space-y-2">
                                      {lead.notes && (
                                        <div className="text-sm p-3 bg-muted/20 rounded-lg">
                                          <span className="font-medium text-xs text-muted-foreground">General Notes:</span>
                                          <p className="mt-1">{lead.notes}</p>
                                        </div>
                                      )}
                                      {lead.call_notes && (
                                        <div className="text-sm p-3 bg-muted/20 rounded-lg">
                                          <span className="font-medium text-xs text-muted-foreground">Call Notes:</span>
                                          <p className="mt-1">{lead.call_notes}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Action Button */}
                                <div className="flex justify-end pt-3 border-t">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/leads/${lead.id}`)}
                                  >
                                    <Eye className="h-3 w-3 mr-2" />
                                    View Full Lead Details
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredUsers.length === 0 && (
                <Card>
                  <CardContent className="text-center py-12">
                    <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No users found</h3>
                    <p className="text-muted-foreground">Try adjusting your search terms</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
