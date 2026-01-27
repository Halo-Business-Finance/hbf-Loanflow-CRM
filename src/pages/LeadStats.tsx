import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// Badge component removed - using plain text instead
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, TrendingUp, TrendingDown, Users, Target, Clock } from "lucide-react"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardContentCard } from "@/components/StandardContentCard"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/components/auth/AuthProvider"

interface LeadStats {
  totalLeads: number
  conversionRate: number
  qualifiedLeads: number
  avgResponseTime: number
  convertedLeads: number
  newLeads: number
}

export default function LeadStats() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [stats, setStats] = useState<LeadStats>({
    totalLeads: 0,
    conversionRate: 0,
    qualifiedLeads: 0,
    avgResponseTime: 0,
    convertedLeads: 0,
    newLeads: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchLeadStats()
    }
  }, [user])

  const fetchLeadStats = async () => {
    try {
      setLoading(true)
      
      // Fetch contact entities directly with user_id filter
      const { data: contactEntities, error } = await supabase
        .from('contact_entities')
        .select(`
          id,
          stage,
          priority,
          user_id,
          created_at
        `)
        .eq('user_id', user?.id)

      if (error) throw error

      const totalLeads = contactEntities?.length || 0
      
      // Count converted leads (Loan Funded or Closed Won)
      const convertedLeads = contactEntities?.filter(ce => 
        ce.stage === 'Loan Funded' || ce.stage === 'Closed Won'
      ).length || 0
      
      // Count qualified leads (Pre-approval or Term Sheet Signed)
      const qualifiedLeads = contactEntities?.filter(ce => 
        ce.stage === 'Pre-approval' || ce.stage === 'Term Sheet Signed'
      ).length || 0
      
      // Count new leads (Initial Contact or New Lead)
      const newLeads = contactEntities?.filter(ce => 
        ce.stage === 'Initial Contact' || ce.stage === 'New Lead'
      ).length || 0
      
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      setStats({
        totalLeads,
        conversionRate,
        qualifiedLeads,
        avgResponseTime: 0,
        convertedLeads,
        newLeads
      })
    } catch (error) {
      console.error('Error fetching lead stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <IBMPageHeader 
        title="Lead Statistics"
        subtitle="Track lead performance metrics and conversion rates"
      />
      <div className="p-8 space-y-8 animate-fade-in">
        
        <Tabs value={location.pathname} onValueChange={(value) => navigate(value)}>
            <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted p-1">
              <TabsTrigger value="/leads/assignment" className="flex items-center gap-2 data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white hover:bg-[#0f62fe]/10">
                <Users className="h-4 w-4" />
                Lead Assignment
              </TabsTrigger>
              <TabsTrigger value="/leads/stats" className="flex items-center gap-2 data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white hover:bg-[#0f62fe]/10">
                <BarChart3 className="h-4 w-4" />
                Lead Stats
              </TabsTrigger>
            </TabsList>
          </Tabs>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-blue-600 animate-fade-in">
              <CardContent className="p-6 widget-content">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Total Leads</span>
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">{loading ? "..." : stats.totalLeads}</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <TrendingUp className="h-3 w-3 mr-1 text-primary" />
                  <span className="text-primary">Active in pipeline</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-blue-600 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-6 widget-content">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Conversion Rate</span>
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {loading ? "..." : `${stats.conversionRate.toFixed(1)}%`}
                </div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <span className="text-muted-foreground">{stats.convertedLeads} converted</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-blue-600 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-6 widget-content">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Qualified Leads</span>
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">{loading ? "..." : stats.qualifiedLeads}</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <span className="text-muted-foreground">Ready for proposal</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-blue-600 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CardContent className="p-6 widget-content">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Avg. Response Time</span>
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-foreground">—</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  <span className="text-muted-foreground">Not tracked</span>
                </div>
              </CardContent>
            </Card>
        </div>

        {/* Detailed Statistics */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <StandardContentCard
              title="Lead Sources"
              className="border border-blue-600"
                headerActions={
                  <span className="text-xs text-muted-foreground">Distribution breakdown</span>
                }
              >
              <div className="text-sm text-muted-foreground text-center py-8">
                Lead source tracking not yet implemented.
              </div>
            </StandardContentCard>
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <StandardContentCard
              title="Lead Status Distribution"
              className="border border-blue-600"
                headerActions={
                  <span className="text-xs text-muted-foreground">Current pipeline status</span>
                }
              >
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm font-medium">New</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '35%' }} />
                    </div>
                    <span className="text-xs font-medium">{loading ? "..." : stats.newLeads}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm font-medium">Qualified</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium">{loading ? "..." : stats.qualifiedLeads}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium">Converted</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '20%' }} />
                    </div>
                    <span className="text-xs font-medium">
                      {loading ? "..." : stats.convertedLeads}
                    </span>
                  </div>
                </div>
              </div>
            </StandardContentCard>
          </div>
        </div>
      </div>
    </div>
  )
}