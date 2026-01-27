import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Target,
  Calendar,
  DollarSign,
  Users,
  Clock,
  Brain
} from "lucide-react"

interface Prediction {
  leadId: string
  leadName: string
  currentStage: string
  closeProbability: number
  predictedCloseDate: string
  estimatedValue: number
  riskFactors: string[]
  recommendations: string[]
}

export function PredictiveAnalytics() {
  const [predictions] = useState<Prediction[]>([
    {
      leadId: "1",
      leadName: "Sarah Johnson",
      currentStage: "Loan Application Signed",
      closeProbability: 85,
      predictedCloseDate: "2025-02-15",
      estimatedValue: 450000,
      riskFactors: ["Credit score slightly below average"],
      recommendations: ["Schedule follow-up within 2 days", "Prepare additional documentation"]
    },
    {
      leadId: "2", 
      leadName: "Michael Chen",
      currentStage: "Proposal",
      closeProbability: 72,
      predictedCloseDate: "2025-02-28",
      estimatedValue: 320000,
      riskFactors: ["Long decision timeline", "Multiple lenders contacted"],
      recommendations: ["Offer competitive rate", "Emphasize faster closing"]
    },
    {
      leadId: "3",
      leadName: "Emily Rodriguez",
      currentStage: "Documentation",
      closeProbability: 94,
      predictedCloseDate: "2025-02-08",
      estimatedValue: 275000,
      riskFactors: [],
      recommendations: ["Prepare closing documents", "Schedule final walkthrough"]
    },
    {
      leadId: "4",
      leadName: "David Thompson",
      currentStage: "Initial Contact",
      closeProbability: 45,
      predictedCloseDate: "2025-03-15",
      estimatedValue: 180000,
      riskFactors: ["First-time buyer", "Limited savings"],
      recommendations: ["Educate on process", "Explore down payment assistance programs"]
    }
  ])

  const [analytics] = useState({
    averageCloseProbability: 74,
    predictedMonthlyRevenue: 1250000,
    dealsAtRisk: 2,
    highProbabilityDeals: 3,
    pipelineHealth: 82
  })

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return "text-green-600"
    if (probability >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getProbabilityVariant = (probability: number) => {
    if (probability >= 80) return "default"
    if (probability >= 60) return "secondary"
    return "destructive"
  }

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pipeline Health</p>
                <p className="text-2xl font-bold">{analytics.pipelineHealth}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <Progress value={analytics.pipelineHealth} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Predicted Revenue</p>
                <p className="text-2xl font-bold">${(analytics.predictedMonthlyRevenue / 1000000).toFixed(1)}M</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Probability</p>
                <p className="text-2xl font-bold">{analytics.highProbabilityDeals}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">≥80% close rate</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">At Risk</p>
                <p className="text-2xl font-bold">{analytics.dealsAtRisk}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Predictions Table */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>
            AI Predictions & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {predictions.map((prediction) => (
              <div key={prediction.leadId} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium">{prediction.leadName}</h4>
                    <p className="text-sm text-muted-foreground">{prediction.currentStage}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Badge variant={getProbabilityVariant(prediction.closeProbability)}>
                        {prediction.closeProbability}% Close Probability
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${prediction.estimatedValue.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Predicted Close Date
                    </h5>
                    <p className="text-sm">{new Date(prediction.predictedCloseDate).toLocaleDateString()}</p>
                  </div>

                  <div>
                    <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      AI Recommendations
                    </h5>
                    <ul className="text-sm space-y-1">
                      {prediction.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-1">
                          <span className="text-green-600">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {prediction.riskFactors.length > 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800">
                    <h5 className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">
                      Risk Factors:
                    </h5>
                    <ul className="text-sm text-yellow-600 dark:text-yellow-400">
                      {prediction.riskFactors.map((risk, index) => (
                        <li key={index}>• {risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Brain className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-700 dark:text-blue-300">AI Insights</h4>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              These predictions are based on historical data, current pipeline status, customer behavior patterns, 
              and market conditions. Update your CRM data regularly for more accurate forecasting.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}