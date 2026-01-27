import { StandardPageLayout } from "@/components/StandardPageLayout"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardContentCard } from "@/components/StandardContentCard"
import { ResponsiveContainer } from "@/components/ResponsiveContainer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Settings, Trash2, GripVertical } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface LoanStage {
  id: string
  name: string
  order_position: number
  probability: number
  color: string
  is_active: boolean
  description?: string
}

export default function StageManagement() {
  const [stages, setStages] = useState<LoanStage[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchStages()
  }, [])

  const fetchStages = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('loan_stages')
        .select('*')
        .order('order_position', { ascending: true })

      if (error) throw error

      setStages(data || [])
    } catch (error) {
      console.error('Error fetching loan stages:', error)
      toast({
        title: "Error",
        description: "Failed to load loan stages",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleStageActive = async (stageId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('loan_stages')
        .update({ is_active: !currentActive })
        .eq('id', stageId)

      if (error) throw error

      await fetchStages()
      toast({
        title: "Success",
        description: `Stage ${!currentActive ? 'activated' : 'deactivated'} successfully`
      })
    } catch (error) {
      console.error('Error updating stage:', error)
      toast({
        title: "Error",
        description: "Failed to update stage",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <StandardPageLayout>
        <IBMPageHeader
          title="Stage Management"
          subtitle="Loading stages..."
        />
        <ResponsiveContainer>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse border border-border rounded-lg p-4">
                <div className="h-6 bg-muted rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </ResponsiveContainer>
      </StandardPageLayout>
    )
  }

  return (
    <StandardPageLayout>
      <IBMPageHeader
        title="Stage Management"
        subtitle="Configure and manage your sales pipeline stages"
      />

      <ResponsiveContainer>
        <div className="space-y-6">

          <StandardContentCard 
            title="Pipeline Stages"
            headerActions={
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Stage
              </Button>
            }
          >
            <div className="space-y-4">
              {stages.map((stage) => (
                <div key={stage.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="cursor-move">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                    <div className="md:col-span-2">
                      <div className="font-medium">{stage.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {stage.description || 'No description'}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Order</div>
                      <div className="font-medium">{stage.order_position}</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Probability</div>
                      <div className="font-medium">{stage.probability}%</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Status</div>
                      <Switch 
                        checked={stage.is_active} 
                        onCheckedChange={() => toggleStageActive(stage.id, stage.is_active)}
                      />
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </StandardContentCard>

          <div className="grid gap-6 md:grid-cols-2">
            <StandardContentCard title="Add New Stage">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stageName">Stage Name</Label>
                  <Input id="stageName" placeholder="Enter stage name" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="probability">Win Probability (%)</Label>
                  <Input id="probability" type="number" placeholder="50" min="0" max="100" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stageColor">Stage Color</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="yellow">Yellow</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="Describe this stage..." />
                </div>

                <Button className="w-full">Create Stage</Button>
              </div>
            </StandardContentCard>

            <StandardContentCard title="Stage Settings">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Auto-advance deals</div>
                    <div className="text-sm text-muted-foreground">
                      Automatically move deals based on criteria
                    </div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Required fields validation</div>
                    <div className="text-sm text-muted-foreground">
                      Require certain fields before stage advancement
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Stage activity tracking</div>
                    <div className="text-sm text-muted-foreground">
                      Track time spent in each stage
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultStage">Default Stage for New Deals</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select default stage" />
                    </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="staleTime">Mark deals as stale after (days)</Label>
                  <Input id="staleTime" type="number" placeholder="30" />
                </div>

                <Button className="w-full">Save Settings</Button>
              </div>
            </StandardContentCard>
          </div>
        </div>
      </ResponsiveContainer>
    </StandardPageLayout>
  )
}