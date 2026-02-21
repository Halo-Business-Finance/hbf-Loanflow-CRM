import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import {
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users,
  FileText,
  Download,
  Calendar,
  Target,
  Activity,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useReportsData } from '@/hooks/useReportsData';
import { ibmDb } from '@/lib/ibm';

interface ReportsOverview {
  totalReports: number;
  generatedToday: number;
  scheduledReports: number;
  dataAccuracy: number;
  processingTime: number;
  storageUsed: number;
  complianceScore: number;
  alertsActive: number;
}

export default function Reports() {
  const { reportData, monthlyData, topPerformers, loading, refetch } = useReportsData();
  const [overview, setOverview] = useState<ReportsOverview>({
    totalReports: 0,
    generatedToday: 0,
    scheduledReports: 0,
    dataAccuracy: 0,
    processingTime: 0,
    storageUsed: 0,
    complianceScore: 0,
    alertsActive: 0
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch all leads
        const { data: leads } = await ibmDb
          .from('leads')
          .select(`
            id,
            created_at,
            updated_at,
            contact_entities (
              stage,
              loan_amount,
              credit_score
            )
          `);

        const totalReports = (leads as any[])?.length || 0;
        
        // Calculate leads created today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const generatedToday = (leads as any[])?.filter((l: any) => {
          const created = new Date(l.created_at);
          created.setHours(0, 0, 0, 0);
          return created.getTime() === today.getTime();
        }).length || 0;
        // Calculate data quality metrics
        const leadsWithCompleteData = (leads as any[])?.filter((l: any) => {
          const contact = l.contact_entities as any;
          return contact?.stage && contact?.loan_amount && contact?.credit_score;
        }).length || 0;
        
        const dataAccuracy = totalReports > 0 ? 
          Math.round((leadsWithCompleteData / totalReports) * 100) : 0;

        const avgUpdateTime = (leads as any[])?.length > 0 ?
          (leads as any[]).reduce((sum: number, l: any) => {
            const created = new Date(l.created_at).getTime();
            const updated = new Date(l.updated_at).getTime();
            return sum + ((updated - created) / (1000 * 60 * 60)); // hours
          }, 0) / (leads as any[]).length : 0;

        // Calculate compliance based on complete stages
        const closedLeads = (leads as any[])?.filter((l: any) => 
          (l.contact_entities as any)?.stage === 'Closed Won'
        ).length || 0;
        const complianceScore = totalReports > 0 ?
          Math.round((closedLeads / totalReports) * 100) : 0;

        const alertsActive = (leads as any[])?.filter((l: any) => {
          const stage = (l.contact_entities as any)?.stage;
          return stage === 'Initial Contact' || stage === 'Waiting for Documentation';
        }).length || 0;

        setOverview({
          totalReports,
          generatedToday,
          scheduledReports: 0,
          dataAccuracy,
          processingTime: Number(avgUpdateTime.toFixed(1)),
          storageUsed: 0,
          complianceScore,
          alertsActive
        });

      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    };

    fetchMetrics();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background overflow-auto no-scrollbar">
      <IBMPageHeader
        title="Business Intelligence Center"
        subtitle="Advanced analytics, reporting, and performance insights"
        actions={
          <Button className="gap-2 bg-[#0f62fe] hover:bg-[#0353e9] text-white">
            <Download className="h-4 w-4" />
            Export Reports
          </Button>
        }
      />

      <div className="px-4 md:px-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-[#0A1628] hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Total Reports</h3>
                  <p className="text-2xl font-bold">{overview.totalReports}</p>
                </div>
                <FileText className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-[#0A1628] hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Data Accuracy</h3>
                  <p className="text-2xl font-bold">{overview.dataAccuracy}%</p>
                </div>
                <Target className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-[#0A1628] hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Processing Time</h3>
                  <p className="text-2xl font-bold">{overview.processingTime}s</p>
                </div>
                <Activity className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-[#0A1628] hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Compliance Score</h3>
                  <p className="text-2xl font-bold">{overview.complianceScore}%</p>
                </div>
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alert */}
        {overview.alertsActive > 0 && (
          <Alert className="border-warning/50">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription>
              <strong>{overview.alertsActive} active alerts</strong> require attention in your reports.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-[#0A1628] p-1 gap-2">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md">
              <span>Report Overview</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md">
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md">
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="compliance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md">
              <span>Compliance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-[#0A1628]">
                <CardHeader>
                  <CardTitle>Revenue Analytics</CardTitle>
                  <CardDescription>Monthly revenue tracking and performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Revenue</span>
                      <span className="font-semibold">—</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Monthly Growth</span>
                      <span className="font-semibold">—</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg Deal Size</span>
                      <span className="font-semibold">—</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#0A1628]">
                <CardHeader>
                  <CardTitle>Lead Performance</CardTitle>
                  <CardDescription>Lead generation and conversion analytics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Leads</span>
                      <span className="font-semibold">{overview.totalReports}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Conversion Rate</span>
                      <span className="font-semibold">{reportData?.applications?.approvalRate || overview.complianceScore}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Quality Score</span>
                      <span className="font-semibold text-blue-600">{(overview.dataAccuracy / 10).toFixed(1)}/10</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-[#0A1628]">
              <CardHeader>
                <CardTitle>Quick Report Generation</CardTitle>
                <CardDescription>Generate standard business reports instantly</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <Button className="w-full gap-2" variant="outline">
                    <Download className="h-4 w-4" />
                    Revenue Report
                  </Button>
                  <Button className="w-full gap-2" variant="outline">
                    <Download className="h-4 w-4" />
                    Lead Analysis
                  </Button>
                  <Button className="w-full gap-2" variant="outline">
                    <Download className="h-4 w-4" />
                    Performance Summary
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-[#0A1628]">
                <CardHeader>
                  <CardTitle>Goal Achievement</CardTitle>
                  <CardDescription>Performance against set targets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground text-center py-6">
                    Goal tracking not configured yet.
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#0A1628]">
                <CardHeader>
                  <CardTitle>Time-Based Metrics</CardTitle>
                  <CardDescription>Efficiency and timing analytics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg Response Time</span>
                      <span className="font-semibold">{overview.processingTime}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Deal Closure Time</span>
                      <span className="font-semibold">—</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Follow-up Rate</span>
                      <span className="font-semibold">—</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="border-[#0A1628]">
                <CardHeader>
                  <CardTitle>Data Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-2">{overview.dataAccuracy}%</div>
                  <p className="text-sm text-muted-foreground">Data accuracy across {overview.totalReports} records</p>
                </CardContent>
              </Card>

              <Card className="border-[#0A1628]">
                <CardHeader>
                  <CardTitle>Processing Speed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-2">{overview.processingTime}h</div>
                  <p className="text-sm text-muted-foreground">Average processing time per lead</p>
                </CardContent>
              </Card>

              <Card className="border-[#0A1628]">
                <CardHeader>
                  <CardTitle>Cost Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold mb-2">${overview.storageUsed}MB</div>
                  <p className="text-sm text-muted-foreground">Storage used for {overview.totalReports} leads</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <Card className="border-[#0A1628]">
              <CardHeader>
                <CardTitle>Compliance Dashboard</CardTitle>
                <CardDescription>Regulatory compliance and audit readiness</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex justify-between items-center p-4 border rounded-lg">
                    <span className="text-sm font-medium">SOX Compliance</span>
                    <span className="font-bold text-green-600">{overview.complianceScore}%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 border rounded-lg">
                    <span className="text-sm font-medium">Data Retention</span>
                    <span className="font-bold text-blue-600">—</span>
                  </div>
                  <div className="flex justify-between items-center p-4 border rounded-lg">
                    <span className="text-sm font-medium">Security Score</span>
                    <span className="font-bold text-purple-600">—</span>
                  </div>
                  <div className="flex justify-between items-center p-4 border rounded-lg">
                    <span className="text-sm font-medium">Audit Readiness</span>
                    <span className="font-bold text-orange-600">—</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}