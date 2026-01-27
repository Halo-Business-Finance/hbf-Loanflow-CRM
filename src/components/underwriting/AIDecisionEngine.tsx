import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Scale
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Decision {
  recommendation: 'Approve' | 'Conditional Approve' | 'Decline';
  confidenceScore: number;
  summary: string;
  positiveFactors: string[];
  riskFactors: string[];
  conditions?: { condition: string; priority: 'Required' | 'Recommended' }[];
  creditAnalysis?: { score: string; notes: string };
  debtAnalysis?: { status: string; notes: string };
  collateralAnalysis?: { coverage: string; ltv?: number; notes: string };
}

interface LoanApplication {
  id: string;
  name?: string;
  business_name?: string;
  loan_amount?: number;
  loan_type?: string;
  credit_score?: number;
  income?: number;
  debt_to_income_ratio?: number;
  years_in_business?: number;
  collateral_value?: number;
  purpose_of_loan?: string;
  annual_revenue?: number;
}

interface AIDecisionEngineProps {
  application?: LoanApplication | null;
  onDecisionGenerated?: (decision: Decision) => void;
}

export function AIDecisionEngine({ application, onDecisionGenerated }: AIDecisionEngineProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'Approve': return { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle };
      case 'Conditional Approve': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: AlertTriangle };
      case 'Decline': return { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle };
      default: return { bg: 'bg-muted', text: 'text-muted-foreground', icon: Scale };
    }
  };

  const generateDecision = async () => {
    if (!application) {
      toast({
        title: "No Application Selected",
        description: "Please select an application to analyze.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-decision-engine', {
        body: { application }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setDecision(data);
      if (onDecisionGenerated) onDecisionGenerated(data);

      toast({
        title: "Decision Generated",
        description: `Recommendation: ${data.recommendation} (${data.confidenceScore}% confidence)`
      });
    } catch (error) {
      console.error('Error generating decision:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to generate decision",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const recStyle = decision ? getRecommendationStyle(decision.recommendation) : null;
  const RecIcon = recStyle?.icon || Scale;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Decision Engine</CardTitle>
          </div>
          {decision && (
            <Badge className={`${recStyle?.bg} ${recStyle?.text}`}>
              {decision.confidenceScore}% Confidence
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!decision ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              {application 
                ? "AI will analyze the application against lending guidelines and provide a recommendation."
                : "Select an application to get an AI-powered underwriting decision."}
            </p>
            <Button onClick={generateDecision} disabled={loading || !application} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Generate Decision
                </>
              )}
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[450px] pr-4">
            <div className="space-y-4">
              {/* Recommendation */}
              <div className={`p-4 rounded-lg ${recStyle?.bg} border border-border`}>
                <div className="flex items-center gap-3">
                  <RecIcon className={`h-8 w-8 ${recStyle?.text}`} />
                  <div>
                    <p className={`text-xl font-bold ${recStyle?.text}`}>{decision.recommendation}</p>
                    <p className="text-sm text-muted-foreground">{decision.summary}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Confidence</span>
                    <span>{decision.confidenceScore}%</span>
                  </div>
                  <Progress value={decision.confidenceScore} className="h-2" />
                </div>
              </div>

              {/* Analysis Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {decision.creditAnalysis && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Credit Analysis</p>
                    <Badge variant="outline" className="mb-1">{decision.creditAnalysis.score}</Badge>
                    <p className="text-xs text-muted-foreground">{decision.creditAnalysis.notes}</p>
                  </div>
                )}
                {decision.debtAnalysis && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Debt Analysis</p>
                    <Badge variant="outline" className="mb-1">{decision.debtAnalysis.status}</Badge>
                    <p className="text-xs text-muted-foreground">{decision.debtAnalysis.notes}</p>
                  </div>
                )}
                {decision.collateralAnalysis && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Collateral</p>
                    <Badge variant="outline" className="mb-1">{decision.collateralAnalysis.coverage}</Badge>
                    {decision.collateralAnalysis.ltv && (
                      <p className="text-xs text-muted-foreground">LTV: {decision.collateralAnalysis.ltv}%</p>
                    )}
                  </div>
                )}
              </div>

              {/* Positive Factors */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-green-400" />
                  Positive Factors
                </p>
                <div className="space-y-1">
                  {decision.positiveFactors.map((factor, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{factor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Factors */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-red-400" />
                  Risk Factors
                </p>
                <div className="space-y-1">
                  {decision.riskFactors.map((factor, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <TrendingDown className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <span>{factor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              {decision.conditions && decision.conditions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Conditions for Approval</p>
                  <div className="space-y-2">
                    {decision.conditions.map((cond, i) => (
                      <div key={i} className="p-2 rounded bg-muted/50 border border-border flex items-start gap-2">
                        <Badge variant="outline" className={cond.priority === 'Required' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>
                          {cond.priority}
                        </Badge>
                        <span className="text-sm">{cond.condition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" onClick={generateDecision} disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                Re-analyze
              </Button>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
