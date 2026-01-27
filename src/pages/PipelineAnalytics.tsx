import { StandardContentCard } from "@/components/StandardContentCard"
import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/components/auth/AuthProvider"
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription"
import { useRoleBasedAccess } from "@/hooks/useRoleBasedAccess"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, Award, BarChart3 } from "lucide-react"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardPageLayout } from "@/components/StandardPageLayout"

export default function PipelineAnalytics() {
  const [pipelineStages, setPipelineStages] = useState<{ name: string; value: number }[]>([])
  const [activeTab, setActiveTab] = useState("stages")
  const { user } = useAuth()
  const { hasRole } = useRoleBasedAccess()

  const fetchStages = async () => {
    // Role-aware visibility: managers/admins see all, others see own
    const isManagerOrAdmin = hasRole('manager') || hasRole('admin') || hasRole('super_admin')

    let query = supabase
      .from('leads')
      .select(`
        *,
        contact_entity:contact_entities!leads_contact_entity_id_fkey(stage)
      `)

    if (!isManagerOrAdmin) {
      query = query.eq('user_id', user?.id)
    }

    const { data, error } = await query
    if (error) {
      console.warn('[PipelineAnalytics] fetchStages error:', error)
      setPipelineStages([])
      return
    }

    const map = new Map<string, number>()
    ;(data as any[] | null | undefined)?.forEach((l: any) => {
      const stage = l?.contact_entity?.stage ?? l?.stage ?? 'New Lead'
      map.set(stage, (map.get(stage) || 0) + 1)
    })

    setPipelineStages(Array.from(map.entries()).map(([name, value]) => ({ name, value })))
  }

  useEffect(() => {
    fetchStages()
  }, [user])

  // Live updates
  useRealtimeSubscription({ table: 'leads', event: '*', onChange: fetchStages })
  useRealtimeSubscription({ table: 'contact_entities', event: '*', onChange: fetchStages })

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Pipeline Analytics"
        subtitle="Detailed analytics and insights for your sales pipeline"
        actions={
          <Button 
            size="sm" 
            onClick={fetchStages}
            className="h-8 text-xs font-medium bg-[#0f62fe] hover:bg-[#0353e9] text-white border-2 border-[#001f3f]"
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Refresh Data
          </Button>
        }
      />
      <div className="p-8 space-y-8 animate-fade-in">

        {/* Content Area */}
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-[#0A1628] p-1 gap-2">
              <TabsTrigger 
                value="stages" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Pipeline Stages</span>
              </TabsTrigger>
              <TabsTrigger 
                value="winloss" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Win/Loss</span>
              </TabsTrigger>
              <TabsTrigger 
                value="performance" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Award className="w-4 h-4" />
                <span>Performance</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stages" className="space-y-6">
              <StandardContentCard title="Pipeline by Stage">
                <div className="space-y-4">
                  {pipelineStages.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No pipeline data</div>
                  ) : (
                    pipelineStages.map((stage) => (
                      <div className="flex justify-between items-center" key={stage.name}>
                        <span className="text-sm">{stage.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{stage.value} deals</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="winloss" className="space-y-6">
              <StandardContentCard title="Win/Loss Analysis">
                <div className="text-sm text-muted-foreground text-center py-8">
                  No win/loss data available. Track deal outcomes to see analysis here.
                </div>
              </StandardContentCard>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <StandardContentCard title="Agent Performance">
                <div className="text-sm text-muted-foreground text-center py-8">
                  No agent performance data available yet.
                </div>
              </StandardContentCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </StandardPageLayout>
  )
}