import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { ibmDb } from "@/lib/ibm"
import { StandardPageLayout } from "@/components/StandardPageLayout"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"
import { StandardContentCard } from "@/components/StandardContentCard"
import { ResponsiveContainer } from "@/components/ResponsiveContainer"
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Calendar, 
  CreditCard, 
  FileText, 
  Zap, 
  BarChart3,
  Users,
  Settings,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Bot,
  Target,
  Clock,
  TrendingUp,
  Search,
  Filter,
  Star,
  Sparkles,
  ArrowRight,
  Shield,
  Workflow,
  FileImage
} from "lucide-react"

const integrations = [
  {
    id: "email",
    name: "Email Marketing",
    description: "Connect with Mailchimp, HubSpot, or custom SMTP",
    icon: Mail,
    category: "communication",
    status: "available",
    features: ["Drip campaigns", "Email templates", "Open tracking", "Click tracking"]
  },
  {
    id: "sms",
    name: "SMS Integration",
    description: "Two-way SMS messaging with clients",
    icon: MessageSquare,
    category: "communication", 
    status: "available",
    features: ["Bulk SMS", "Two-way messaging", "SMS templates", "Delivery reports"]
  },
  {
    id: "calendar",
    name: "Calendar Sync",
    description: "Sync with Google Calendar, Outlook, and more",
    icon: Calendar,
    category: "productivity",
    status: "connected",
    features: ["Two-way sync", "Meeting scheduling", "Availability", "Reminders"]
  },
  {
    id: "accounting",
    name: "Accounting Software",
    description: "Connect with QuickBooks, Xero, FreshBooks",
    icon: CreditCard,
    category: "finance",
    status: "available",
    features: ["Invoice sync", "Payment tracking", "Expense management", "Reports"]
  },
  {
    id: "esignature",
    name: "E-Signature",
    description: "DocuSign, HelloSign integration",
    icon: FileText,
    category: "documents",
    status: "available",
    features: ["Document signing", "Templates", "Audit trail", "Reminders"]
  },
  {
    id: "adobe-pdf",
    name: "Adobe PDF Embed",
    description: "Advanced PDF viewing and document management with Adobe services",
    icon: FileImage,
    category: "documents",
    status: "connected",
    features: ["PDF viewer", "Document embedding", "Annotation tools", "Professional viewing"]
  },
  {
    id: "zapier",
    name: "Zapier Automation",
    description: "Connect with 5000+ apps via Zapier",
    icon: Zap,
    category: "automation",
    status: "connected",
    features: ["Automated workflows", "Data sync", "Triggers", "Multi-step zaps"]
  }
]

const aiTools = [
  {
    id: "lead-scoring",
    name: "AI Lead Scoring",
    description: "Automatically score and prioritize leads",
    icon: Target,
    status: "active",
    features: ["Behavioral scoring", "Demographic analysis", "Engagement tracking", "Priority ranking"]
  },
  {
    id: "forecasting",
    name: "Revenue Forecasting",
    description: "Predict revenue based on pipeline data",
    icon: TrendingUp,
    status: "active", 
    features: ["Pipeline analysis", "Seasonal trends", "Confidence intervals", "Goal tracking"]
  },
  {
    id: "automation",
    name: "Workflow Automation",
    description: "Automate repetitive tasks and follow-ups",
    icon: Bot,
    status: "active",
    features: ["Task automation", "Email sequences", "Stage transitions", "Reminders"]
  },
  {
    id: "analytics",
    name: "Predictive Analytics",
    description: "AI-powered insights and recommendations",
    icon: BarChart3,
    status: "available",
    features: ["Performance insights", "Trend analysis", "Recommendations", "Custom reports"]
  }
]

