import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StandardPageLayout } from '@/components/StandardPageLayout';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StandardContentCard } from '@/components/StandardContentCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  GitBranch, 
  TrendingUp, 
  DollarSign, 
  Timer,
  Activity,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  RefreshCw,
  Users,
  TrendingDown
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { ibmDb } from '@/lib/ibm';
const supabase = ibmDb; // IBM migration shim
import { useToast } from '@/hooks/use-toast';
import { InteractivePipeline } from '@/components/InteractivePipeline';
import { AdvancedAnalytics } from '@/components/analytics/AdvancedAnalytics';
import { TeamCollaboration } from '@/components/collaboration/TeamCollaboration';
import { WorkflowAutomation } from '@/components/operations/WorkflowAutomation';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useRoleBasedAccess } from '@/hooks/useRoleBasedAccess';

interface PipelineOverview {
  totalOpportunities: number;
  activeDeals: number;
  closedDeals: number;
  totalValue: number;
  avgDealSize: number;
  avgCycleTime: number;
  conversionRate: number;
  stagesCount: Record<string, number>;
}

export default function Pipeline() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasRole } = useRoleBasedAccess();
  const [overview, setOverview] = useState<PipelineOverview>({
    totalOpportunities: 0,
    activeDeals: 0,
    closedDeals: 0,
    totalValue: 0,
    avgDealSize: 0,
    avgCycleTime: 0,
    conversionRate: 0,
    stagesCount: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPipelineOverview();
  }, [user]);

  // Real-time subscription for pipeline_entries
  useRealtimeSubscription({
    table: 'pipeline_entries',
    event: '*',
    onChange: () => {
      console.log('Pipeline data changed, refreshing...');
      fetchPipelineOverview();
    }
  });

  // Real-time subscription for leads table to catch stage changes
  useRealtimeSubscription({
    table: 'leads',
    event: '*',
    onChange: () => {
      console.log('Leads data changed, refreshing pipeline...');
      fetchPipelineOverview();
    }
  });

  const fetchPipelineOverview = async () => {
    try {
      setLoading(true);
      
      // Check if user is manager/admin to see all data
      const isManagerOrAdmin = hasRole('manager') || hasRole('admin') || hasRole('super_admin');
      
      // Directly query leads with only actual columns
      let leadsQuery = supabase
        .from('leads')
        .select('id, user_id, contact_entity_id')
        .order('created_at', { ascending: false });
      
      // Only filter by user_id if not a manager/admin
      if (!isManagerOrAdmin) {
        leadsQuery = leadsQuery.eq('user_id', user?.id);
      }
      
      const { data: leadsData, error: leadsError } = await leadsQuery;
      
      if (leadsError) throw leadsError;

      // Get contact entities for stage and loan amount information
      const contactIds = leadsData?.map(l => l.contact_entity_id).filter(Boolean) || [];
      let contactMap: Record<string, { stage: string; loan_amount: number }> = {};
      
      if (contactIds.length > 0) {
        const { data: contactData } = await supabase
          .from('contact_entities')
          .select('id, stage, loan_amount')
          .in('id', contactIds);
        
        contactData?.forEach(c => {
          contactMap[c.id] = {
            stage: c.stage || 'New Lead',
            loan_amount: c.loan_amount || 0
          };
        });
      }
      
      // Process the data
      const leads = leadsData?.map(lead => {
        const contact = lead.contact_entity_id ? contactMap[lead.contact_entity_id] : null;
        return {
          ...lead,
          stage: contact?.stage || 'New Lead',
          amount: contact?.loan_amount || 0
        };
      }) || [];
      
      const totalOpportunities = leads.length;
      const activeDeals = leads.filter(lead => 
        lead.stage !== 'Closed Won' && lead.stage !== 'Closed Lost'
      ).length;
      const closedDeals = leads.filter(lead => 
        lead.stage === 'Closed Won' || lead.stage === 'Loan Funded'
      ).length;
      const totalValue = leads.reduce((sum, lead) => sum + (lead.amount || 0), 0);
      const avgDealSize = totalOpportunities > 0 ? totalValue / totalOpportunities : 0;
      const conversionRate = totalOpportunities > 0 ? (closedDeals / totalOpportunities) * 100 : 0;

      // Count by stages
      const stagesCount: Record<string, number> = {};
      leads.forEach(lead => {
        const stage = lead.stage || 'Unknown';
        stagesCount[stage] = (stagesCount[stage] || 0) + 1;
      });

      setOverview({
        totalOpportunities,
        activeDeals,
        closedDeals,
        totalValue,
        avgDealSize,
        avgCycleTime: 42,
        conversionRate,
        stagesCount
      });
    } catch (error) {
      console.error('Error fetching pipeline overview:', error);
      toast({
        title: "Error",
        description: "Failed to fetch pipeline data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <IBMPageHeader 
          title="Pipeline Management"
          subtitle="Loading pipeline data..."
        />
        <div className="p-8 space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse border border-border shadow-sm bg-card rounded-lg p-6">
                <div className="h-6 bg-muted rounded w-24 mb-4"></div>
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-8 w-8 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <IBMPageHeader 
        title="Pipeline Management"
        subtitle="Advanced sales pipeline tracking, opportunity management, and revenue forecasting"
      />
      <div className="p-8 space-y-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <Badge variant="default" className="text-xs font-medium px-2 py-1">
            {overview.totalOpportunities} Opportunities
          </Badge>
          <Button onClick={fetchPipelineOverview} variant="outline" size="sm" className="h-8 text-xs font-medium">
            <RefreshCw className="h-3 w-3 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Pipeline Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className="border border-blue-600 bg-card shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer animate-fade-in"
          onClick={() => navigate('/leads')}
        >
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Opportunities</p>
              <p className="text-2xl font-bold text-primary">{overview.totalOpportunities}</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border border-blue-600 bg-card shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer animate-fade-in"
          style={{ animationDelay: '0.1s' }}
          onClick={() => navigate('/pipeline')}
        >
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Active Deals</p>
              <p className="text-2xl font-bold text-primary">{overview.activeDeals}</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border border-blue-600 bg-card shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer animate-fade-in"
          style={{ animationDelay: '0.2s' }}
          onClick={() => navigate('/reports')}
        >
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Pipeline Value</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(overview.totalValue)}</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border border-blue-600 bg-card shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer animate-fade-in"
          style={{ animationDelay: '0.3s' }}
          onClick={() => navigate('/pipeline/analytics')}
        >
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Avg Cycle Time</p>
              <p className="text-2xl font-bold text-primary">{overview.avgCycleTime}d</p>
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Additional Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card 
          className="border border-blue-600 bg-card shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer animate-fade-in"
          onClick={() => navigate('/pipeline/analytics')}
        >
          <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold text-primary">{overview.conversionRate.toFixed(1)}%</p>
              </div>
          </CardContent>
        </Card>

        <Card 
          className="border border-blue-600 bg-card shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer animate-fade-in"
          style={{ animationDelay: '0.1s' }}
          onClick={() => navigate('/reports')}
        >
          <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Avg Deal Size</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(overview.avgDealSize)}</p>
              </div>
          </CardContent>
        </Card>

        <Card 
          className="border border-blue-600 bg-card shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer animate-fade-in"
          style={{ animationDelay: '0.2s' }}
          onClick={() => navigate('/clients')}
        >
          <CardContent className="p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Closed Deals</p>
                <p className="text-2xl font-bold text-primary">{overview.closedDeals}</p>
              </div>
          </CardContent>
        </Card>
      </div>

        {/* Performance Alerts */}
        {overview.conversionRate < 20 && (
          <Alert className="border-l-4 border-l-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              Pipeline conversion rate is below target ({overview.conversionRate.toFixed(1)}%). Consider reviewing qualification criteria and follow-up processes.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="visual" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 bg-[#0A1628] p-1 gap-2">
          <TabsTrigger value="visual" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            <span>Visual</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span>Performance</span>
          </TabsTrigger>
          <TabsTrigger value="stages" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span>Stages</span>
          </TabsTrigger>
          <TabsTrigger value="forecasting" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span>Forecasting</span>
          </TabsTrigger>
          <TabsTrigger value="advanced-analytics" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>Advanced</span>
          </TabsTrigger>
          <TabsTrigger value="collaboration" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Team</span>
          </TabsTrigger>
          <TabsTrigger value="automation" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span>Automation</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-6">
          <Card className="border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <GitBranch className="h-5 w-5 text-primary" />
                Interactive Pipeline View
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Drag and drop opportunities between stages to track progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InteractivePipeline />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Conversion Metrics
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Pipeline performance and conversion rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-muted/20 border">
                    <span className="text-sm font-medium text-muted-foreground">Overall Conversion</span>
                    <span className="font-bold text-primary">{overview.conversionRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-muted/20 border">
                    <span className="text-sm font-medium text-muted-foreground">Average Deal Size</span>
                    <span className="font-bold text-primary">{formatCurrency(overview.avgDealSize)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-muted/20 border">
                    <span className="text-sm font-medium text-muted-foreground">Win Rate</span>
                    <span className="font-bold text-secondary-foreground">68%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Clock className="h-5 w-5 text-accent-foreground" />
                  Velocity Metrics
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Speed and efficiency of deal progression
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-lg bg-muted/20 border">
                    <span className="text-sm font-medium text-muted-foreground">Avg Sales Cycle</span>
                    <span className="font-bold text-primary">{overview.avgCycleTime} days</span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-muted/20 border">
                    <span className="text-sm font-medium text-muted-foreground">Stage Progression Rate</span>
                    <span className="font-bold text-primary">85%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-lg bg-muted/20 border">
                    <span className="text-sm font-medium text-muted-foreground">Time to Close</span>
                    <span className="font-bold text-accent-foreground">32 days</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stages" className="space-y-6">
            <StandardContentCard title="Stage Distribution" className="widget-glass border-0">
              <p className="text-sm text-muted-foreground mb-4">Opportunities breakdown by pipeline stage</p>
              <div className="space-y-4">
                {Object.entries(overview.stagesCount).length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No pipeline data available</p>
                  </div>
                ) : (
                  Object.entries(overview.stagesCount).map(([stage, count]) => (
                     <div key={stage} className="flex justify-between items-center p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                       <span className="text-sm font-medium text-foreground">{stage}</span>
                       <div className="flex items-center gap-2">
                         <span className="font-bold text-primary">{count}</span>
                         <span className="text-sm text-muted-foreground">opportunities</span>
                       </div>
                     </div>
                  ))
                )}
              </div>
            </StandardContentCard>
        </TabsContent>

        <TabsContent value="forecasting" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="widget-glass border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Revenue Forecast
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Projected revenue based on current pipeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium text-muted-foreground">This Quarter</span>
                    <span className="font-semibold text-foreground">{formatCurrency(overview.totalValue * 0.3)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium text-muted-foreground">Next Quarter</span>
                    <span className="font-semibold text-foreground">{formatCurrency(overview.totalValue * 0.5)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium text-muted-foreground">Confidence Level</span>
                    <span className="font-semibold text-green-600">87%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Target className="h-5 w-5 text-green-600" />
                  Target Progress
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Progress towards revenue targets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium text-muted-foreground">Monthly Target</span>
                    <span className="font-semibold text-foreground">{formatCurrency(1500000)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium text-muted-foreground">Current Progress</span>
                    <span className="font-semibold text-foreground">78%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium text-muted-foreground">On Track</span>
                    <span className="font-semibold text-green-600">Yes</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="advanced-analytics" className="space-y-6">
          <AdvancedAnalytics />
        </TabsContent>

        <TabsContent value="collaboration" className="space-y-6">
          <TeamCollaboration />
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          <WorkflowAutomation />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}