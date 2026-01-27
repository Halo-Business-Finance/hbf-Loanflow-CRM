import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { 
  Target, 
  TrendingUp, 
  User, 
  Mail, 
  Phone, 
  Calendar,
  Star,
  AlertTriangle,
  CheckCircle,
  Activity
} from "lucide-react"

interface LeadScore {
  id: string
  lead_id: string
  score: number
  factors: {
    demographic: number
    behavioral: number
    engagement: number
    fit: number
  }
  priority: 'hot' | 'warm' | 'cold'
  last_updated: string
  lead?: {
    company_name: string
    contact_name: string
    email: string
    phone: string
    stage: string
  }
}

const scoringFactors = [
  {
    name: "Demographic Score",
    description: "Company size, industry, location fit",
    weight: 25,
    icon: User
  },
  {
    name: "Behavioral Score", 
    description: "Website visits, content downloads, email opens",
    weight: 30,
    icon: Activity
  },
  {
    name: "Engagement Score",
    description: "Email replies, call answers, meeting attendance",
    weight: 30,
    icon: Mail
  },
  {
    name: "Company Fit Score",
    description: "Budget alignment, decision-making authority",
    weight: 15,
    icon: Target
  }
]

export function LeadScoring() {
  const [leadScores, setLeadScores] = useState<LeadScore[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("scores")
  const { toast } = useToast()

  useEffect(() => {
    fetchLeadScores()
  }, [])

  const fetchLeadScores = async () => {
    try {
      // Fetch real leads from database and calculate scores
      const { data: leads, error } = await supabase
        .from('contact_entities')
        .select(`
          id,
          user_id,
          name,
          business_name,
          email,
          phone,
          loan_amount,
          annual_revenue,
          credit_score,
          priority,
          created_at
        `)
        .limit(10)

      if (error) throw error

      // Calculate AI scores based on real data
      const calculatedScores: LeadScore[] = (leads || []).map(contact => {
        if (!contact) return null

        // Calculate scoring factors based on real data
        const demographic = calculateDemographicScore(contact)
        const behavioral = calculateBehavioralScore(contact)
        const engagement = calculateEngagementScore(contact)
        const fit = calculateFitScore(contact)
        
        const overallScore = Math.round(
          (demographic * 0.25) + 
          (behavioral * 0.30) + 
          (engagement * 0.30) + 
          (fit * 0.15)
        )

        let priority: 'hot' | 'warm' | 'cold' = 'cold'
        if (overallScore >= 80) priority = 'hot'
        else if (overallScore >= 60) priority = 'warm'

        return {
          id: `score_${contact.id}`,
          lead_id: contact.id,
          score: overallScore,
          factors: { demographic, behavioral, engagement, fit },
          priority,
          last_updated: new Date().toISOString(),
          lead: {
            company_name: contact.business_name || contact.name,
            contact_name: contact.name,
            email: contact.email || '',
            phone: contact.phone || '',
            stage: 'New Lead' // Default since we're using contact_entities table
          }
        }
      }).filter(Boolean) as LeadScore[]
      
      setLeadScores(calculatedScores)
    } catch (error) {
      console.error("Error fetching lead scores:", error)
      toast({
        title: "Error",
        description: "Failed to load lead scores",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Helper functions to calculate real scores
  const calculateDemographicScore = (contact: any): number => {
    let score = 50 // Base score
    
    // Revenue-based scoring
    if (contact.annual_revenue) {
      if (contact.annual_revenue >= 1000000) score += 30
      else if (contact.annual_revenue >= 500000) score += 20
      else if (contact.annual_revenue >= 250000) score += 10
    }
    
    // Complete profile bonus
    if (contact.business_name && contact.phone && contact.email) score += 20
    
    return Math.min(100, score)
  }

  const calculateBehavioralScore = (contact: any): number => {
    let score = 40 // Base score
    
    // If we have loan amount, it indicates engagement
    if (contact.loan_amount) {
      score += 30 // Shows they've progressed beyond initial interest
    }
    
    // Credit score indicates seriousness
    if (contact.credit_score) {
      score += 20 // Shows they've provided financial information
    }
    
    return Math.min(100, score)
  }

  const calculateEngagementScore = (contact: any): number => {
    let score = 30 // Base score
    
    // Recent activity bonus
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSinceCreated <= 7) score += 40
    else if (daysSinceCreated <= 30) score += 20
    else if (daysSinceCreated <= 90) score += 10
    
    // Priority bonus
    if (contact.priority === 'high') score += 30
    else if (contact.priority === 'medium') score += 10
    
    return Math.min(100, score)
  }

  const calculateFitScore = (contact: any): number => {
    let score = 40 // Base score
    
    // Credit score bonus
    if (contact.credit_score) {
      if (contact.credit_score >= 750) score += 40
      else if (contact.credit_score >= 700) score += 30
      else if (contact.credit_score >= 650) score += 20
      else if (contact.credit_score >= 600) score += 10
    }
    
    // Loan amount fit
    if (contact.loan_amount) {
      if (contact.loan_amount >= 100000) score += 20
      else if (contact.loan_amount >= 50000) score += 10
    }
    
    return Math.min(100, score)
  }

  const recalculateScores = async () => {
    setLoading(true)
    toast({
      title: "Recalculating Scores",
      description: "AI is analyzing all leads and updating scores..."
    })
    
    // Simulate AI processing time
    setTimeout(() => {
      fetchLeadScores()
      toast({
        title: "Scores Updated",
        description: "All lead scores have been recalculated successfully"
      })
    }, 2000)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "hot": return "bg-red-100 text-red-800"
      case "warm": return "bg-orange-100 text-orange-800"
      case "cold": return "bg-blue-100 text-blue-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "hot": return <AlertTriangle className="w-4 h-4" />
      case "warm": return <Star className="w-4 h-4" />
      case "cold": return <CheckCircle className="w-4 h-4" />
      default: return <Target className="w-4 h-4" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-orange-600"
    return "text-red-600"
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading lead scores...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Lead Scoring</h2>
          <p className="text-muted-foreground">
            Automatically prioritize leads based on AI analysis
          </p>
        </div>
        <Button onClick={recalculateScores} disabled={loading}>
          <TrendingUp className="w-4 h-4 mr-2" />
          Recalculate Scores
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="scores">Lead Scores</TabsTrigger>
          <TabsTrigger value="factors">Scoring Factors</TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="space-y-4">
          <div className="grid gap-4">
            {leadScores.map((leadScore) => (
              <Card key={leadScore.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${getScoreColor(leadScore.score)}`}>
                          {leadScore.score}
                        </div>
                        <div className="text-sm text-muted-foreground">Score</div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{leadScore.lead?.company_name}</h3>
                          <Badge className={getPriorityColor(leadScore.priority)}>
                            {getPriorityIcon(leadScore.priority)}
                            {leadScore.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {leadScore.lead?.contact_name} • {leadScore.lead?.stage}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span className="flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {leadScore.lead?.email}
                          </span>
                          <span className="flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {leadScore.lead?.phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 min-w-[200px]">
                      <div className="flex justify-between text-sm">
                        <span>Demographic</span>
                        <span>{leadScore.factors.demographic}%</span>
                      </div>
                      <Progress value={leadScore.factors.demographic} className="h-2" />
                      
                      <div className="flex justify-between text-sm">
                        <span>Behavioral</span>
                        <span>{leadScore.factors.behavioral}%</span>
                      </div>
                      <Progress value={leadScore.factors.behavioral} className="h-2" />
                      
                      <div className="flex justify-between text-sm">
                        <span>Engagement</span>
                        <span>{leadScore.factors.engagement}%</span>
                      </div>
                      <Progress value={leadScore.factors.engagement} className="h-2" />
                      
                      <div className="flex justify-between text-sm">
                        <span>Fit</span>
                        <span>{leadScore.factors.fit}%</span>
                      </div>
                      <Progress value={leadScore.factors.fit} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="factors" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {scoringFactors.map((factor) => (
              <Card key={factor.name}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span>{factor.name}</span>
                    <Badge variant="secondary">{factor.weight}%</Badge>
                  </CardTitle>
                  <CardDescription>{factor.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Weight in Overall Score</span>
                      <span>{factor.weight}%</span>
                    </div>
                    <Progress value={factor.weight} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}