import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Shield,
  DollarSign,
  Building2,
  Clock,
  RefreshCw,
  Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  status: 'low' | 'medium' | 'high';
  details: string;
  trend?: 'up' | 'down' | 'stable';
}

interface RiskAssessment {
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  factors: RiskFactor[];
}

interface RiskScoringDashboardProps {
  application?: {
    creditScore?: number;
    dti?: number;
    ltv?: number;
    yearsInBusiness?: number;
    annualRevenue?: number;
    loanAmount?: number;
    collateralValue?: number;
  };
}

export function RiskScoringDashboard({ application }: RiskScoringDashboardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);

  const analyzeRisk = () => {
    setIsAnalyzing(true);
    
    // Simulate AI risk analysis
    setTimeout(() => {
      const factors: RiskFactor[] = [
        {
          name: 'Credit Score',
          score: application?.creditScore ? Math.min(100, (application.creditScore - 300) / 5.5) : 75,
          weight: 25,
          status: application?.creditScore && application.creditScore >= 700 ? 'low' : application?.creditScore && application.creditScore >= 650 ? 'medium' : 'high',
          details: `Score: ${application?.creditScore || 'N/A'} - ${application?.creditScore && application.creditScore >= 700 ? 'Excellent credit history' : 'Review credit report for derogatory items'}`,
          trend: 'stable'
        },
        {
          name: 'Debt-to-Income Ratio',
          score: application?.dti ? Math.max(0, 100 - (application.dti * 2)) : 70,
          weight: 20,
          status: application?.dti && application.dti <= 35 ? 'low' : application?.dti && application.dti <= 45 ? 'medium' : 'high',
          details: `DTI: ${application?.dti || 'N/A'}% - ${application?.dti && application.dti <= 35 ? 'Within acceptable range' : 'Consider additional income verification'}`,
          trend: 'down'
        },
        {
          name: 'Loan-to-Value',
          score: application?.ltv ? Math.max(0, 100 - application.ltv) : 65,
          weight: 20,
          status: application?.ltv && application.ltv <= 70 ? 'low' : application?.ltv && application.ltv <= 80 ? 'medium' : 'high',
          details: `LTV: ${application?.ltv || 'N/A'}% - ${application?.ltv && application.ltv <= 70 ? 'Strong equity position' : 'Higher LTV increases exposure'}`,
          trend: 'up'
        },
        {
          name: 'Business Stability',
          score: application?.yearsInBusiness ? Math.min(100, application.yearsInBusiness * 10) : 60,
          weight: 15,
          status: application?.yearsInBusiness && application.yearsInBusiness >= 5 ? 'low' : application?.yearsInBusiness && application.yearsInBusiness >= 2 ? 'medium' : 'high',
          details: `${application?.yearsInBusiness || 'N/A'} years in business - ${application?.yearsInBusiness && application.yearsInBusiness >= 5 ? 'Established track record' : 'Newer business, monitor closely'}`,
          trend: 'stable'
        },
        {
          name: 'Cash Flow Coverage',
          score: application?.annualRevenue && application?.loanAmount 
            ? Math.min(100, (application.annualRevenue / application.loanAmount) * 20) 
            : 55,
          weight: 20,
          status: 'medium',
          details: 'DSCR analysis required - Review tax returns and bank statements',
          trend: 'up'
        }
      ];

      const weightedScore = factors.reduce((sum, f) => sum + (f.score * f.weight / 100), 0);
      
      let riskLevel: RiskAssessment['riskLevel'] = 'low';
      let recommendation = '';
      
      if (weightedScore >= 75) {
        riskLevel = 'low';
        recommendation = 'Strong application. Recommend approval with standard terms.';
      } else if (weightedScore >= 60) {
        riskLevel = 'medium';
        recommendation = 'Acceptable risk profile. Consider additional conditions or enhanced monitoring.';
      } else if (weightedScore >= 45) {
        riskLevel = 'high';
        recommendation = 'Elevated risk. Require additional collateral or guarantor support.';
      } else {
        riskLevel = 'critical';
        recommendation = 'High risk application. Recommend decline or significant restructuring.';
      }

      setAssessment({
        overallScore: Math.round(weightedScore),
        riskLevel,
        recommendation,
        factors
      });
      setIsAnalyzing(false);
    }, 1500);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-orange-500';
      case 'critical': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'high': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down': return <TrendingDown className="h-3 w-3 text-red-500" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              AI Risk Scoring Dashboard
            </CardTitle>
            <CardDescription>
              Comprehensive risk assessment with weighted scoring
            </CardDescription>
          </div>
          <Button onClick={analyzeRisk} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                {assessment ? 'Re-analyze' : 'Analyze Risk'}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!assessment && !isAnalyzing && (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No Risk Assessment Yet</p>
            <p className="text-sm mt-2">Click "Analyze Risk" to generate a comprehensive risk profile</p>
          </div>
        )}

        {assessment && (
          <div className="space-y-6">
            {/* Overall Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getRiskColor(assessment.riskLevel)}`}>
                      {assessment.overallScore}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Overall Score</div>
                    <Badge variant={getRiskBadgeVariant(assessment.riskLevel)} className="mt-2">
                      {assessment.riskLevel.toUpperCase()} RISK
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/50 md:col-span-2">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <div className="font-medium">AI Recommendation</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assessment.recommendation}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk Factors */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                Risk Factor Breakdown
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Each factor contributes to the overall risk score based on its weight</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h4>

              {assessment.factors.map((factor, index) => (
                <div key={index} className="space-y-2 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(factor.status)}
                      <span className="font-medium">{factor.name}</span>
                      {getTrendIcon(factor.trend)}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        Weight: {factor.weight}%
                      </span>
                      <Badge variant="outline">{Math.round(factor.score)}/100</Badge>
                    </div>
                  </div>
                  <Progress value={factor.score} className="h-2" />
                  <p className="text-sm text-muted-foreground">{factor.details}</p>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <DollarSign className="h-5 w-5 mx-auto text-muted-foreground" />
                <div className="text-lg font-semibold mt-1">
                  ${application?.loanAmount?.toLocaleString() || 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">Loan Amount</div>
              </div>
              <div className="text-center">
                <Building2 className="h-5 w-5 mx-auto text-muted-foreground" />
                <div className="text-lg font-semibold mt-1">
                  ${application?.collateralValue?.toLocaleString() || 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">Collateral Value</div>
              </div>
              <div className="text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground" />
                <div className="text-lg font-semibold mt-1">
                  ${application?.annualRevenue?.toLocaleString() || 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">Annual Revenue</div>
              </div>
              <div className="text-center">
                <Clock className="h-5 w-5 mx-auto text-muted-foreground" />
                <div className="text-lg font-semibold mt-1">
                  {application?.yearsInBusiness || 'N/A'} yrs
                </div>
                <div className="text-xs text-muted-foreground">Time in Business</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
