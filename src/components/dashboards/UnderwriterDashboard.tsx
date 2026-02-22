import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { StandardContentCard } from '@/components/StandardContentCard';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { ApprovalQueueWidget } from '@/components/widgets/ApprovalQueueWidget';
import { RiskAssessmentWidget } from '@/components/widgets/RiskAssessmentWidget';
import { UNDERWRITER_STAGES } from '@/lib/loan-stages';
import { TaskTimelineWidget } from '@/components/widgets/TaskTimelineWidget';
import { DocumentChecklistWidget } from '@/components/widgets/DocumentChecklistWidget';
import { CompactMessagesWidget } from '@/components/CompactMessagesWidget';
import { CompactCalendarWidget } from '@/components/CompactCalendarWidget';
import { TodaysScheduleWidget } from '@/components/widgets/TodaysScheduleWidget';
import {
  Shield, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Users,
  PieChart,
  BarChart3,
  Calculator,
  Eye,
  DollarSign,
  RefreshCw,
  Filter,
  Sparkles,
  Target
} from 'lucide-react';
import { AutoConditionGenerator } from '@/components/underwriting/AutoConditionGenerator';
import { RiskScoringDashboard } from '@/components/underwriting/RiskScoringDashboard';
import { ibmDb } from '@/lib/ibm';
const supabase = ibmDb; // IBM migration shim
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer as RechartsResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, Area, AreaChart } from 'recharts';

interface UnderwriterMetrics {
  pendingReviews: number;
  approvedToday: number;
  rejectedToday: number;
  avgReviewTime: number;
  approvalRate: number;
  pendingApplications: number;
  processedToday: number;
  averageProcessingTime: number;
  applicationsPastDue: number;
  totalThisWeek: number;
}

interface LeadWithContact {
  id: string;
  stage: string;
  created_at: string;
  updated_at: string;
  contact_entity_id: string;
  name?: string;
  email?: string;
  phone?: string;
  business_name?: string;
  loan_amount?: number;
  loan_type?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  credit_score?: number;
  income?: number;
  debt_to_income_ratio?: number;
  years_in_business?: number;
  collateral_value?: number;
  purpose_of_loan?: string;
}

