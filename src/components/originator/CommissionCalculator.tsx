import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, 
  TrendingUp, 
  Target,
  Calendar,
  Award,
  PiggyBank,
  BarChart3,
  ChevronRight
} from 'lucide-react';
import { ibmDb } from '@/lib/ibm';

interface CommissionTier {
  name: string;
  minVolume: number;
  maxVolume: number;
  rate: number;
  bonus: number;
}

interface LoanCommission {
  loanId: string;
  borrowerName: string;
  loanAmount: number;
  commissionRate: number;
  commission: number;
  status: 'pending' | 'funded' | 'paid';
  closeDate: string;
}

const commissionTiers: CommissionTier[] = [
  { name: 'Bronze', minVolume: 0, maxVolume: 500000, rate: 0.5, bonus: 0 },
  { name: 'Silver', minVolume: 500000, maxVolume: 1000000, rate: 0.75, bonus: 500 },
  { name: 'Gold', minVolume: 1000000, maxVolume: 2500000, rate: 1.0, bonus: 1500 },
  { name: 'Platinum', minVolume: 2500000, maxVolume: 5000000, rate: 1.25, bonus: 3000 },
  { name: 'Diamond', minVolume: 5000000, maxVolume: Infinity, rate: 1.5, bonus: 5000 },
];

export function CommissionCalculator() {
  const [commissions, setCommissions] = useState<LoanCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyVolume, setMonthlyVolume] = useState(0);
  const [ytdVolume, setYtdVolume] = useState(0);
  const [currentTier, setCurrentTier] = useState<CommissionTier>(commissionTiers[0]);
  const [nextTier, setNextTier] = useState<CommissionTier | null>(commissionTiers[1]);

  useEffect(() => {
    fetchCommissionData();
  }, []);

  const fetchCommissionData = async () => {
    try {
      // Fetch funded/closing loans for commission calculation
      const { data: contacts, error } = await ibmDb
        .from('contact_entities')
        .select('id, name, business_name, loan_amount, stage, created_at')
        .in('stage', ['Closing', 'Funded', 'Pre-approval', 'Approved'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Calculate commissions based on loan data
      let totalMonthly = 0;
      let totalYtd = 0;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const calculatedCommissions: LoanCommission[] = ((contacts as any[]) || []).map(contact => {
        const loanAmount = contact.loan_amount || 0;
        const createdAt = new Date(contact.created_at);
        
        // Track volumes
        if (createdAt >= startOfMonth) totalMonthly += loanAmount;
        if (createdAt >= startOfYear) totalYtd += loanAmount;

        // Calculate commission based on tier
        const tier = commissionTiers.find(t => totalYtd >= t.minVolume && totalYtd < t.maxVolume) || commissionTiers[0];
        const commissionRate = tier.rate;
        const commission = loanAmount * (commissionRate / 100);

        let status: 'pending' | 'funded' | 'paid' = 'pending';
        if (contact.stage === 'Funded') status = 'funded';
        else if (contact.stage === 'Closing') status = 'pending';

        return {
          loanId: contact.id,
          borrowerName: contact.business_name || contact.name,
          loanAmount,
          commissionRate,
          commission,
          status,
          closeDate: contact.created_at
        };
      });

      setCommissions(calculatedCommissions);
      setMonthlyVolume(totalMonthly);
      setYtdVolume(totalYtd);

      // Determine current and next tier
      const current = commissionTiers.find(t => totalYtd >= t.minVolume && totalYtd < t.maxVolume) || commissionTiers[0];
      setCurrentTier(current);
      
      const nextIndex = commissionTiers.indexOf(current) + 1;
      setNextTier(nextIndex < commissionTiers.length ? commissionTiers[nextIndex] : null);

    } catch (error) {
      console.error('Error fetching commission data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPending = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.commission, 0);

  const totalFunded = commissions
    .filter(c => c.status === 'funded')
    .reduce((sum, c) => sum + c.commission, 0);

  const totalPaid = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + c.commission, 0);

  const progressToNextTier = nextTier 
    ? ((ytdVolume - currentTier.minVolume) / (nextTier.minVolume - currentTier.minVolume)) * 100
    : 100;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-500">Paid</Badge>;
      case 'funded':
        return <Badge variant="secondary" className="bg-blue-500 text-white">Funded</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTierColor = (tierName: string) => {
    switch (tierName) {
      case 'Bronze': return 'text-orange-600';
      case 'Silver': return 'text-gray-500';
      case 'Gold': return 'text-yellow-500';
      case 'Platinum': return 'text-blue-400';
      case 'Diamond': return 'text-purple-500';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return <Card><CardContent className="p-6">Loading commission data...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          Commission Calculator
        </CardTitle>
        <CardDescription>
          Track earnings, volume tiers, and projected commissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Monthly Volume</div>
                  <div className="text-xl font-bold">${monthlyVolume.toLocaleString()}</div>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">YTD Volume</div>
                  <div className="text-xl font-bold">${ytdVolume.toLocaleString()}</div>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Pending Commissions</div>
                  <div className="text-xl font-bold text-yellow-500">${totalPending.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Ready to Pay</div>
                  <div className="text-xl font-bold text-green-500">${totalFunded.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <Award className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tier Progress */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award className={`h-5 w-5 ${getTierColor(currentTier.name)}`} />
                <span className={`font-semibold ${getTierColor(currentTier.name)}`}>
                  {currentTier.name} Tier
                </span>
                <Badge variant="outline">{currentTier.rate}% Commission</Badge>
              </div>
              {nextTier && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span>Next: {nextTier.name}</span>
                  <ChevronRight className="h-4 w-4" />
                  <span>{nextTier.rate}%</span>
                </div>
              )}
            </div>
            
            {nextTier && (
              <>
                <Progress value={progressToNextTier} className="h-3 mb-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>${ytdVolume.toLocaleString()} funded</span>
                  <span>${(nextTier.minVolume - ytdVolume).toLocaleString()} to {nextTier.name}</span>
                </div>
              </>
            )}

            {currentTier.bonus > 0 && (
              <div className="mt-3 p-2 bg-green-500/10 rounded text-sm text-green-600">
                🎉 Tier bonus earned: ${currentTier.bonus.toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commission Breakdown */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Recent Commissions
          </h4>
          
          {commissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No commission data available</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {commissions.slice(0, 10).map((comm, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{comm.borrowerName}</div>
                    <div className="text-sm text-muted-foreground">
                      ${comm.loanAmount.toLocaleString()} • {comm.commissionRate}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-500">
                      ${comm.commission.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    {getStatusBadge(comm.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commission Tiers Reference */}
        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Commission Tiers
          </h4>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {commissionTiers.map((tier, index) => (
              <div 
                key={index}
                className={`p-2 rounded border ${
                  tier.name === currentTier.name ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <div className={`font-semibold ${getTierColor(tier.name)}`}>{tier.name}</div>
                <div className="text-muted-foreground">{tier.rate}%</div>
                <div className="text-muted-foreground">
                  ${tier.minVolume >= 1000000 
                    ? `${(tier.minVolume / 1000000).toFixed(1)}M` 
                    : `${(tier.minVolume / 1000).toFixed(0)}K`}+
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
