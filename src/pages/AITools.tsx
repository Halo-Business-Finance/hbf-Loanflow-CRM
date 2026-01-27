import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { LeadScoring } from "@/components/ai/LeadScoring"
import { PredictiveAnalytics } from "@/components/ai/PredictiveAnalytics"
import { WorkflowAutomation } from "@/components/ai/WorkflowAutomation"
import { StandardPageLayout } from "@/components/StandardPageLayout"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardContentCard } from "@/components/StandardContentCard"
import { ResponsiveContainer } from "@/components/ResponsiveContainer"
import { 
  Bot, 
  Target, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  Save,
  Zap,
  Brain,
  AlertCircle,
  CheckCircle,
  Sliders
} from "lucide-react"

export default function AITools() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState("lead-scoring")
  const [configureToolId, setConfigureToolId] = useState<string | null>(null)
  const { toast } = useToast()

  // AI Tool configurations
  const [toolConfigs, setToolConfigs] = useState({
    "lead-scoring": {
      enabled: true,
      scoringThreshold: [70],
      autoUpdate: true,
      weightFactors: {
        demographic: 30,
        behavioral: 40,
        engagement: 30
      },
      notifications: true
    },
    "forecasting": {
      enabled: true,
      forecastPeriod: "quarterly",
      confidenceLevel: [85],
      includeTrends: true,
      alertThreshold: [20]
    },
    "automation": {
      enabled: true,
      triggerDelay: [2],
      maxActions: [5],
      enableEmailSequence: true,
      enableTaskCreation: true
    },
    "analytics": {
      enabled: false,
      reportFrequency: "weekly",
      dataRetention: [90],
      includeExternalData: false
    }
  })

  useEffect(() => {
    // Check if we're coming from integrations page with a specific tool to configure
    if (location.state?.configureToolId) {
      setConfigureToolId(location.state.configureToolId)
      setActiveTab("configuration")
    }
  }, [location.state])

  const aiTools = [
    {
      id: "lead-scoring",
      name: "AI Lead Scoring",
      description: "Automatically score and prioritize leads based on behavior and demographics",
      icon: Target,
      status: toolConfigs["lead-scoring"].enabled ? "active" : "inactive",
      component: LeadScoring
    },
    {
      id: "forecasting", 
      name: "Revenue Forecasting",
      description: "Predict revenue trends using machine learning algorithms",
      icon: TrendingUp,
      status: toolConfigs["forecasting"].enabled ? "active" : "inactive",
      component: PredictiveAnalytics
    },
    {
      id: "automation",
      name: "Workflow Automation", 
      description: "Automate repetitive tasks and follow-up sequences",
      icon: Bot,
      status: toolConfigs["automation"].enabled ? "active" : "inactive",
      component: WorkflowAutomation
    },
    {
      id: "analytics",
      name: "Predictive Analytics",
      description: "Advanced insights and recommendations powered by AI",
      icon: BarChart3,
      status: toolConfigs["analytics"].enabled ? "active" : "inactive",
      component: PredictiveAnalytics
    }
  ]

  const handleToolToggle = (toolId: string) => {
    setToolConfigs(prev => ({
      ...prev,
      [toolId]: {
        ...prev[toolId],
        enabled: !prev[toolId].enabled
      }
    }))
    
    const tool = aiTools.find(t => t.id === toolId)
    toast({
      title: `${tool?.name} ${!toolConfigs[toolId].enabled ? 'Enabled' : 'Disabled'}`,
      description: `${tool?.name} has been ${!toolConfigs[toolId].enabled ? 'activated' : 'deactivated'}`,
    })
  }

  const handleConfigSave = (toolId: string) => {
    toast({
      title: "Configuration Saved",
      description: `${aiTools.find(t => t.id === toolId)?.name} settings have been updated`,
    })
  }

  const renderToolConfiguration = (toolId: string) => {
    const tool = aiTools.find(t => t.id === toolId)
    const config = toolConfigs[toolId]
    
    if (!tool) return null

    return (
      <StandardContentCard className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <tool.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{tool.name} Configuration</h3>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </div>
          </div>
          <span className="text-sm font-medium">
            {config.enabled ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium text-foreground dark:text-white">Enable {tool.name}</Label>
              <p className="text-sm text-muted-foreground">Activate this AI tool for your organization</p>
            </div>
            <Switch 
              checked={config.enabled} 
              onCheckedChange={() => handleToolToggle(toolId)}
            />
          </div>
          
          <Separator />
          
          {config.enabled && (
            <div className="space-y-6">
              {toolId === "lead-scoring" && (
                <>
                  <div>
                    <Label className="text-foreground dark:text-white">Scoring Threshold ({config.scoringThreshold[0]}%)</Label>
                    <p className="text-sm text-muted-foreground mb-2">Minimum score for high-quality leads</p>
                    <Slider
                      value={config.scoringThreshold}
                      onValueChange={(value) => setToolConfigs(prev => ({
                        ...prev,
                        [toolId]: { ...prev[toolId], scoringThreshold: value }
                      }))}
                      max={100}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-foreground dark:text-white">Demographic Weight (%)</Label>
                      <Input 
                        type="number" 
                        value={config.weightFactors.demographic}
                        onChange={(e) => setToolConfigs(prev => ({
                          ...prev,
                          [toolId]: { 
                            ...prev[toolId], 
                            weightFactors: { 
                              ...prev[toolId].weightFactors, 
                              demographic: parseInt(e.target.value) || 0 
                            }
                          }
                        }))}
                        min="0" 
                        max="100" 
                      />
                    </div>
                    <div>
                      <Label className="text-foreground dark:text-white">Behavioral Weight (%)</Label>
                      <Input 
                        type="number" 
                        value={config.weightFactors.behavioral}
                        onChange={(e) => setToolConfigs(prev => ({
                          ...prev,
                          [toolId]: { 
                            ...prev[toolId], 
                            weightFactors: { 
                              ...prev[toolId].weightFactors, 
                              behavioral: parseInt(e.target.value) || 0 
                            }
                          }
                        }))}
                        min="0" 
                        max="100" 
                      />
                    </div>
                    <div>
                      <Label className="text-foreground dark:text-white">Engagement Weight (%)</Label>
                      <Input 
                        type="number" 
                        value={config.weightFactors.engagement}
                        onChange={(e) => setToolConfigs(prev => ({
                          ...prev,
                          [toolId]: { 
                            ...prev[toolId], 
                            weightFactors: { 
                              ...prev[toolId].weightFactors, 
                              engagement: parseInt(e.target.value) || 0 
                            }
                          }
                        }))}
                        min="0" 
                        max="100" 
                      />
                    </div>
                  </div>
                </>
              )}

              {toolId === "forecasting" && (
                <>
                  <div>
                    <Label className="text-foreground dark:text-white">Forecast Period</Label>
                    <Select 
                      value={config.forecastPeriod} 
                      onValueChange={(value) => setToolConfigs(prev => ({
                        ...prev,
                        [toolId]: { ...prev[toolId], forecastPeriod: value }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-foreground dark:text-white">Confidence Level ({config.confidenceLevel[0]}%)</Label>
                    <Slider
                      value={config.confidenceLevel}
                      onValueChange={(value) => setToolConfigs(prev => ({
                        ...prev,
                        [toolId]: { ...prev[toolId], confidenceLevel: value }
                      }))}
                      max={99}
                      min={50}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {toolId === "automation" && (
                <>
                  <div>
                    <Label className="text-foreground dark:text-white">Trigger Delay (hours)</Label>
                    <Slider
                      value={config.triggerDelay}
                      onValueChange={(value) => setToolConfigs(prev => ({
                        ...prev,
                        [toolId]: { ...prev[toolId], triggerDelay: value }
                      }))}
                      max={72}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground">Wait {config.triggerDelay[0]} hour(s) before triggering automation</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground dark:text-white">Enable Email Sequences</Label>
                      <Switch 
                        checked={config.enableEmailSequence}
                        onCheckedChange={(checked) => setToolConfigs(prev => ({
                          ...prev,
                          [toolId]: { ...prev[toolId], enableEmailSequence: checked }
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground dark:text-white">Enable Task Creation</Label>
                      <Switch 
                        checked={config.enableTaskCreation}
                        onCheckedChange={(checked) => setToolConfigs(prev => ({
                          ...prev,
                          [toolId]: { ...prev[toolId], enableTaskCreation: checked }
                        }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {toolId === "analytics" && (
                <>
                  <div>
                    <Label className="text-foreground dark:text-white">Report Frequency</Label>
                    <Select 
                      value={config.reportFrequency} 
                      onValueChange={(value) => setToolConfigs(prev => ({
                        ...prev,
                        [toolId]: { ...prev[toolId], reportFrequency: value }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-foreground dark:text-white">Data Retention (days)</Label>
                    <Slider
                      value={config.dataRetention}
                      onValueChange={(value) => setToolConfigs(prev => ({
                        ...prev,
                        [toolId]: { ...prev[toolId], dataRetention: value }
                      }))}
                      max={365}
                      min={30}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-sm text-muted-foreground">Keep data for {config.dataRetention[0]} days</p>
                  </div>
                </>
              )}
              
              <div className="flex justify-end pt-4">
                <Button onClick={() => handleConfigSave(toolId)} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Configuration
                </Button>
              </div>
            </div>
          )}
        </div>
      </StandardContentCard>
    )
  }

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="AI Intelligence Center"
        subtitle="Advanced AI-powered tools for enhanced CRM performance"
      />

      <ResponsiveContainer>
        <div className="space-y-6">
          {/* AI Tools Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StandardContentCard className="border-l-4 border-l-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Tools</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Zap className="w-5 h-5" />
                    <p className="text-lg font-bold">{aiTools.filter(t => t.status === 'active').length}</p>
                  </div>
                </div>
                <span className="text-sm font-medium">RUNNING</span>
              </div>
            </StandardContentCard>

            <StandardContentCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Lead Scoring</p>
                  <p className="text-2xl font-bold text-primary">95%</p>
                </div>
                <Target className="w-8 h-8 text-primary" />
              </div>
            </StandardContentCard>

            <StandardContentCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Automation Tasks</p>
                  <p className="text-2xl font-bold text-primary">47</p>
                </div>
                <Bot className="w-8 h-8 text-primary" />
              </div>
            </StandardContentCard>

            <StandardContentCard>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Forecast Accuracy</p>
                  <p className="text-2xl font-bold text-primary">88%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
            </StandardContentCard>
          </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-5 bg-card/50 backdrop-blur-sm rounded-2xl p-1">
            <TabsTrigger value="lead-scoring" className="rounded-xl">
              <Target className="w-4 h-4 mr-2" />
              Lead Scoring
            </TabsTrigger>
            <TabsTrigger value="forecasting" className="rounded-xl">
              <TrendingUp className="w-4 h-4 mr-2" />
              Forecasting
            </TabsTrigger>
            <TabsTrigger value="automation" className="rounded-xl">
              <Bot className="w-4 h-4 mr-2" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="configuration" className="rounded-xl">
              <Settings className="w-4 h-4 mr-2" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lead-scoring">
            <LeadScoring />
          </TabsContent>

          <TabsContent value="forecasting">
            <PredictiveAnalytics />
          </TabsContent>

          <TabsContent value="automation">
            <WorkflowAutomation />
          </TabsContent>

          <TabsContent value="analytics">
            <PredictiveAnalytics />
          </TabsContent>

          <TabsContent value="configuration" className="space-y-6">
            <div className="grid gap-6">
              <StandardContentCard title="AI Tools Configuration" className="border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sliders className="w-5 h-5" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure individual AI tools and their parameters
                </p>
                  <div className="grid gap-6">
                    {configureToolId ? (
                      renderToolConfiguration(configureToolId)
                    ) : (
                      <div className="grid gap-4">
                        <p className="text-muted-foreground">
                          Select an AI tool to configure its settings:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {aiTools.map((tool) => (
                            <div
                              key={tool.id}
                              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                              onClick={() => setConfigureToolId(tool.id)}
                            >
                              <StandardContentCard>
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-primary/10 rounded-lg">
                                    <tool.icon className="w-5 h-5 text-primary" />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="font-medium text-foreground">{tool.name}</h3>
                                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                                  </div>
                                  <span className="text-sm font-medium">
                                    {tool.status === "active" ? (
                                      <CheckCircle className="w-3 h-3 mr-1 inline" />
                                    ) : (
                                      <AlertCircle className="w-3 h-3 mr-1 inline" />
                                    )}
                                    {tool.status}
                                  </span>
                                </div>
                              </StandardContentCard>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {configureToolId && (
                      <div className="mt-6">
                        {renderToolConfiguration(configureToolId)}
                        <div className="mt-4 flex justify-start">
                          <Button 
                            variant="outline" 
                            onClick={() => setConfigureToolId(null)}
                          >
                            ← Back to Tool Selection
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
              </StandardContentCard>
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </ResponsiveContainer>
    </StandardPageLayout>
  )
}