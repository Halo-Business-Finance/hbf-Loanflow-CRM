import { useState, useEffect } from "react"
import { StandardContentCard } from "@/components/StandardContentCard"
import { StandardKPICard } from "@/components/StandardKPICard"
import { FileText, Download, Filter, RefreshCw, Shield, Key, Lock, AlertTriangle, Activity, Users, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardPageLayout } from "@/components/StandardPageLayout"

interface AuditLog {
  id: string
  created_at: string
  user_id: string | null
  action: string
  table_name: string | null
  record_id: string | null
  ip_address: unknown
  user_agent: string | null
  risk_score: number | null
  old_values: any
  new_values: any
  session_id?: string | null
}

export default function SecurityAudit() {
  const { toast } = useToast()
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [stats, setStats] = useState({
    totalEvents: 0,
    loginEvents: 0,
    dataAccess: 0,
    systemChanges: 0
  })

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      
      // Fetch recent audit logs
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      
      setAuditLogs(logs || [])
      
      // Calculate stats from the logs
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentLogs = logs?.filter(log => new Date(log.created_at) > last24Hours) || []
      
      setStats({
        totalEvents: recentLogs.length,
        loginEvents: recentLogs.filter(log => 
          log.action?.toLowerCase().includes('login') || 
          log.action?.toLowerCase().includes('auth')
        ).length,
        dataAccess: recentLogs.filter(log => 
          log.action?.toLowerCase().includes('view') || 
          log.action?.toLowerCase().includes('read') ||
          log.action?.toLowerCase().includes('select')
        ).length,
        systemChanges: recentLogs.filter(log => 
          log.action?.toLowerCase().includes('update') || 
          log.action?.toLowerCase().includes('create') ||
          log.action?.toLowerCase().includes('delete')
        ).length
      })
      
    } catch (error: any) {
      console.error('Error fetching audit logs:', error)
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditLogs()
    
    // Set up realtime subscription
    const channel = supabase
      .channel('audit_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_logs'
        },
        () => {
          fetchAuditLogs()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const getActionColor = (action: string) => {
    if (!action) return 'text-foreground'
    
    const lowerAction = action.toLowerCase()
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) {
      return 'text-red-600 dark:text-red-400'
    }
    if (lowerAction.includes('create') || lowerAction.includes('insert')) {
      return 'text-green-600 dark:text-green-400'
    }
    if (lowerAction.includes('update') || lowerAction.includes('modify')) {
      return 'text-blue-600 dark:text-blue-400'
    }
    return 'text-foreground'
  }

  const getRiskColor = (riskScore: number | null) => {
    if (!riskScore) return 'text-green-600'
    if (riskScore >= 70) return 'text-red-600'
    if (riskScore >= 40) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getFilteredLogs = () => {
    if (activeTab === "all") return auditLogs
    if (activeTab === "auth") {
      return auditLogs.filter(log => 
        log.action?.toLowerCase().includes('login') || 
        log.action?.toLowerCase().includes('auth') ||
        log.action?.toLowerCase().includes('logout')
      )
    }
    if (activeTab === "data") {
      return auditLogs.filter(log => 
        log.action?.toLowerCase().includes('view') || 
        log.action?.toLowerCase().includes('read') ||
        log.action?.toLowerCase().includes('select') ||
        log.action?.toLowerCase().includes('update') ||
        log.action?.toLowerCase().includes('create') ||
        log.action?.toLowerCase().includes('delete')
      )
    }
    return auditLogs
  }

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Audit Logs"
        subtitle="Comprehensive audit trail of all system activities"
        actions={
          <>
            <Button 
              onClick={fetchAuditLogs} 
              disabled={loading}
              size="sm" 
              className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-2 border-[#001f3f]"
            >
              <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              size="sm"
              className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-2 border-[#001f3f]"
              onClick={() => toast({
                title: "Coming Soon",
                description: "Export functionality will be available soon."
              })}
            >
              <Download className="h-3 w-3 mr-2" />
              Export
            </Button>
            <Button 
              size="sm"
              className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white border-2 border-[#001f3f]"
              onClick={() => toast({
                title: "Coming Soon",
                description: "Report generation will be available soon."
              })}
            >
              <FileText className="h-3 w-3 mr-2" />
              Report
            </Button>
          </>
        }
      />
      <div className="p-8 space-y-8 animate-fade-in">

        {/* Content Area */}
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-[#0A1628] p-1 gap-2">
              <TabsTrigger 
                value="all" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Activity className="w-4 h-4" />
                <span>All Events</span>
              </TabsTrigger>
              <TabsTrigger 
                value="auth" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>Authentication</span>
              </TabsTrigger>
              <TabsTrigger 
                value="data" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                <span>Data Changes</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
               {/* Interactive Stats Grid */}
               <div className="grid gap-4 md:grid-cols-4">
                 <div 
                   className="cursor-pointer hover:scale-105 transition-transform"
                   onClick={() => toast({ title: 'Total Events', description: `${stats.totalEvents} events in last 24 hours` })}
                 >
                   <StandardKPICard 
                     title="Total Events"
                     value={stats.totalEvents}
                     trend={{
                       value: "Last 24 hours",
                       direction: "neutral"
                     }}
                   />
                 </div>

                 <div 
                   className="cursor-pointer hover:scale-105 transition-transform"
                   onClick={() => {
                     setActiveTab("auth");
                     toast({ title: 'Login Events', description: `Viewing ${stats.loginEvents} authentication activities` });
                   }}
                 >
                   <StandardKPICard 
                     title="Login Events"
                     value={stats.loginEvents}
                     trend={{
                       value: "Authentication activities",
                       direction: "neutral"
                     }}
                   />
                 </div>

                 <div 
                   className="cursor-pointer hover:scale-105 transition-transform"
                   onClick={() => {
                     setActiveTab("data");
                     toast({ title: 'Data Access', description: `Viewing ${stats.dataAccess} data access events` });
                   }}
                 >
                   <StandardKPICard 
                     title="Data Access"
                     value={stats.dataAccess}
                     trend={{
                       value: "Records accessed",
                       direction: "neutral"
                     }}
                   />
                 </div>

                 <div 
                   className="cursor-pointer hover:scale-105 transition-transform"
                   onClick={() => toast({ title: 'System Changes', description: `${stats.systemChanges} configuration updates recorded` })}
                 >
                   <StandardKPICard 
                     title="System Changes"
                     value={stats.systemChanges}
                     trend={{
                       value: "Configuration updates",
                       direction: "neutral"
                     }}
                   />
                 </div>
               </div>

              {/* Audit Logs Table */}
              <StandardContentCard title="All Audit Events">
                <p className="text-sm text-muted-foreground mb-4">
                  Complete system activity log
                </p>
                
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading audit logs...
                  </div>
                ) : getFilteredLogs().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No audit logs found
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-4 font-medium text-sm border-b pb-2">
                      <span>Timestamp</span>
                      <span>User ID</span>
                      <span>Action</span>
                      <span>Resource</span>
                      <span>IP Address</span>
                      <span>Risk</span>
                    </div>
                    
                    {getFilteredLogs().map((log) => (
                      <div key={log.id} className="grid grid-cols-6 gap-4 text-sm p-3 border border-[#0A1628] rounded-lg hover:bg-accent/50 transition-colors">
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                        <span className="truncate" title={log.user_id || 'System'}>
                          {log.user_id ? log.user_id.slice(0, 8) + '...' : 'System'}
                        </span>
                        <span className={getActionColor(log.action)}>
                          {log.action}
                        </span>
                        <span className="truncate" title={log.table_name || 'N/A'}>
                          {log.table_name || 'N/A'}
                          {log.record_id && ` #${log.record_id.slice(0, 8)}`}
                        </span>
                        <span className="truncate" title={String(log.ip_address || 'N/A')}>
                          {String(log.ip_address || 'N/A')}
                        </span>
                        <span className={getRiskColor(log.risk_score)}>
                          {log.risk_score !== null ? `${log.risk_score}%` : 'Low'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="auth" className="space-y-6">
              <StandardContentCard title="Authentication Events">
                <p className="text-sm text-muted-foreground mb-4">
                  Login, logout, and authentication activities
                </p>
                
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading authentication logs...
                  </div>
                ) : getFilteredLogs().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No authentication events found
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-4 font-medium text-sm border-b pb-2">
                      <span>Timestamp</span>
                      <span>User ID</span>
                      <span>Action</span>
                      <span>Resource</span>
                      <span>IP Address</span>
                      <span>Risk</span>
                    </div>
                    
                    {getFilteredLogs().map((log) => (
                      <div key={log.id} className="grid grid-cols-6 gap-4 text-sm p-3 border border-[#0A1628] rounded-lg hover:bg-accent/50 transition-colors">
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                        <span className="truncate" title={log.user_id || 'System'}>
                          {log.user_id ? log.user_id.slice(0, 8) + '...' : 'System'}
                        </span>
                        <span className={getActionColor(log.action)}>
                          {log.action}
                        </span>
                        <span className="truncate" title={log.table_name || 'N/A'}>
                          {log.table_name || 'N/A'}
                          {log.record_id && ` #${log.record_id.slice(0, 8)}`}
                        </span>
                        <span className="truncate" title={String(log.ip_address || 'N/A')}>
                          {String(log.ip_address || 'N/A')}
                        </span>
                        <span className={getRiskColor(log.risk_score)}>
                          {log.risk_score !== null ? `${log.risk_score}%` : 'Low'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="data" className="space-y-6">
              <StandardContentCard title="Data Change Events">
                <p className="text-sm text-muted-foreground mb-4">
                  Create, update, and delete operations
                </p>
                
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading data change logs...
                  </div>
                ) : getFilteredLogs().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No data change events found
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-4 font-medium text-sm border-b pb-2">
                      <span>Timestamp</span>
                      <span>User ID</span>
                      <span>Action</span>
                      <span>Resource</span>
                      <span>IP Address</span>
                      <span>Risk</span>
                    </div>
                    
                    {getFilteredLogs().map((log) => (
                      <div key={log.id} className="grid grid-cols-6 gap-4 text-sm p-3 border border-[#0A1628] rounded-lg hover:bg-accent/50 transition-colors">
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                        <span className="truncate" title={log.user_id || 'System'}>
                          {log.user_id ? log.user_id.slice(0, 8) + '...' : 'System'}
                        </span>
                        <span className={getActionColor(log.action)}>
                          {log.action}
                        </span>
                        <span className="truncate" title={log.table_name || 'N/A'}>
                          {log.table_name || 'N/A'}
                          {log.record_id && ` #${log.record_id.slice(0, 8)}`}
                        </span>
                        <span className="truncate" title={String(log.ip_address || 'N/A')}>
                          {String(log.ip_address || 'N/A')}
                        </span>
                        <span className={getRiskColor(log.risk_score)}>
                          {log.risk_score !== null ? `${log.risk_score}%` : 'Low'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </StandardContentCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </StandardPageLayout>
  )
}