export const UnderwriterDashboard = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<UnderwriterMetrics>({
    pendingReviews: 0,
    approvedToday: 0,
    rejectedToday: 0,
    avgReviewTime: 1.8,
    approvalRate: 0,
    pendingApplications: 0,
    processedToday: 0,
    averageProcessingTime: 0,
    applicationsPastDue: 0,
    totalThisWeek: 0
  });
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [pendingApps, setPendingApps] = useState<LeadWithContact[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [pipelineCount, setPipelineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'urgent' | 'high' | 'urgent-high'>('all');
  const [selectedAppForConditions, setSelectedAppForConditions] = useState<LeadWithContact | null>(null);
  const [updatingBadges, setUpdatingBadges] = useState<{
    pending: boolean;
    documents: boolean;
    pipeline: boolean;
    completed: boolean;
  }>({
    pending: false,
    documents: false,
    pipeline: false,
    completed: false
  });

  const getPriorityToastStyle = (priority: string = 'medium') => {
    switch (priority) {
      case 'urgent':
        return { variant: 'destructive' as const, title: '🚨 URGENT Application Received' };
      case 'high':
        return { variant: 'default' as const, title: '⚠️ High Priority Application Received' };
      case 'medium':
        return { variant: 'default' as const, title: '📋 New Application Received' };
      case 'low':
        return { variant: 'default' as const, title: '✅ New Application Received' };
      default:
        return { variant: 'default' as const, title: '📋 New Application Received' };
    }
  };

  const getPriorityBadgeColor = (priority: string = 'medium') => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600 text-white hover:bg-red-700';
      case 'high':
        return 'bg-orange-600 text-white hover:bg-orange-700';
      case 'medium':
        return 'bg-blue-600 text-white hover:bg-blue-700';
      case 'low':
        return 'bg-green-600 text-white hover:bg-green-700';
      default:
        return 'bg-gray-600 text-white hover:bg-gray-700';
    }
  };

  const getFilteredApps = () => {
    switch (priorityFilter) {
      case 'urgent':
        return pendingApps.filter(app => app.priority === 'urgent');
      case 'high':
        return pendingApps.filter(app => app.priority === 'high');
      case 'urgent-high':
        return pendingApps.filter(app => app.priority === 'urgent' || app.priority === 'high');
      default:
        return pendingApps;
    }
  };

  const filteredApps = getFilteredApps();

  useEffect(() => {
    fetchUnderwriterData();

    // IBM Cloud does not support Supabase realtime channels.
    // Poll every 30s as a lightweight alternative.
    const interval = setInterval(() => {
      fetchUnderwriterData();
    }, 30_000);

    return () => clearInterval(interval);
  }, [toast]);

  const fetchUnderwriterData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: pendingData } = await supabase
        .from('contact_entities')
        .select('*')
        .in('stage', ['Documentation', 'Underwriting']);

      const { data: approvedToday } = await supabase
        .from('contact_entities')
        .select('id')
        .eq('stage', 'Closing')
        .gte('updated_at', today);

      const { data: totalProcessed } = await supabase
        .from('contact_entities')
        .select('id, stage')
        .in('stage', ['Closing', 'Loan Funded']);

      const { data: contactsData, error: contactsError } = await supabase
        .from('contact_entities')
        .select(`
          id,
          name,
          email,
          phone,
          business_name,
          loan_amount,
          loan_type,
          stage,
          priority,
          created_at,
          updated_at,
          credit_score,
          income
        `)
        .in('stage', UNDERWRITER_STAGES);

      if (contactsError) throw contactsError;

      const contactIds = contactsData?.map(contact => contact.id) || [];
      let leadsData: any[] = [];
      
      if (contactIds.length > 0) {
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id, contact_entity_id, is_converted_to_client')
          .in('contact_entity_id', contactIds)
          .eq('is_converted_to_client', false);
        
        if (leadsError) throw leadsError;
        leadsData = leads || [];
      }

      const transformedPending: LeadWithContact[] = (contactsData || [])
        .filter(contact => leadsData.some(lead => lead.contact_entity_id === contact.id))
        .map(contact => ({
          id: contact.id,
          stage: contact.stage || '',
          created_at: contact.created_at || '',
          updated_at: contact.updated_at || '',
          contact_entity_id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          business_name: contact.business_name,
          loan_amount: contact.loan_amount,
          loan_type: contact.loan_type,
          credit_score: contact.credit_score,
          income: contact.income,
          priority: contact.priority as 'low' | 'medium' | 'high' | 'urgent' || 'medium'
        }));

      const { data: processedContactsToday } = await supabase
        .from('contact_entities')
        .select('id')
        .gte('updated_at', today)
        .in('stage', ['Documentation', 'Underwriting']);

      const { data: weeklyContactsData } = await supabase
        .from('contact_entities')
        .select('id, created_at, updated_at')
        .gte('updated_at', weekAgo);

      const { data: docsData } = await supabase
        .from('lead_documents')
        .select('id');
      const docsCount = docsData?.length || 0;

      const { data: pipelineStageData } = await supabase
        .from('contact_entities')
        .select('id')
        .in('stage', UNDERWRITER_STAGES);
      const pipelineItemsCount = pipelineStageData?.length || 0;

      setPendingReviews(pendingData || []);
      setPendingApps(transformedPending);
      setDocumentCount(docsCount || 0);
      setPipelineCount(pipelineItemsCount || 0);
      
      const approvedCount = approvedToday?.length || 0;
      const totalCount = (pendingData?.length || 0) + (totalProcessed?.length || 0);
      const approvalRate = totalCount > 0 ? Math.round(((totalProcessed?.length || 0) / totalCount) * 100) : 0;

      setMetrics({
        pendingReviews: pendingData?.length || 0,
        approvedToday: approvedCount,
        rejectedToday: 0,
        avgReviewTime: 1.8,
        approvalRate,
        pendingApplications: transformedPending.length,
        processedToday: processedContactsToday?.length || 0,
        averageProcessingTime: 2.5,
        applicationsPastDue: transformedPending.filter(app => 
          new Date(app.created_at) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        ).length,
        totalThisWeek: weeklyContactsData?.length || 0
      });

    } catch (error) {
      console.error('Error fetching underwriter data:', error);
      toast({
        title: "Error",
        description: "Failed to load underwriter dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (applicationId: string) => {
    try {
      await supabase
        .from('contact_entities')
        .update({ 
          stage: 'Closing',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      toast({
        title: "Application Approved",
        description: "Application moved to closing stage",
      });
      
      fetchUnderwriterData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve application",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (applicationId: string) => {
    try {
      await supabase
        .from('contact_entities')
        .update({ 
          stage: 'Rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      toast({
        title: "Application Rejected",
        description: "Application has been rejected",
        variant: "destructive"
      });
      
      fetchUnderwriterData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject application",
        variant: "destructive",
      });
    }
  };

  const handleProcessApplication = async (applicationId: string) => {
    try {
      await supabase
        .from('contact_entities')
        .update({ 
          stage: 'Pre-approval',
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      toast({
        title: "Application Processed",
        description: "Application moved to pre-approval stage",
      });
      
      fetchUnderwriterData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process application",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading underwriter dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Loan Underwriter Dashboard"
        subtitle="Review and approve loan applications"
        actions={
          <Button 
            size="sm" 
            onClick={fetchUnderwriterData}
            className="h-9 px-4 bg-[#0f62fe] hover:bg-[#0353e9] text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        }
      />

      <div className="p-8 space-y-8 animate-fade-in">
        {/* Top Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CompactMessagesWidget />
          <TodaysScheduleWidget />
          <CompactCalendarWidget />
        </div>

        {/* Main Navigation Tabs */}
        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList className="bg-[#0A1628] p-1 gap-2 inline-flex w-auto flex-wrap">
            <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              Pending Applications
              <Badge 
                variant="secondary" 
                className={`ml-1 bg-white/20 text-white hover:bg-white/30 transition-all ${updatingBadges.pending ? 'animate-pulse' : ''}`}
              >
                {pendingApps.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              Processing Pipeline
              <Badge 
                variant="secondary" 
                className={`ml-1 bg-white/20 text-white hover:bg-white/30 transition-all ${updatingBadges.pipeline ? 'animate-pulse' : ''}`}
              >
                {pipelineCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              Completed Today
              <Badge 
                variant="secondary" 
                className={`ml-1 bg-white/20 text-white hover:bg-white/30 transition-all ${updatingBadges.completed ? 'animate-pulse' : ''}`}
              >
                {metrics.processedToday}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="loan-tools" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              <span>Tools</span>
            </TabsTrigger>
            <TabsTrigger value="ai-conditions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>AI Conditions</span>
            </TabsTrigger>
            <TabsTrigger value="risk-scoring" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>Risk Scoring</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            {/* Applications Awaiting Underwriting */}
            <Card>
              <CardHeader>
                <CardTitle>Applications Awaiting Underwriting</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingReviews.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">{app.name || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(app.loan_amount || 0)} • {app.loan_type || 'N/A'}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={app.stage === 'Pre-approval' ? 'secondary' : 'outline'}>
                            {app.stage}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Credit Score: {app.credit_score || 'N/A'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Income: {formatCurrency(app.income || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleReject(app.id)}
                        >
                          Reject
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleApprove(app.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                  {pendingReviews.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No applications pending review
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Content Area */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StandardContentCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Pending Reviews</h3>
                      <div className="text-2xl font-bold">{formatNumber(metrics.pendingReviews)}</div>
                      <p className="text-xs text-muted-foreground">Awaiting review</p>
                    </div>
                    <Clock className="w-8 h-8 text-primary" />
                  </div>
                </StandardContentCard>

                <StandardContentCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Approved Today</h3>
                      <div className="text-2xl font-bold text-green-600">{formatNumber(metrics.approvedToday)}</div>
                      <p className="text-xs text-muted-foreground">Applications approved</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </StandardContentCard>

                <StandardContentCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Rejected Today</h3>
                      <div className="text-2xl font-bold text-destructive">{formatNumber(metrics.rejectedToday)}</div>
                      <p className="text-xs text-muted-foreground">Applications rejected</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                  </div>
                </StandardContentCard>

                <StandardContentCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Avg. Review Time</h3>
                      <div className="text-2xl font-bold">{metrics.avgReviewTime} days</div>
                      <p className="text-xs text-muted-foreground">Average review time</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-primary" />
                  </div>
                </StandardContentCard>

                <StandardContentCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Approval Rate</h3>
                      <div className="text-2xl font-bold">{metrics.approvalRate}%</div>
                      <p className="text-xs text-muted-foreground">Applications approved</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                </StandardContentCard>
              </div>

              {/* Role-Specific Widgets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ApprovalQueueWidget />
                <RiskAssessmentWidget />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pending" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(metrics.pendingApplications)}</div>
                  <p className="text-xs text-muted-foreground">Awaiting processing</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Processed Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(metrics.processedToday)}</div>
                  <p className="text-xs text-muted-foreground">Applications completed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Processing Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.averageProcessingTime} days</div>
                  <p className="text-xs text-muted-foreground">Average completion time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Past Due</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{formatNumber(metrics.applicationsPastDue)}</div>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(metrics.totalThisWeek)}</div>
                  <p className="text-xs text-muted-foreground">Total applications</p>
                </CardContent>
              </Card>
            </div>

            {/* Role-Specific Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TaskTimelineWidget />
              <DocumentChecklistWidget />
            </div>

            {/* Pending Applications Content */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Applications Requiring Processing</CardTitle>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={priorityFilter} onValueChange={(value: any) => setPriorityFilter(value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Applications</SelectItem>
                        <SelectItem value="urgent-high">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                            Urgent & High Only
                          </span>
                        </SelectItem>
                        <SelectItem value="urgent">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                            Urgent Only
                          </span>
                        </SelectItem>
                        <SelectItem value="high">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-600"></span>
                            High Priority Only
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredApps.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">{app.name || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(app.loan_amount || 0)} • {app.loan_type || 'N/A'}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={app.stage === 'Application' ? 'secondary' : 'outline'}>
                            {app.stage}
                          </Badge>
                          <Badge className={getPriorityBadgeColor(app.priority)}>
                            {app.priority?.toUpperCase() || 'MEDIUM'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Applied {new Date(app.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleProcessApplication(app.id)}
                        >
                          Process
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredApps.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {priorityFilter === 'all' 
                        ? 'No pending applications'
                        : `No ${priorityFilter === 'urgent-high' ? 'urgent or high priority' : priorityFilter} applications`
                      }
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Loan Processing Pipeline Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Application Review</span>
                    <div className="flex items-center gap-2">
                      <Progress value={75} className="w-24" />
                      <span className="text-sm">75%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Document Verification</span>
                    <div className="flex items-center gap-2">
                      <Progress value={60} className="w-24" />
                      <span className="text-sm">60%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Credit Analysis</span>
                    <div className="flex items-center gap-2">
                      <Progress value={45} className="w-24" />
                      <span className="text-sm">45%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Completed Applications Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  {metrics.processedToday} applications processed today
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Underwriting Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Approval Rate</span>
                    <div className="flex items-center gap-2">
                      <Progress value={metrics.approvalRate} className="w-24" />
                      <span className="text-sm">{metrics.approvalRate}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Average Review Time</span>
                    <span className="text-sm font-medium">{metrics.avgReviewTime} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Applications Processed Today</span>
                    <span className="text-sm font-medium">{metrics.approvedToday + metrics.rejectedToday}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risk Distribution Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Applications by Risk Level
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RechartsResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={[
                          { name: 'Low Risk', value: pendingReviews.filter(app => (app.credit_score || 0) >= 700).length, fill: '#22c55e' },
                          { name: 'Medium Risk', value: pendingReviews.filter(app => (app.credit_score || 0) >= 600 && (app.credit_score || 0) < 700).length, fill: '#eab308' },
                          { name: 'High Risk', value: pendingReviews.filter(app => (app.credit_score || 0) < 600).length, fill: '#ef4444' }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({name, value}) => `${name}: ${value}`}
                      >
                        <Cell fill="#22c55e" />
                        <Cell fill="#eab308" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPieChart>
                  </RechartsResponsiveContainer>
                </CardContent>
              </Card>

              {/* Loan Amounts Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Loan Amount Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RechartsResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { range: '$0-100K', count: pendingReviews.filter(app => (app.loan_amount || 0) <= 100000).length },
                      { range: '$100K-250K', count: pendingReviews.filter(app => (app.loan_amount || 0) > 100000 && (app.loan_amount || 0) <= 250000).length },
                      { range: '$250K-500K', count: pendingReviews.filter(app => (app.loan_amount || 0) > 250000 && (app.loan_amount || 0) <= 500000).length },
                      { range: '$500K+', count: pendingReviews.filter(app => (app.loan_amount || 0) > 500000).length }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </RechartsResponsiveContainer>
                </CardContent>
              </Card>

              {/* Monthly Approval Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Monthly Approval Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RechartsResponsiveContainer width="100%" height={300}>
                    <LineChart data={[
                      { month: 'Jan', approved: 45, rejected: 12 },
                      { month: 'Feb', approved: 52, rejected: 8 },
                      { month: 'Mar', approved: 48, rejected: 15 },
                      { month: 'Apr', approved: 61, rejected: 9 },
                      { month: 'May', approved: 55, rejected: 11 },
                      { month: 'Jun', approved: 67, rejected: 7 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="approved" stroke="#22c55e" strokeWidth={2} />
                      <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </RechartsResponsiveContainer>
                </CardContent>
              </Card>

              {/* Credit Score Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Credit Score Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RechartsResponsiveContainer width="100%" height={300}>
                    <AreaChart data={[
                      { score: '300-579', count: pendingReviews.filter(app => (app.credit_score || 0) >= 300 && (app.credit_score || 0) < 580).length },
                      { score: '580-669', count: pendingReviews.filter(app => (app.credit_score || 0) >= 580 && (app.credit_score || 0) < 670).length },
                      { score: '670-739', count: pendingReviews.filter(app => (app.credit_score || 0) >= 670 && (app.credit_score || 0) < 740).length },
                      { score: '740-799', count: pendingReviews.filter(app => (app.credit_score || 0) >= 740 && (app.credit_score || 0) < 800).length },
                      { score: '800+', count: pendingReviews.filter(app => (app.credit_score || 0) >= 800).length }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="score" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    </AreaChart>
                  </RechartsResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="loan-tools" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Debt-to-Income Calculator */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Debt-to-Income Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Monthly Income</label>
                        <div className="text-lg font-semibold text-green-600">$8,500</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Monthly Debt</label>
                        <div className="text-lg font-semibold text-red-600">$3,200</div>
                      </div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground">DTI Ratio</div>
                      <div className="text-2xl font-bold text-orange-600">37.6%</div>
                      <Progress value={37.6} className="mt-2" />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Recommended max DTI: 43% for conventional loans
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Loan-to-Value Calculator */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Loan-to-Value Ratio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Loan Amount</label>
                        <div className="text-lg font-semibold text-blue-600">$320,000</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Property Value</label>
                        <div className="text-lg font-semibold text-green-600">$400,000</div>
                      </div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground">LTV Ratio</div>
                      <div className="text-2xl font-bold text-blue-600">80%</div>
                      <Progress value={80} className="mt-2" />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Standard conventional loan max: 80% LTV
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credit Score Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Credit Score Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>FICO Score</span>
                      <span className="text-2xl font-bold text-green-600">742</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Payment History (35%)</span>
                        <span className="text-green-600">Excellent</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Credit Utilization (30%)</span>
                        <span className="text-yellow-600">Good (22%)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Length of History (15%)</span>
                        <span className="text-green-600">Excellent</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Credit Mix (10%)</span>
                        <span className="text-green-600">Good</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>New Credit (10%)</span>
                        <span className="text-green-600">Good</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Assessment Matrix */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Risk Assessment Matrix
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-red-100 text-red-800 rounded text-center font-medium">
                        High Risk
                      </div>
                      <div className="p-2 bg-yellow-100 text-yellow-800 rounded text-center font-medium">
                        Medium Risk
                      </div>
                      <div className="p-2 bg-green-100 text-green-800 rounded text-center font-medium">
                        Low Risk
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Overall Risk Score</span>
                        <Badge variant="secondary" className="text-green-800">
                          Low Risk
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Based on credit score (742), DTI (37.6%), LTV (80%), and employment history
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 flex-1">
                        Recommend Approval
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        Request More Info
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ai-conditions" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Application Selector */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Select Application
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {pendingReviews.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No pending applications</p>
                    ) : (
                      pendingReviews.map((app) => (
                        <div 
                          key={app.id} 
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedAppForConditions?.id === app.id 
                              ? 'bg-primary/10 border-primary' 
                              : 'hover:bg-muted/50 border-border'
                          }`}
                          onClick={() => setSelectedAppForConditions({
                            id: app.id,
                            name: app.name,
                            business_name: app.business_name,
                            loan_amount: app.loan_amount,
                            loan_type: app.loan_type,
                            credit_score: app.credit_score,
                            income: app.income,
                            debt_to_income_ratio: app.debt_to_income_ratio,
                            years_in_business: app.years_in_business,
                            collateral_value: app.collateral_value,
                            purpose_of_loan: app.purpose_of_loan,
                            stage: app.stage || '',
                            created_at: app.created_at || '',
                            updated_at: app.updated_at || '',
                            contact_entity_id: app.id
                          })}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{app.business_name || app.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(app.loan_amount || 0)} • {app.loan_type || 'N/A'}
                              </p>
                            </div>
                            <Badge variant="outline">{app.stage}</Badge>
                          </div>
                          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Credit: {app.credit_score || 'N/A'}</span>
                            <span>Income: {formatCurrency(app.income || 0)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* AI Condition Generator */}
              <AutoConditionGenerator 
                application={selectedAppForConditions}
                onConditionsGenerated={(conditions) => {
                  console.log('Conditions generated:', conditions);
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="risk-scoring" className="space-y-4">
            <RiskScoringDashboard 
              application={selectedAppForConditions ? {
                creditScore: selectedAppForConditions.credit_score,
                dti: selectedAppForConditions.debt_to_income_ratio,
                yearsInBusiness: selectedAppForConditions.years_in_business,
                annualRevenue: selectedAppForConditions.income ? selectedAppForConditions.income * 12 : undefined,
                loanAmount: selectedAppForConditions.loan_amount,
                collateralValue: selectedAppForConditions.collateral_value
              } : undefined}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
