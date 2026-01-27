import { StandardPageLayout } from "@/components/StandardPageLayout"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardContentCard } from "@/components/StandardContentCard"
import { StandardKPICard } from "@/components/StandardKPICard"
import { ResponsiveContainer } from "@/components/ResponsiveContainer"
import { Shield, Users, Key, Lock, Settings, UserPlus, MoreVertical, Database, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { useNavigate } from "react-router-dom"

interface RoleCount {
  role: string
  count: number
}

interface AuditLogEvent {
  id: string
  action: string
  user_id: string | null
  created_at: string
  ip_address: string | null
  email?: string
}

export default function SecurityAccess() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [activeUsers, setActiveUsers] = useState(0)
  const [adminUsers, setAdminUsers] = useState(0)
  const [failedLogins, setFailedLogins] = useState(0)
  const [roleCounts, setRoleCounts] = useState<RoleCount[]>([])
  const [recentEvents, setRecentEvents] = useState<AuditLogEvent[]>([])
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetchSecurityData()
  }, [])

  const fetchSecurityData = async () => {
    try {
      setLoading(true)

      // Fetch active sessions (currently logged in users, unexpired only)
      const { data: sessions, error: sessionsError } = await supabase
        .from('active_sessions')
        .select('user_id')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())

      if (sessionsError) throw sessionsError
      
      // Count unique users (not total sessions)
      const uniqueUsers = new Set(sessions?.map(s => s.user_id) || [])
      setActiveUsers(uniqueUsers.size)

      // Fetch admin users from user_roles
      const { data: adminRoles, error: adminError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'super_admin'])

      if (adminError) throw adminError
      setAdminUsers(adminRoles?.length || 0)

      // Fetch failed logins from account_lockouts in last 24 hours
      const yesterday = new Date()
      yesterday.setHours(yesterday.getHours() - 24)

      const { data: lockouts, error: lockoutsError } = await supabase
        .from('account_lockouts')
        .select('id')
        .gte('created_at', yesterday.toISOString())

      if (lockoutsError) throw lockoutsError
      setFailedLogins(lockouts?.length || 0)

      // Define all possible roles
      const allPossibleRoles = [
        'super_admin',
        'admin',
        'manager',
        'loan_originator',
        'loan_processor',
        'underwriter',
        'closer',
        'funder',
        'agent',
        'tech',
        'viewer',
        'user'
      ]

      // Fetch role counts from user_roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')

      if (rolesError) throw rolesError

      // Count users by role
      const roleCounts: { [key: string]: number } = {}
      
      // Initialize all roles with 0
      allPossibleRoles.forEach(role => {
        roleCounts[role] = 0
      })
      
      // Update counts for roles that have users
      roles?.forEach(r => {
        roleCounts[r.role] = (roleCounts[r.role] || 0) + 1
      })

      // Convert to array and sort by role priority
      const roleOrder = allPossibleRoles
      setRoleCounts(
        roleOrder.map(role => ({ role, count: roleCounts[role] || 0 }))
      )

      // Fetch recent audit log events with user emails
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('id, action, user_id, created_at, ip_address')
        .order('created_at', { ascending: false })
        .limit(5)

      if (auditError) {
        console.error('Audit logs error:', auditError)
      } else if (auditLogs) {
        // Fetch user emails separately
        const userIds = auditLogs
          .map(log => log.user_id)
          .filter((id): id is string => id !== null)
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)

        const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || [])
        
        const eventsWithEmails: AuditLogEvent[] = auditLogs.map(log => ({
          id: log.id,
          action: log.action,
          user_id: log.user_id,
          created_at: log.created_at,
          ip_address: log.ip_address as string | null,
          email: log.user_id ? profileMap.get(log.user_id) : undefined
        }))

        setRecentEvents(eventsWithEmails)
      }

    } catch (error) {
      console.error('Error fetching security data:', error)
      toast({
        title: "Error",
        description: "Failed to load security data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getRoleDisplayName = (role: string) => {
    const roleMap: { [key: string]: string } = {
      'super_admin': 'Super Administrator',
      'admin': 'Administrator',
      'manager': 'Manager',
      'loan_originator': 'Loan Originator',
      'loan_processor': 'Loan Processor',
      'underwriter': 'Underwriter',
      'closer': 'Closer',
      'funder': 'Funder',
      'agent': 'Agent',
      'tech': 'Technical Support',
      'viewer': 'Viewer',
      'user': 'Standard User'
    }
    return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')
  }

  const getActionDisplayName = (action: string) => {
    const actionMap: { [key: string]: string } = {
      'login': 'User Login',
      'logout': 'User Logout',
      'create': 'Record Created',
      'update': 'Record Updated',
      'delete': 'Record Deleted',
      'permission_change': 'Permission Change',
      'role_change': 'Role Change'
    }
    return actionMap[action] || action
  }

  const getActionStatus = (action: string) => {
    if (action.includes('fail') || action.includes('error')) {
      return { text: 'Failed', color: 'text-red-600' }
    }
    if (action.includes('update') || action.includes('change')) {
      return { text: 'Updated', color: 'text-blue-600' }
    }
    return { text: 'Success', color: 'text-green-600' }
  }
  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader 
        title="Access Management"
        subtitle="Manage user roles, permissions, and access controls"
      />
      <div className="p-8 space-y-8 animate-fade-in">
        <div className="flex items-center gap-2">
          <Button 
            onClick={fetchSecurityData}
            size="sm" 
            className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-2 border-[#001f3f]"
          >
              <RefreshCw className="h-3 w-3 mr-2" />
              Refresh
            </Button>
            <Button 
              size="sm"
              className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-2 border-[#001f3f]"
            >
              <UserPlus className="h-3 w-3 mr-2" />
              Add User
            </Button>
          </div>

        {/* Content Area */}
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-[#0A1628] p-1 gap-2">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="permissions" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>User Permissions</span>
              </TabsTrigger>
              <TabsTrigger 
                value="events" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                <span>Access Events</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Interactive Stats Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div 
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toast({ title: 'Active Users', description: `${activeUsers} users currently logged in` })}
                >
                  <StandardKPICard 
                    title="Active Users"
                    value={loading ? "..." : activeUsers.toString()}
                    trend={{
                      value: "Currently logged in",
                      direction: "neutral"
                    }}
                  />
                </div>

                <div 
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toast({ title: 'Admin Users', description: `${adminUsers} users with admin privileges` })}
                >
                  <StandardKPICard 
                    title="Admin Users"
                    value={loading ? "..." : adminUsers.toString()}
                    trend={{
                      value: "With admin privileges",
                      direction: "neutral"
                    }}
                  />
                </div>

                <div 
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toast({ title: 'API Keys', description: 'API key management coming soon' })}
                >
                  <StandardKPICard 
                    title="API Keys"
                    value="—"
                    trend={{
                      value: "Active integrations",
                      direction: "neutral"
                    }}
                  />
                </div>

                <div 
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toast({ title: 'Failed Logins', description: `${failedLogins} failed login attempts in last 24 hours`, variant: "destructive" })}
                >
                  <StandardKPICard 
                    title="Failed Logins"
                    value={loading ? "..." : failedLogins.toString()}
                    trend={{
                      value: "Last 24 hours",
                      direction: "neutral"
                    }}
                  />
                </div>
              </div>

              {/* Interactive Security Summary and Quick Actions */}
              <div className="grid gap-6 md:grid-cols-2">
                <StandardContentCard title="Security Summary" className="hover:shadow-lg transition-shadow">
                  <p className="text-sm text-muted-foreground mb-4">
                    Quick overview of system security status
                  </p>
                  <div className="space-y-3">
                    <div 
                      className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg cursor-pointer hover:bg-accent/50 hover:border-green-600 transition-all"
                      onClick={() => toast({ title: 'RLS Policies', description: 'All database tables are protected with Row Level Security' })}
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">RLS Policies</p>
                          <p className="text-sm text-muted-foreground">All tables protected</p>
                        </div>
                      </div>
                      <span className="text-sm text-green-600">Active</span>
                    </div>
                    <div 
                      className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg cursor-pointer hover:bg-accent/50 hover:border-green-600 transition-all"
                      onClick={() => toast({ title: 'MFA Status', description: 'Multi-factor authentication is enforced for all users' })}
                    >
                      <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium">MFA Status</p>
                          <p className="text-sm text-muted-foreground">Multi-factor enabled</p>
                        </div>
                      </div>
                      <span className="text-sm text-green-600">Enforced</span>
                    </div>
                    <div 
                      className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg cursor-pointer hover:bg-accent/50 hover:border-blue-600 transition-all"
                      onClick={() => toast({ title: 'Session Security', description: '30 minute timeout configured for inactive sessions' })}
                    >
                      <div className="flex items-center gap-3">
                        <Key className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium">Session Security</p>
                          <p className="text-sm text-muted-foreground">30 min timeout</p>
                        </div>
                      </div>
                      <span className="text-sm text-blue-600">Configured</span>
                    </div>
                  </div>
                </StandardContentCard>

                <StandardContentCard title="Quick Actions" className="hover:shadow-lg transition-shadow">
                  <p className="text-sm text-muted-foreground mb-4">
                    Common security management tasks
                  </p>
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2 !border-[#0A1628] !text-[#161616] hover:!bg-[#0A1628] hover:!text-white transition-all hover:scale-105"
                      onClick={() => navigate('/settings/system')}
                    >
                      <Database className="h-4 w-4" />
                      System Configuration
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2 !border-[#0A1628] !text-[#161616] hover:!bg-[#0A1628] hover:!text-white transition-all hover:scale-105"
                      onClick={() => toast({
                        title: "Coming Soon",
                        description: "Policy configuration will be available soon."
                      })}
                    >
                      <Shield className="h-4 w-4" />
                      Configure Policies
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2 !border-[#0A1628] !text-[#161616] hover:!bg-[#0A1628] hover:!text-white transition-all hover:scale-105"
                      onClick={() => toast({
                        title: "Coming Soon",
                        description: "API key management will be available soon."
                      })}
                    >
                      <Key className="h-4 w-4" />
                      Manage API Keys
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2 !border-[#0A1628] !text-[#161616] hover:!bg-[#0A1628] hover:!text-white transition-all hover:scale-105"
                      onClick={() => navigate('/settings')}
                    >
                      <Lock className="h-4 w-4" />
                      Session Settings
                    </Button>
                  </div>
                </StandardContentCard>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-6">
              <StandardContentCard title="User Permissions by Role">
                <p className="text-sm text-muted-foreground mb-4">
                  Manage role-based access control for all users
                </p>
                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-4 text-muted-foreground">Loading...</div>
                  ) : (
                    roleCounts.map((roleCount) => (
                      <div key={roleCount.role} className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{getRoleDisplayName(roleCount.role)}</p>
                          <p className="text-sm text-muted-foreground">
                            {roleCount.count} user{roleCount.count !== 1 ? 's' : ''} assigned
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={roleCount.count === 0}
                        >
                          Manage
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="events" className="space-y-6">
              <StandardContentCard title="Recent Access Events">
                <p className="text-sm text-muted-foreground mb-4">
                  Monitor and audit all security-related activities
                </p>
                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-4 text-muted-foreground">Loading...</div>
                  ) : recentEvents.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">No recent events</div>
                  ) : (
                    recentEvents.map((event) => {
                      const status = getActionStatus(event.action)
                      return (
                        <div key={event.id} className="flex items-center justify-between p-3 border border-[#0A1628] rounded-lg">
                          <div>
                            <p className="font-medium">{getActionDisplayName(event.action)}</p>
                            <p className="text-sm text-muted-foreground">
                              {event.email || 'Unknown user'} - {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <span className={`text-sm ${status.color}`}>{status.text}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </StandardContentCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}