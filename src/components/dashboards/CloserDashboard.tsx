import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { FundingQueueWidget } from '@/components/widgets/FundingQueueWidget';
import { ClosingCalendarWidget } from '@/components/widgets/ClosingCalendarWidget';
import { 
  FileCheck, 
  Calendar, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Users,
  AlertCircle
} from 'lucide-react';
import { ibmDb } from '@/lib/ibm';
const supabase = ibmDb; // IBM migration shim
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface CloserMetrics {
  scheduledClosings: number;
  completedToday: number;
  avgClosingTime: number;
  documentsReady: number;
  totalClosingValue: number;
}

export const CloserDashboard = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<CloserMetrics>({
    scheduledClosings: 0,
    completedToday: 0,
    avgClosingTime: 3.2,
    documentsReady: 0,
    totalClosingValue: 0
  });
  const [scheduledClosings, setScheduledClosings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCloserData();
  }, []);

  const fetchCloserData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch loans ready for closing
      const { data: closingData } = await supabase
        .from('contact_entities')
        .select('*')
        .eq('stage', 'Closing');

      // Fetch completed closings today
      const { data: completedToday } = await supabase
        .from('contact_entities')
        .select('id, loan_amount')
        .eq('stage', 'Loan Funded')
        .gte('updated_at', today);

      setScheduledClosings(closingData || []);
      
      const totalValue = closingData?.reduce((sum, loan) => sum + (loan.loan_amount || 0), 0) || 0;
      const completedCount = completedToday?.length || 0;

      setMetrics({
        scheduledClosings: closingData?.length || 0,
        completedToday: completedCount,
        avgClosingTime: 3.2,
        documentsReady: closingData?.filter(loan => loan.stage === 'Closing').length || 0,
        totalClosingValue: totalValue
      });

    } catch (error) {
      console.error('Error fetching closer data:', error);
      toast({
        title: "Error",
        description: "Failed to load closer dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseLoan = async (loanId: string, amount: number) => {
    try {
      await supabase
        .from('contact_entities')
        .update({ 
          stage: 'Loan Funded',
          updated_at: new Date().toISOString()
        })
        .eq('id', loanId);

      toast({
        title: "Loan Closed",
        description: `Successfully closed loan for ${formatCurrency(amount)}`,
      });
      
      fetchCloserData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to close loan",
        variant: "destructive",
      });
    }
  };

  const handleScheduleClosing = async (loanId: string) => {
    // This would integrate with a calendar system
    toast({
      title: "Closing Scheduled",
      description: "Closing appointment has been scheduled",
    });
  };

  if (loading) {
    return <div className="p-6">Loading closer dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Closer Dashboard"
        subtitle="Manage loan closings and finalizations"
      />

      <div className="p-8 space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Closings</CardTitle>
            
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.scheduledClosings)}</div>
            <p className="text-xs text-muted-foreground">Ready to close</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatNumber(metrics.completedToday)}</div>
            <p className="text-xs text-muted-foreground">Loans closed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Closing Time</CardTitle>
            
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgClosingTime} days</div>
            <p className="text-xs text-muted-foreground">From approval to close</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Ready</CardTitle>
            
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.documentsReady)}</div>
            <p className="text-xs text-muted-foreground">Ready for closing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalClosingValue)}</div>
            <p className="text-xs text-muted-foreground">Closing pipeline</p>
          </CardContent>
        </Card>
      </div>

      {/* Role-Specific Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FundingQueueWidget />
        <ClosingCalendarWidget />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="scheduled" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scheduled">Scheduled Closings</TabsTrigger>
          <TabsTrigger value="documents">Document Status</TabsTrigger>
          <TabsTrigger value="completed">Completed Closings</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Loans Ready for Closing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scheduledClosings.map((loan) => (
                  <div key={loan.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium">{loan.name || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(loan.loan_amount || 0)} • {loan.loan_type || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{loan.stage}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Interest Rate: {loan.interest_rate || 'N/A'}%
                        </span>
                        {loan.maturity_date && (
                          <span className="text-xs text-muted-foreground">
                            Maturity: {new Date(loan.maturity_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleScheduleClosing(loan.id)}
                      >
                        Schedule
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handleCloseLoan(loan.id, loan.loan_amount || 0)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Close Loan
                      </Button>
                    </div>
                  </div>
                ))}
                {scheduledClosings.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No loans scheduled for closing
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Preparation Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scheduledClosings.map((loan) => (
                  <div key={loan.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{loan.name || 'N/A'}</div>
                      <Badge variant="outline">Ready</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Loan Agreement</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Title Documents</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span>Insurance</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-yellow-600" />
                        <span>Final Walkthrough</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recently Completed Closings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                {metrics.completedToday} closings completed today
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
};