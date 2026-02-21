import { useState, useEffect } from 'react'
import { ibmDb } from '@/lib/ibm'
import { useAuth } from '@/components/auth/AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  AlertTriangle, 
  Globe, 
  Lock, 
  Activity, 
  RefreshCw,
  Bell,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SecurityAlert {
  type: 'geo_blocked' | 'auth_failure' | 'rate_limit' | 'suspicious_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  count: number
  timeframe: string
  details: any
}

interface DashboardData {
  summary: {
    geo_blocks_24h: number
    failed_logins_24h: number
    rate_limit_violations_24h: number
    security_events_24h: number
    active_alerts: number
  }
  recent_alerts: any[]
  top_blocked_countries: Array<{country: string, count: number}>
  top_suspicious_ips: Array<{ip: string, attempts: number, emails: number}>
  timestamp: string
}

export function SecurityMonitor() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [monitoring, setMonitoring] = useState(false)
  const { hasRole } = useAuth()
  const { toast } = useToast()

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const { data, error } = await ibmDb.rpc('security-monitor', {
        action: 'dashboard'
      })

      if (error) throw error
      setDashboardData(data as unknown as DashboardData)
    } catch (error) {
      console.error('Error loading security dashboard:', error)
      toast({
        title: "Dashboard Error",
        description: "Failed to load security dashboard",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const runSecurityMonitor = async () => {
    try {
      setMonitoring(true)
      const { data, error } = await ibmDb.rpc('security-monitor', {
        action: 'monitor'
      })

      if (error) throw error

      const result = data as any
      setAlerts(result.alerts || [])
      
      if (result.alerts_generated > 0) {
        toast({
          title: "Security Alerts Generated",
          description: `${result.alerts_generated} new security alerts detected`,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Security Check Complete",
          description: "No new security issues detected",
        })
      }

      await loadDashboard()
    } catch (error) {
      console.error('Error running security monitor:', error)
      toast({
        title: "Monitoring Error",
        description: "Failed to run security monitoring",
        variant: "destructive"
      })
    } finally {
      setMonitoring(false)
    }
  }

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await ibmDb.rpc('security-monitor', {
        action: 'acknowledge',
        alert_ids: [alertId]
      })

      if (error) throw error

      toast({
        title: "Alert Acknowledged",
        description: "Security alert has been acknowledged",
      })

      await loadDashboard()
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    if (hasRole('admin')) {
      loadDashboard()
    }
  }, [hasRole])

  if (!hasRole('admin')) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          Only administrators can access security monitoring.
        </AlertDescription>
      </Alert>
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high': 
        return <XCircle className="h-4 w-4" />
      case 'medium': 
        return <AlertTriangle className="h-4 w-4" />
      case 'low': 
        return <CheckCircle className="h-4 w-4" />
      default: 
        return <Bell className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Security Monitor</h2>
          <p className="text-foreground/70">
            Monitor security threats and suspicious activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadDashboard} 
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={runSecurityMonitor} 
            disabled={monitoring}
          >
            <Shield className={`h-4 w-4 mr-2 ${monitoring ? 'animate-pulse' : ''}`} />
            Run Monitor
          </Button>
        </div>
      </div>

      {dashboardData && (
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="alerts">
              Active Alerts
              {dashboardData.summary?.active_alerts > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {dashboardData.summary.active_alerts}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Geo Blocks (24h)</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.summary?.geo_blocks_24h || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Logins (24h)</CardTitle>
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.summary?.failed_logins_24h || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Rate Limits (24h)</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.summary?.rate_limit_violations_24h || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Security Events (24h)</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.summary?.security_events_24h || 0}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Blocked Countries</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData.top_blocked_countries?.length > 0 ? (
                    <div className="space-y-2">
                      {dashboardData.top_blocked_countries.map((country, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="font-medium text-foreground">{country.country}</span>
                          <Badge variant="outline">{country.count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-foreground/70">No blocked countries in the last 24 hours</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Suspicious IPs</CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData.top_suspicious_ips?.length > 0 ? (
                    <div className="space-y-2">
                      {dashboardData.top_suspicious_ips.map((ip, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="font-mono text-sm text-foreground">{ip.ip}</span>
                          <div className="flex gap-2">
                            <Badge variant="outline">{ip.attempts} attempts</Badge>
                            <Badge variant="secondary">{ip.emails} emails</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-foreground/70">No suspicious IPs detected</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {dashboardData.recent_alerts?.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.recent_alerts.map((alert, index) => (
                  <Alert key={index} className="border-l-4 border-l-destructive">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2">
                        {getSeverityIcon(alert.severity)}
                        <div>
                          <AlertTitle className="flex items-center gap-2">
                            {alert.title}
                            <Badge variant={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                          </AlertTitle>
                          <AlertDescription className="mt-1">
                            {alert.message}
                          </AlertDescription>
                          <div className="text-xs text-foreground/50 mt-2">
                            {new Date(alert.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </Alert>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                    <p className="text-foreground/70">No active security alerts</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            {alerts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Latest Monitoring Results</h3>
                {alerts.map((alert, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {getSeverityIcon(alert.severity)}
                        {alert.title}
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{alert.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 text-sm">
                        <div><strong>Count:</strong> {alert.count}</div>
                        <div><strong>Timeframe:</strong> {alert.timeframe}</div>
                        {alert.details && (
                          <div>
                            <strong>Details:</strong>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs">
                              {JSON.stringify(alert.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
