import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RiskMetrics {
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalApplications: number;
  avgLoanAmount: number;
}

export function RiskAssessmentWidget() {
  const [metrics, setMetrics] = useState<RiskMetrics>({
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    totalApplications: 0,
    avgLoanAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskMetrics();
  }, []);

  const fetchRiskMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_entities')
        .select('loan_amount, credit_score, debt_to_income_ratio')
        .in('stage', ['Pre-approval', 'Documentation', 'Underwriting']);

      if (error) throw error;

      let highRisk = 0;
      let mediumRisk = 0;
      let lowRisk = 0;
      let totalAmount = 0;

      (data || []).forEach((item) => {
        const amount = item.loan_amount || 0;
        totalAmount += amount;

        // Simplified risk calculation
        const creditScore = item.credit_score || 650;
        const dti = item.debt_to_income_ratio || 0;

        if (creditScore < 600 || dti > 0.45 || amount > 500000) {
          highRisk++;
        } else if (creditScore < 680 || dti > 0.35 || amount > 200000) {
          mediumRisk++;
        } else {
          lowRisk++;
        }
      });

      setMetrics({
        highRiskCount: highRisk,
        mediumRiskCount: mediumRisk,
        lowRiskCount: lowRisk,
        totalApplications: data?.length || 0,
        avgLoanAmount: data?.length ? totalAmount / data.length : 0,
      });
    } catch (error) {
      console.error('Error fetching risk metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPercentage = (count: number) => {
    return metrics.totalApplications > 0 
      ? ((count / metrics.totalApplications) * 100).toFixed(1) 
      : '0';
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#161616]" />
          <CardTitle className="text-base font-normal text-[#161616]">
            Risk Assessment
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-[#525252]">Loading risk data...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* High Risk */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">High Risk</Badge>
                  <span className="text-sm text-[#161616]">
                    {metrics.highRiskCount} applications
                  </span>
                </div>
                <span className="text-xs text-[#525252]">{getPercentage(metrics.highRiskCount)}%</span>
              </div>
              <Progress 
                value={Number(getPercentage(metrics.highRiskCount))} 
                className="h-2"
              />
            </div>

            {/* Medium Risk */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs">Medium Risk</Badge>
                  <span className="text-sm text-[#161616]">
                    {metrics.mediumRiskCount} applications
                  </span>
                </div>
                <span className="text-xs text-[#525252]">{getPercentage(metrics.mediumRiskCount)}%</span>
              </div>
              <Progress 
                value={Number(getPercentage(metrics.mediumRiskCount))} 
                className="h-2"
              />
            </div>

            {/* Low Risk */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Low Risk</Badge>
                  <span className="text-sm text-[#161616]">
                    {metrics.lowRiskCount} applications
                  </span>
                </div>
                <span className="text-xs text-[#525252]">{getPercentage(metrics.lowRiskCount)}%</span>
              </div>
              <Progress 
                value={Number(getPercentage(metrics.lowRiskCount))} 
                className="h-2"
              />
            </div>

            {/* Summary Stats */}
            <div className="pt-4 border-t border-[#e0e0e0]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#525252] mb-1">Total Applications</p>
                  <p className="text-xl font-semibold text-[#161616]">
                    {metrics.totalApplications}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#525252] mb-1">Avg Loan Amount</p>
                  <p className="text-xl font-semibold text-[#161616]">
                    ${(metrics.avgLoanAmount / 1000).toFixed(0)}K
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