export default function Integrations() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("integrations")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [emailSettings, setEmailSettings] = useState({
    provider: "",
    apiKey: "",
    enabled: false
  })
  const [adobeConfig, setAdobeConfig] = useState({
    clientId: "",
    isDemo: true,
    hasApiKey: false,
    status: "demo" as "demo" | "licensed",
    features: {
      pdfViewer: true,
      documentEmbed: true,
      apiAccess: false,
      advancedFeatures: false
    }
  })
  const [showAdobeConfig, setShowAdobeConfig] = useState(false)
  const [showAdobeSecretForm, setShowAdobeSecretForm] = useState(false)
  const { toast } = useToast()

  // Fetch Adobe configuration on component mount
  useEffect(() => {
    fetchAdobeConfig()
  }, [])

  const fetchAdobeConfig = async () => {
    try {
      const { data, error } = await ibmDb.rpc('get-adobe-config')
      if (error) throw error
      if (data) {
        setAdobeConfig(data as any)
      }
    } catch (error) {
      console.error('Error fetching Adobe config:', error)
    }
  }

  const handleBrowseMarketplace = () => {
    // Open the integrations marketplace in a new tab
    window.open('https://zapier.com/apps', '_blank')
    toast({
      title: "Opening Integration Marketplace",
      description: "Browse thousands of available integrations",
    })
  }

  const handleWebhookSave = () => {
    if (webhookUrl) {
      toast({
        title: "Webhook URL Saved",
        description: "Zapier integration configured successfully",
      })
    }
  }

  const handleIntegrationToggle = (integrationId: string, enabled: boolean) => {
    if (integrationId === "adobe-pdf") {
      setShowAdobeConfig(true)
      return
    }
    
    toast({
      title: enabled ? "Integration Enabled" : "Integration Disabled",
      description: `${integrations.find(i => i.id === integrationId)?.name} has been ${enabled ? 'enabled' : 'disabled'}`,
    })
  }

  const handleIntegrationConfigure = (integrationId: string) => {
    if (integrationId === "adobe-pdf") {
      setShowAdobeConfig(true)
      return
    }
    
    toast({
      title: "Opening Configuration",
      description: `Configure ${integrations.find(i => i.id === integrationId)?.name} settings`,
    })
  }

  const handleAIToolToggle = (toolId: string, enabled: boolean) => {
    const tool = aiTools.find(t => t.id === toolId)
    if (!tool) return

    toast({
      title: enabled ? "AI Tool Enabled" : "AI Tool Disabled",
      description: `${tool.name} has been ${enabled ? 'enabled' : 'disabled'}`,
    })
    
    // Update the tool status in the array (in a real app, this would update the backend)
    const updatedTools = aiTools.map(t => 
      t.id === toolId ? { ...t, status: enabled ? "active" : "available" } : t
    )
    // In a real implementation, you would update state here
  }

  const handleAIToolAction = (toolId: string, status: string) => {
    const tool = aiTools.find(t => t.id === toolId)
    if (!tool) return

    if (status === "active") {
      // Navigate to AI Tools configuration page
      navigate('/ai-tools', { state: { configureToolId: toolId } })
      toast({
        title: "Opening Configuration",
        description: `Configure ${tool.name} settings`,
      })
    } else {
      // Enable the tool
      toast({
        title: "AI Tool Enabled",
        description: `${tool.name} has been enabled successfully`,
      })
    }
  }

  // Filter integrations based on search and category
  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || integration.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Filter AI tools based on search
  const filteredAITools = aiTools.filter(tool => 
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
      case "active":
        return "bg-accent/10 text-accent border-accent/20"
      case "available":
        return "bg-primary/10 text-primary border-primary/20"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
      case "active":
        return <CheckCircle className="w-3 h-3" />
      case "available":
        return <Clock className="w-3 h-3" />
      default:
        return <AlertCircle className="w-3 h-3" />
    }
  }

  const categoryFilters = [
    { id: "all", name: "All Categories", icon: Filter },
    { id: "communication", name: "Communication", icon: MessageSquare },
    { id: "productivity", name: "Productivity", icon: Calendar },
    { id: "finance", name: "Finance", icon: CreditCard },
    { id: "documents", name: "Documents", icon: FileText },
    { id: "automation", name: "Automation", icon: Workflow }
  ]

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Integrations"
        subtitle="Connect external services and configure AI-powered automation tools"
      />
      
      <ResponsiveContainer padding="md">
        <div className="space-y-6">
          {/* Search and Filter Row */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search integrations..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categoryFilters.slice(0, 4).map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="whitespace-nowrap"
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="integrations" className="gap-2">
                <Workflow className="w-4 h-4" />
                <span className="hidden sm:inline">Third-Party</span> Integrations
              </TabsTrigger>
              <TabsTrigger value="ai-tools" className="gap-2">
                <Bot className="w-4 h-4" />
                AI Tools
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="gap-2">
                <Zap className="w-4 h-4" />
                Webhooks
              </TabsTrigger>
            </TabsList>

          <TabsContent value="integrations" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredIntegrations.map((integration) => (
                <StandardContentCard 
                  key={integration.id}
                  className="group hover:shadow-lg transition-all duration-300"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                          {integration.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(integration.status)}
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">
                            {integration.status}
                          </span>
                        </div>
                      </div>
                      <Switch 
                        checked={integration.status === "connected"}
                        onCheckedChange={(enabled) => handleIntegrationToggle(integration.id, enabled)}
                      />
                    </div>
                    
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {integration.description}
                    </p>
                    
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Key Features</Label>
                      <div className="flex flex-wrap gap-2">
                        {integration.features.slice(0, 3).map((feature) => (
                          <span key={feature} className="text-xs px-2 py-1 rounded-lg bg-muted">
                            {feature}
                          </span>
                        ))}
                        {integration.features.length > 3 && (
                          <span className="text-xs px-2 py-1 rounded-lg bg-muted">
                            +{integration.features.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    <Button 
                      className="w-full"
                      variant={integration.status === "connected" ? "outline" : "default"}
                      onClick={() => handleIntegrationConfigure(integration.id)}
                    >
                      {integration.status === "connected" ? (
                        <>
                          <Settings className="w-4 h-4 mr-2" />
                          Configure
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4 mr-2" />
                          Connect Now
                        </>
                      )}
                    </Button>
                  </div>
                </StandardContentCard>
              ))}

              {filteredIntegrations.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="w-16 h-16 bg-muted/20 rounded-2xl mx-auto mb-4 flex items-center justify-between">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No integrations found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          </TabsContent>

        <TabsContent value="ai-tools" className="space-y-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-muted rounded-full px-4 py-2 mb-4">
                <Bot className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">AI-Powered Intelligence</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Intelligent Automation Tools</h2>
              <p className="text-muted-foreground">Leverage AI to automate tasks and gain actionable insights</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {filteredAITools.map((tool) => (
                <StandardContentCard 
                  key={tool.id}
                  className="group hover:shadow-lg transition-all duration-300"
                >
                  <div className="space-y-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                          {tool.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(tool.status)}
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">
                            {tool.status}
                          </span>
                          {tool.status === "active" && (
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                              <span className="text-xs text-accent ml-1">Live</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Switch 
                        checked={tool.status === "active"}
                        onCheckedChange={(enabled) => handleAIToolToggle(tool.id, enabled)}
                      />
                    </div>
                    
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                    
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">AI Capabilities</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {tool.features.map((feature) => (
                          <div key={feature} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                            <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                            <span className="text-xs">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button 
                      className="w-full"
                      variant={tool.status === "active" ? "outline" : "default"}
                      onClick={() => handleAIToolAction(tool.id, tool.status)}
                    >
                      {tool.status === "active" ? (
                        <>
                          <Settings className="w-4 h-4 mr-2" />
                          Configure AI
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Enable AI
                        </>
                      )}
                    </Button>
                  </div>
                </StandardContentCard>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <StandardContentCard title="Zapier Integration">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect your CRM to 5000+ apps via Zapier webhooks
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://hooks.zapier.com/hooks/catch/..."
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleWebhookSave} className="w-full">
                    <Zap className="w-4 h-4 mr-2" />
                    Save Webhook URL
                  </Button>
                </div>
              </StandardContentCard>

              <StandardContentCard title="API Configuration">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage API endpoints and developer access
                  </p>
                  <div className="space-y-3">
                    <Label>Active Endpoints</Label>
                    <div className="space-y-2 text-sm">
                      {[
                        { endpoint: "GET /api/leads", status: "Active" },
                        { endpoint: "POST /api/clients", status: "Active" },
                        { endpoint: "GET /api/pipeline", status: "Active" }
                      ].map((api, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <span className="font-mono">{api.endpoint}</span>
                          <span className="text-xs font-medium">{api.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </StandardContentCard>
            </div>
          </TabsContent>
        </Tabs>
        </div>

        {/* Adobe Configuration Dialog */}
        <Dialog open={showAdobeConfig} onOpenChange={setShowAdobeConfig}>
          <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <FileImage className="w-5 h-5 text-red-600" />
                  Adobe PDF Configuration
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Configure your Adobe PDF Embed API credentials
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                {/* Current Status */}
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <span className="text-sm font-medium">
                      {adobeConfig.isDemo ? 'Demo Mode' : 'Licensed'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Client ID</span>
                    <span className="text-xs font-medium">
                      {adobeConfig.isDemo ? 'Demo' : 'Configured'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">API Key</span>
                    <span className="text-xs font-medium">
                      {adobeConfig.hasApiKey ? 'Configured' : 'Not Set'}
                    </span>
                  </div>
                  {!adobeConfig.isDemo && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Advanced Features</span>
                      <span className="text-xs font-medium">
                        {adobeConfig.hasApiKey ? 'Available' : 'Limited'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Configuration Section */}
                <div className="space-y-3 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">API Configuration</span>
                    <span className="text-xs font-medium">
                      {adobeConfig.isDemo ? 'Demo Mode' : 'Production'}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Configure your Adobe credentials for full access:
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAdobeConfig(false)
                          toast({
                            title: "Adobe Client ID",
                            description: "Please enter your Adobe Client ID to upgrade from demo to licensed version.",
                          })
                        }}
                        className="text-xs"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Client ID
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAdobeConfig(false)
                          toast({
                            title: "Adobe API Key",
                            description: "Please enter your Adobe API Key for enhanced functionality.",
                          })
                        }}
                        className="text-xs"
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        API Key
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Quick Features */}
                <div className="space-y-2">
                  <span className="text-sm font-medium">Features Enabled</span>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 bg-green-500 rounded-full" />
                      <span>PDF Viewer</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 bg-green-500 rounded-full" />
                      <span>Document Embed</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 bg-green-500 rounded-full" />
                      <span>Zoom Controls</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 bg-green-500 rounded-full" />
                      <span>Mobile Ready</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://developer.adobe.com/document-services/docs/overview/pdf-embed-api/', '_blank')}
                    className="flex-1 text-xs"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Docs
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      // Refresh the Adobe configuration to get latest status
                      await fetchAdobeConfig()
                      toast({
                        title: "Adobe Integration Updated",
                        description: "Configuration refreshed with latest credentials.",
                      })
                      setShowAdobeConfig(false)
                    }}
                    className="flex-1 text-xs"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Refresh & Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
      </ResponsiveContainer>
    </StandardPageLayout>
  )
}