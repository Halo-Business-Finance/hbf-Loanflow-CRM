import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  Zap, 
  Mail, 
  Calendar, 
  FileText, 
  Clock,
  Settings,
  Play,
  Pause,
  CheckCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Automation {
  id: string
  name: string
  trigger: string
  action: string
  enabled: boolean
  runs: number
}

const AUTOMATION_STORAGE_KEY = "loanflow-automation-rules"
const WEBHOOK_STORAGE_KEY = "loanflow-zapier-webhook"

const defaultAutomations: Automation[] = [
  {
    id: "1",
    name: "Lead Loan Stage Change → Send Document",
    trigger: "Lead moves to 'Loan Application Signed'",
    action: "Send loan application via DocuSign",
    enabled: true,
    runs: 23
  },
  {
    id: "2", 
    name: "Follow-up Reminder",
    trigger: "No contact for 3 days",
    action: "Create task + send email reminder",
    enabled: true,
    runs: 45
  },
  {
    id: "3",
    name: "Document Completion Alert",
    trigger: "DocuSign document signed",
    action: "Move lead to 'Documentation' stage",
    enabled: false,
    runs: 12
  },
  {
    id: "4",
    name: "High-Value Lead Alert",
    trigger: "Loan amount > $1M",
    action: "Notify manager + schedule call",
    enabled: true,
    runs: 8
  }
]

export function WorkflowAutomation() {
  // Load webhook URL from secure storage
  const [webhookUrl, setWebhookUrl] = useState(() => {
    try {
      // Use session storage for temporary data, not localStorage for security
      return sessionStorage.getItem(WEBHOOK_STORAGE_KEY) || ""
    } catch {
      return ""
    }
  })

  // Load automations from secure storage (session only)
  const [automations, setAutomations] = useState<Automation[]>(() => {
    try {
      const stored = sessionStorage.getItem(AUTOMATION_STORAGE_KEY)
      return stored ? JSON.parse(stored) : defaultAutomations
    } catch {
      return defaultAutomations
    }
  })

  // Save webhook URL to session storage when it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(WEBHOOK_STORAGE_KEY, webhookUrl)
    } catch (error) {
      console.error("Error saving webhook URL:", error)
    }
  }, [webhookUrl])

  // Save automations to session storage when they change
  useEffect(() => {
    try {
      sessionStorage.setItem(AUTOMATION_STORAGE_KEY, JSON.stringify(automations))
    } catch (error) {
      console.error("Error saving automation rules:", error)
    }
  }, [automations])

  const { toast } = useToast()

  const handleWebhookTest = async () => {
    if (!webhookUrl) {
      toast({
        title: "Missing Webhook URL",
        description: "Please enter your Zapier webhook URL first",
        variant: "destructive",
      })
      return
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          message: "Test webhook from CRM"
        }),
      })

      toast({
        title: "Webhook Test Sent",
        description: "Check your Zapier dashboard to confirm receipt",
      })
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Unable to send test webhook",
        variant: "destructive",
      })
    }
  }

  const toggleAutomation = (id: string) => {
    setAutomations(prev => 
      prev.map(automation => 
        automation.id === id 
          ? { ...automation, enabled: !automation.enabled }
          : automation
      )
    )
    
    const automation = automations.find(a => a.id === id)
    toast({
      title: `Automation ${automation?.enabled ? 'Disabled' : 'Enabled'}`,
      description: `${automation?.name} has been ${automation?.enabled ? 'paused' : 'activated'}`,
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Zapier Integration */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>
            Zapier Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="webhook">Zapier Webhook URL</Label>
            <Input
              id="webhook"
              placeholder="https://your-automation-service.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Create a webhook trigger in Zapier to connect 5,000+ apps
            </p>
          </div>

          <Button onClick={handleWebhookTest} className="w-full gap-2">
            <Zap className="h-4 w-4" />
            Test Webhook Connection
          </Button>

          <div className="space-y-3">
            <h4 className="font-medium">Popular Integrations:</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                <Mail className="h-4 w-4" />
                Gmail
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                <Calendar className="h-4 w-4" />
                Calendly
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                <FileText className="h-4 w-4" />
                DocuSign
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                <Settings className="h-4 w-4" />
                Slack
              </div>
            </div>
          </div>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              <strong>Setup Guide:</strong> Create a new Zap with "Webhooks by Zapier" as the trigger, 
              then connect your desired actions like sending emails or updating spreadsheets.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Automation Rules */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>
            Automation Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {automations.map((automation) => (
              <div key={automation.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{automation.name}</h4>
                    <Switch
                      checked={automation.enabled}
                      onCheckedChange={() => toggleAutomation(automation.id)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>When:</strong> {automation.trigger}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Then:</strong> {automation.action}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {automation.runs} runs
                    </Badge>
                    {automation.enabled ? (
                      <Badge variant="default" className="text-xs">
                        <Play className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Pause className="h-3 w-3 mr-1" />
                        Paused
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => {
              // Create new automation functionality
              const { toast } = require("@/hooks/use-toast")
              toast({
                title: "Create Automation",
                description: "Automation builder will be available in the next release.",
              })
            }}
          >
            <Settings className="h-4 w-4" />
            Create New Automation
          </Button>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Automation Ideas:</h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Auto-schedule follow-up calls
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Send documents based on loan type
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Create calendar events for milestones
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Notify team of high-priority leads
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}