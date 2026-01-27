import { useState, useEffect } from "react"
import { StandardContentCard } from "@/components/StandardContentCard"
import { StandardKPICard } from "@/components/StandardKPICard"
import { AlertTriangle, Shield, Activity, TrendingUp, Bell, Lock, Key, Ban, RefreshCw, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardPageLayout } from "@/components/StandardPageLayout"

interface SecurityEvent {
  id: string
  created_at: string
  user_id: string | null
  event_type: string
  severity: string
  details: any
  ip_address?: unknown
  user_agent?: string | null
}

export default function SecurityThreats() {
  const { toast } = useToast()
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [stats, setStats] = useState({
    activeThreats: 0,
    blockedAttempts: 0,
    securityScore: 98.5,
    anomalies: 0
  })
  const [threatCategories, setThreatCategories] = useState({
    bruteForce: 0,
    suspicious: 0,
    malware: 0,
    dataExfiltration: 0
  })

  const fetchSecurityEvents = async () => {
    try {
      setLoading(true)
      
      // Fetch recent security events
      const { data: events, error } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (error) throw error
      
      setSecurityEvents(events || [])
      
      // Calculate stats from the events
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentEvents = events?.filter(event => new Date(event.created_at) > last24Hours) || []
      
      // Active threats (high severity, recent events)
      const activeThreats = recentEvents.filter(event => 
        event.severity === 'high' || event.severity === 'critical'
      ).length
      
      // Blocked attempts (failed logins, blocked access, etc.)
      const blockedAttempts = recentEvents.filter(event => 
        event.event_type?.toLowerCase().includes('failed') ||
        event.event_type?.toLowerCase().includes('blocked') ||
        event.event_type?.toLowerCase().includes('denied')
      ).length
      
      // Anomalies (medium severity)
      const anomalies = recentEvents.filter(event => 
        event.severity === 'medium'
      ).length
      
      // Calculate security score based on threat levels
      const criticalCount = recentEvents.filter(e => e.severity === 'critical').length
      const highCount = recentEvents.filter(e => e.severity === 'high').length
      const mediumCount = recentEvents.filter(e => e.severity === 'medium').length
      
      const scoreReduction = (criticalCount * 5) + (highCount * 2) + (mediumCount * 0.5)
      const securityScore = Math.max(85, 100 - scoreReduction)
      
      setStats({
        activeThreats,
        blockedAttempts,
        securityScore: Number(securityScore.toFixed(1)),
        anomalies
      })
      
      // Categorize threats
      const bruteForce = recentEvents.filter(e => 
        e.event_type?.toLowerCase().includes('brute') ||
        e.event_type?.toLowerCase().includes('login_attempt') ||
        e.event_type?.toLowerCase().includes('failed_login')
      ).length
      
      const suspicious = recentEvents.filter(e => 
        e.event_type?.toLowerCase().includes('suspicious') ||
        e.event_type?.toLowerCase().includes('anomaly')
      ).length
      
      const malware = recentEvents.filter(e => 
        e.event_type?.toLowerCase().includes('malware') ||
        e.event_type?.toLowerCase().includes('virus')
      ).length
      
      const dataExfiltration = recentEvents.filter(e => 
        e.event_type?.toLowerCase().includes('exfiltration') ||
        e.event_type?.toLowerCase().includes('bulk_access')
      ).length
      
      setThreatCategories({
        bruteForce,
        suspicious,
        malware,
        dataExfiltration
      })
      
    } catch (error: any) {
      console.error('Error fetching security events:', error)
      toast({
        title: "Error",
        description: "Failed to load security events",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSecurityEvents()
    
    // Set up realtime subscription
    const channel = supabase
      .channel('security_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'security_events'
        },
        () => {
          fetchSecurityEvents()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'text-red-600 dark:text-red-400'
      case 'high':
        return 'text-orange-600 dark:text-orange-400'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'low':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusText = (event: SecurityEvent) => {
    const eventAge = Date.now() - new Date(event.created_at).getTime()
    const hoursOld = eventAge / (1000 * 60 * 60)
    
    if (hoursOld < 1) return 'Active'
    if (hoursOld < 24) return 'Monitoring'
    return 'Archived'
  }

  const getStatusColor = (event: SecurityEvent) => {
    const status = getStatusText(event)
    switch (status) {
      case 'Active':
        return 'text-red-600 dark:text-red-400'
      case 'Monitoring':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'Archived':
        return 'text-green-600 dark:text-green-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const activeThreatsData = securityEvents
    .filter(event => 
      event.severity === 'high' || event.severity === 'critical'
    )
    .slice(0, 5)

  const getFilteredEvents = () => {
    if (activeTab === "overview") return securityEvents.slice(0, 20)
    if (activeTab === "active") {
      return securityEvents.filter(event => 
        event.severity === 'high' || event.severity === 'critical'
      ).slice(0, 20)
    }
    if (activeTab === "history") {
      return securityEvents.filter(event => {
        const eventAge = Date.now() - new Date(event.created_at).getTime()
        const hoursOld = eventAge / (1000 * 60 * 60)
        return hoursOld >= 24
      }).slice(0, 20)
    }
    return securityEvents.slice(0, 20)
  }

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Threat Detection"
        subtitle="Real-time threat monitoring and security incident management"
        actions={
          <>
            <Button 
              onClick={fetchSecurityEvents} 
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
                description: "Alert configuration will be available soon."
              })}
            >
              <Bell className="h-3 w-3 mr-2" />
              Alerts
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
                value="overview" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Activity className="w-4 h-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="active" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Active Threats</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span>History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Interactive Stats Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div 
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => {
                    setActiveTab("active");
                    toast({ title: 'Active Threats', description: `${stats.activeThreats} threats require immediate attention`, variant: "destructive" });
                  }}
                >
                  <StandardKPICard 
                    title="Active Threats"
                    value={stats.activeThreats}
                    trend={{
                      value: "Requires immediate attention",
                      direction: stats.activeThreats > 0 ? "down" : "neutral"
                    }}
                  />
                </div>

                <div 
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toast({ title: 'Blocked Attempts', description: `${stats.blockedAttempts} malicious attempts blocked` })}
                >
                  <StandardKPICard 
                    title="Blocked Attempts"
                    value={stats.blockedAttempts}
                    trend={{
                      value: "Last 24 hours",
                      direction: "neutral"
                    }}
                  />
                </div>

                <div 
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toast({ title: 'Security Score', description: `System security rating: ${stats.securityScore}%` })}
                >
                  <StandardKPICard 
                    title="Security Score"
                    value={`${stats.securityScore}%`}
                    trend={{
                      value: "System security rating",
                      direction: stats.securityScore >= 95 ? "up" : "neutral"
                    }}
                  />
                </div>

                <div 
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toast({ title: 'Anomalies', description: `${stats.anomalies} anomalies under investigation` })}
                >
                  <StandardKPICard 
                    title="Anomalies"
                    value={stats.anomalies}
                    trend={{
                      value: "Under investigation",
                      direction: "neutral"
                    }}
                  />
                </div>
              </div>

                {/* Interactive Active Threats and Categories Grid */}
                <div className="grid gap-6 md:grid-cols-2">
                  <StandardContentCard title="Active Threats" className="hover:shadow-lg transition-shadow">
                    <p className="text-sm text-muted-foreground mb-4">
                      Current security incidents requiring attention
                    </p>
                    {loading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading threats...
                      </div>
                    ) : activeThreatsData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-2 text-green-600" />
                        <p>No active threats detected</p>
                        <p className="text-xs">All systems secure</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {activeThreatsData.map((threat) => (
                          <div 
                            key={threat.id}
                            className={`flex items-center justify-between p-4 border-2 border-[#0A1628] rounded-lg cursor-pointer hover:scale-105 transition-transform ${
                              threat.severity === 'critical' 
                                ? 'bg-red-50 dark:bg-red-950/20 hover:border-red-600' 
                                : 'bg-orange-50 dark:bg-orange-950/20 hover:border-orange-600'
                            }`}
                            onClick={() => toast({ title: 'Threat Details', description: `${threat.event_type.replace(/_/g, ' ').toUpperCase()} - ${threat.severity} severity`, variant: "destructive" })}
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              <AlertTriangle className={`h-6 w-6 ${getSeverityColor(threat.severity)}`} />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {threat.event_type.replace(/_/g, ' ').toUpperCase()}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {formatDistanceToNow(new Date(threat.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <Button size="sm" className="bg-[#0f62fe] hover:bg-[#0353e9] text-white">
                              Investigate
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </StandardContentCard>

                  <StandardContentCard title="Threat Categories" className="hover:shadow-lg transition-shadow">
                    <p className="text-sm text-muted-foreground mb-4">
                      Breakdown of detected threats by type
                    </p>
                    <div className="space-y-4">
                      <div 
                        className="flex justify-between items-center p-3 border border-[#0A1628] rounded-lg cursor-pointer hover:bg-accent/50 hover:border-red-600 transition-all"
                        onClick={() => toast({ title: 'Brute Force Attacks', description: `${threatCategories.bruteForce} login attempts detected` })}
                      >
                        <div>
                          <p className="font-medium">Brute Force Attacks</p>
                          <p className="text-sm text-muted-foreground">Login attempts</p>
                        </div>
                        <span className="text-lg font-semibold">{threatCategories.bruteForce}</span>
                      </div>
                      
                      <div 
                        className="flex justify-between items-center p-3 border border-[#0A1628] rounded-lg cursor-pointer hover:bg-accent/50 hover:border-yellow-600 transition-all"
                        onClick={() => toast({ title: 'Suspicious Activity', description: `${threatCategories.suspicious} anomalous behaviors detected`, variant: "destructive" })}
                      >
                        <div>
                          <p className="font-medium">Suspicious Activity</p>
                          <p className="text-sm text-muted-foreground">Anomalous behavior</p>
                        </div>
                        <span className="text-lg font-semibold">{threatCategories.suspicious}</span>
                      </div>
                      
                      <div 
                        className="flex justify-between items-center p-3 border border-[#0A1628] rounded-lg cursor-pointer hover:bg-accent/50 hover:border-purple-600 transition-all"
                        onClick={() => toast({ title: 'Malware Detection', description: `${threatCategories.malware} malicious files detected`, variant: "destructive" })}
                      >
                        <div>
                          <p className="font-medium">Malware Detection</p>
                          <p className="text-sm text-muted-foreground">File uploads</p>
                        </div>
                        <span className="text-lg font-semibold">{threatCategories.malware}</span>
                      </div>
                      
                      <div 
                        className="flex justify-between items-center p-3 border border-[#0A1628] rounded-lg cursor-pointer hover:bg-accent/50 hover:border-blue-600 transition-all"
                        onClick={() => toast({ title: 'Data Exfiltration', description: `${threatCategories.dataExfiltration} unusual download attempts`, variant: "destructive" })}
                      >
                        <div>
                          <p className="font-medium">Data Exfiltration</p>
                          <p className="text-sm text-muted-foreground">Unusual downloads</p>
                        </div>
                        <span className="text-lg font-semibold">{threatCategories.dataExfiltration}</span>
                      </div>
                    </div>
                  </StandardContentCard>
                </div>

              {/* Recent Security Events */}
              <StandardContentCard title="Recent Security Events">
                <p className="text-sm text-muted-foreground mb-4">
                  Latest threat detection activities
                </p>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading security events...
                  </div>
                ) : getFilteredEvents().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No security events found
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-4 font-medium text-sm border-b pb-2">
                      <span>Time</span>
                      <span>Threat Type</span>
                      <span>Source</span>
                      <span>Severity</span>
                      <span>Status</span>
                    </div>
                    
                    {getFilteredEvents().map((event) => (
                      <div key={event.id} className="grid grid-cols-5 gap-4 text-sm p-3 border border-[#0A1628] rounded-lg hover:bg-accent/50 transition-colors">
                        <span className="text-muted-foreground truncate">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </span>
                        <span className="truncate" title={event.event_type}>
                          {event.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="truncate" title={event.user_id || 'External'}>
                          {event.user_id ? event.user_id.slice(0, 8) + '...' : 'External'}
                        </span>
                        <span className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </span>
                        <span className={getStatusColor(event)}>
                          {getStatusText(event)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="active" className="space-y-6">
              <StandardContentCard title="Active Security Threats">
                <p className="text-sm text-muted-foreground mb-4">
                  High and critical severity threats requiring immediate attention
                </p>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading active threats...
                  </div>
                ) : getFilteredEvents().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-2 text-green-600" />
                    <p>No active threats detected</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-4 font-medium text-sm border-b pb-2">
                      <span>Time</span>
                      <span>Threat Type</span>
                      <span>Source</span>
                      <span>Severity</span>
                      <span>Status</span>
                    </div>
                    
                    {getFilteredEvents().map((event) => (
                      <div key={event.id} className="grid grid-cols-5 gap-4 text-sm p-3 border border-[#0A1628] rounded-lg hover:bg-accent/50 transition-colors">
                        <span className="text-muted-foreground truncate">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </span>
                        <span className="truncate" title={event.event_type}>
                          {event.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="truncate" title={event.user_id || 'External'}>
                          {event.user_id ? event.user_id.slice(0, 8) + '...' : 'External'}
                        </span>
                        <span className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </span>
                        <span className={getStatusColor(event)}>
                          {getStatusText(event)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <StandardContentCard title="Historical Security Events">
                <p className="text-sm text-muted-foreground mb-4">
                  Archived threats and resolved security incidents
                </p>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading historical events...
                  </div>
                ) : getFilteredEvents().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No historical events found
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-4 font-medium text-sm border-b pb-2">
                      <span>Time</span>
                      <span>Threat Type</span>
                      <span>Source</span>
                      <span>Severity</span>
                      <span>Status</span>
                    </div>
                    
                    {getFilteredEvents().map((event) => (
                      <div key={event.id} className="grid grid-cols-5 gap-4 text-sm p-3 border border-[#0A1628] rounded-lg hover:bg-accent/50 transition-colors">
                        <span className="text-muted-foreground truncate">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                        </span>
                        <span className="truncate" title={event.event_type}>
                          {event.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="truncate" title={event.user_id || 'External'}>
                          {event.user_id ? event.user_id.slice(0, 8) + '...' : 'External'}
                        </span>
                        <span className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </span>
                        <span className={getStatusColor(event)}>
                          {getStatusText(event)}
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