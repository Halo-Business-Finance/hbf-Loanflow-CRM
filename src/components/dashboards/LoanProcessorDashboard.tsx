import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { TaskTimelineWidget } from '@/components/widgets/TaskTimelineWidget';
import { DocumentChecklistWidget } from '@/components/widgets/DocumentChecklistWidget';
import { CompactMessagesWidget } from '@/components/CompactMessagesWidget';
import { CompactCalendarWidget } from '@/components/CompactCalendarWidget';
import { TodaysScheduleWidget } from '@/components/widgets/TodaysScheduleWidget';
import { SmartDocumentTracker } from '@/components/processor/SmartDocumentTracker';
import { PreFlightChecklist } from '@/components/processor/PreFlightChecklist';
import { StackingOrderAutomation } from '@/components/processor/StackingOrderAutomation';
import { DocumentExpirationTracker } from '@/components/processor/DocumentExpirationTracker';
import { SLATimelineTracker } from '@/components/processor/SLATimelineTracker';
import { PROCESSOR_STAGES } from '@/lib/loan-stages';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Users,
  Calendar,
  Filter,
  FileSearch,
  ClipboardCheck,
  Layers,
  CalendarClock,
  Target
} from 'lucide-react';
import { ibmDb } from '@/lib/ibm';
const supabase = ibmDb; // IBM migration shim
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface ProcessorMetrics {
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
}

export const LoanProcessorDashboard = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<ProcessorMetrics>({
    pendingApplications: 0,
    processedToday: 0,
    averageProcessingTime: 0,
    applicationsPastDue: 0,
    totalThisWeek: 0
  });
  const [pendingApps, setPendingApps] = useState<LeadWithContact[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [pipelineCount, setPipelineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'urgent' | 'high' | 'urgent-high'>('all');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
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
    fetchProcessorData();

    // Poll for data changes every 15s
    const pollingInterval = setInterval(() => {
      fetchProcessorData();
    }, 15000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [toast]);

  const fetchProcessorData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch pending applications - using contact_entities for stage filtering
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
          updated_at
        `)
        .in('stage', PROCESSOR_STAGES);

      if (contactsError) {
        throw contactsError;
      }

      // Get corresponding leads for these contact entities
      const contactIds = contactsData?.map(contact => contact.id) || [];
      
      let leadsData: any[] = [];
      if (contactIds.length > 0) {
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id, contact_entity_id, is_converted_to_client')
          .in('contact_entity_id', contactIds)
          .eq('is_converted_to_client', false);
        
        if (leadsError) {
          throw leadsError;
        }
        
        leadsData = leads || [];
      }

      // Merge contact and lead data
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
          priority: contact.priority as 'low' | 'medium' | 'high' | 'urgent' || 'medium'
        }));

      // Fetch processed applications today - using contact_entities
      const { data: processedContactsToday } = await supabase
        .from('contact_entities')
        .select('id')
        .gte('updated_at', today)
        .in('stage', ['Documentation', 'Underwriting']);

      // Fetch this week's processing stats
      const { data: weeklyContactsData } = await supabase
        .from('contact_entities')
        .select('id, created_at, updated_at')
        .gte('updated_at', weekAgo);

      // Fetch document count
      const { data: documentsData } = await supabase
        .from('lead_documents')
        .select('id');
      const docsCount = documentsData?.length || 0;

      // Fetch pipeline count (applications in various processing stages)
      const { data: pipelineData } = await supabase
        .from('contact_entities')
        .select('id')
        .in('stage', PROCESSOR_STAGES);
      const pipelineItemsCount = pipelineData?.length || 0;

      setPendingApps(transformedPending);
      setDocumentCount(docsCount || 0);
      setPipelineCount(pipelineItemsCount || 0);
      
      setMetrics({
        pendingApplications: transformedPending.length,
        processedToday: processedContactsToday?.length || 0,
        averageProcessingTime: 2.5, // Calculate based on actual data
        applicationsPastDue: transformedPending.filter(app => 
          new Date(app.created_at) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        ).length,
        totalThisWeek: weeklyContactsData?.length || 0
      });

    } catch (error) {
      console.error('Error fetching processor data:', error);
      toast({
        title: "Error",
        description: "Failed to load processor dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessApplication = async (applicationId: string) => {
    try {
      // Update stage in contact_entities table (not leads table)
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
      
      fetchProcessorData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process application",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading processor dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Loan Processor Dashboard"
        subtitle="Manage and process loan applications"
      />

      <div className="p-8 space-y-6">
        {/* Top Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CompactMessagesWidget />
          <TodaysScheduleWidget />
          <CompactCalendarWidget />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="bg-[#0A1628] p-1 gap-2 inline-flex w-auto">
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
              Loan Processing Pipeline
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
            <TabsTrigger value="doc-tracker" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <FileSearch className="w-4 h-4" />
              Doc Tracker
            </TabsTrigger>
            <TabsTrigger value="preflight" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Pre-Flight
            </TabsTrigger>
            <TabsTrigger value="stacking" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Stacking Order
            </TabsTrigger>
            <TabsTrigger value="expiration" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              Doc Expiration
            </TabsTrigger>
            <TabsTrigger value="sla" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <Target className="w-4 h-4" />
              SLA Tracker
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="doc-tracker">
            <SmartDocumentTracker />
          </TabsContent>

          <TabsContent value="preflight" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Select Application
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {pendingApps.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No pending applications</p>
                    ) : (
                      pendingApps.map((app) => (
                        <div 
                          key={app.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedAppId === app.id 
                              ? 'bg-primary/10 border-primary' 
                              : 'hover:bg-muted/50 border-border'
                          }`}
                          onClick={() => setSelectedAppId(app.id)}
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
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
              <PreFlightChecklist applicationId={selectedAppId} />
            </div>
          </TabsContent>

          <TabsContent value="stacking" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Select Application
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {pendingApps.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No pending applications</p>
                    ) : (
                      pendingApps.map((app) => (
                        <div 
                          key={app.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedAppId === app.id 
                              ? 'bg-primary/10 border-primary' 
                              : 'hover:bg-muted/50 border-border'
                          }`}
                          onClick={() => setSelectedAppId(app.id)}
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
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
              <StackingOrderAutomation applicationId={selectedAppId} />
            </div>
          </TabsContent>

          <TabsContent value="expiration" className="space-y-4">
            <DocumentExpirationTracker />
          </TabsContent>

          <TabsContent value="sla" className="space-y-4">
            <SLATimelineTracker />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};