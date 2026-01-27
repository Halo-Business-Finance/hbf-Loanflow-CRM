import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Users, 
  DollarSign,
  Calendar as CalendarIcon,
  Download,
  Filter,
  RefreshCw,
  PieChart,
  LineChart as LineChartIcon,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Building2,
  Sparkles
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PipelineVelocity } from './PipelineVelocity';
import { RevenueForecastDashboard } from './RevenueForecastDashboard';
import { LenderPerformance } from './LenderPerformance';

interface AnalyticsData {
  revenue: any[];
  conversion: any[];
  pipeline: any[];
  performance: any[];
  teamMetrics: any[];
  predictive: any[];
}

interface MetricCard {
  title: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  color: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'];

export function AdvancedAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    revenue: [],
    conversion: [],
    pipeline: [],
    performance: [],
    teamMetrics: [],
    predictive: []
  });

  const metricCards: MetricCard[] = [
    {
      title: 'Revenue Growth',
      value: '+24.7%',
      change: 24.7,
      trend: 'up',
      icon: TrendingUp,
      color: 'text-green-600'
    },
    {
      title: 'Conversion Rate',
      value: '18.5%',
      change: 2.3,
      trend: 'up',
      icon: Target,
      color: 'text-blue-600'
    },
    {
      title: 'Pipeline Velocity',
      value: '32 days',
      change: -8.2,
      trend: 'up',
      icon: Zap,
      color: 'text-purple-600'
    },
    {
      title: 'Deal Success Rate',
      value: '73%',
      change: 5.1,
      trend: 'up',
      icon: CheckCircle,
      color: 'text-emerald-600'
    }
  ];

  useEffect(() => {
    fetchAnalyticsData();
  }, [user, dateRange, selectedPeriod]);

  const fetchAnalyticsData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Generate sample analytical data
      const sampleRevenueData = Array.from({ length: 12 }, (_, i) => ({
        month: format(new Date(2024, i, 1), 'MMM'),
        revenue: Math.floor(Math.random() * 500000) + 300000,
        target: 450000,
        deals: Math.floor(Math.random() * 25) + 15,
        forecast: Math.floor(Math.random() * 100000) + 400000
      }));

      const sampleConversionData = [
        { stage: 'New Lead', count: 1245, rate: 100 },
        { stage: 'Initial Contact', count: 892, rate: 71.6 },
        { stage: 'Loan Application Signed', count: 687, rate: 55.2 },
        { stage: 'Waiting for Documentation', count: 456, rate: 36.6 },
        { stage: 'Pre-Approved', count: 324, rate: 26.0 },
        { stage: 'Term Sheet Signed', count: 234, rate: 18.8 },
        { stage: 'Loan Approved', count: 145, rate: 11.6 },
        { stage: 'Closing', count: 112, rate: 9.0 },
        { stage: 'Loan Funded', count: 89, rate: 7.2 }
      ];

      const samplePipelineData = [
        { name: 'Prospecting', value: 425, percentage: 32 },
        { name: 'Qualification', value: 298, percentage: 22 },
        { name: 'Proposal', value: 189, percentage: 14 },
        { name: 'Negotiation', value: 134, percentage: 10 },
        { name: 'Closing', value: 89, percentage: 7 },
        { name: 'Won', value: 201, percentage: 15 }
      ];

      const samplePerformanceData = Array.from({ length: 7 }, (_, i) => ({
        day: format(new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000), 'EEE'),
        calls: Math.floor(Math.random() * 50) + 20,
        emails: Math.floor(Math.random() * 80) + 30,
        meetings: Math.floor(Math.random() * 15) + 5,
        productivity: Math.floor(Math.random() * 30) + 70
      }));

      const sampleTeamMetrics = [
        { name: 'Sarah Johnson', deals: 24, revenue: 2850000, efficiency: 94 },
        { name: 'Mike Chen', deals: 18, revenue: 2100000, efficiency: 87 },
        { name: 'Emily Rodriguez', deals: 15, revenue: 1750000, efficiency: 91 },
        { name: 'David Kim', deals: 12, revenue: 1450000, efficiency: 82 },
        { name: 'Lisa Wong', deals: 21, revenue: 2340000, efficiency: 89 }
      ];

      const samplePredictiveData = Array.from({ length: 6 }, (_, i) => ({
        month: format(new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000), 'MMM'),
        predicted: Math.floor(Math.random() * 200000) + 400000,
        confidence: Math.floor(Math.random() * 20) + 75,
        aiScore: Math.floor(Math.random() * 15) + 80
      }));

      setAnalyticsData({
        revenue: sampleRevenueData,
        conversion: sampleConversionData,
        pipeline: samplePipelineData,
        performance: samplePerformanceData,
        teamMetrics: sampleTeamMetrics,
        predictive: samplePredictiveData
      });

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    toast({
      title: "Export Started",
      description: "Your analytics report is being generated...",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading advanced analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Analytics</h2>
          <p className="text-muted-foreground">Deep insights and predictive intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAnalyticsData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((metric, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                  <div className="flex items-center gap-2">
                    <metric.icon className={`h-5 w-5 ${metric.color}`} />
                    <span className="text-2xl font-bold">{metric.value}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className={`h-4 w-4 ${metric.trend === 'up' ? 'text-green-500' : 'text-red-500'}`} />
                    <span className={`text-sm font-medium ${metric.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.change}%
                    </span>
                    <span className="text-xs text-muted-foreground">vs last period</span>
                  </div>
                </div>
                <div className="absolute top-4 right-4 opacity-10">
                  <metric.icon className="h-12 w-12" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="velocity" className="space-y-6">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="velocity" className="flex items-center gap-1">
            <Zap className="h-4 w-4" />
            <span className="hidden lg:inline">Velocity</span>
          </TabsTrigger>
          <TabsTrigger value="forecast" className="flex items-center gap-1">
            <Sparkles className="h-4 w-4" />
            <span className="hidden lg:inline">Forecast</span>
          </TabsTrigger>
          <TabsTrigger value="lenders" className="flex items-center gap-1">
            <Building2 className="h-4 w-4" />
            <span className="hidden lg:inline">Lenders</span>
          </TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="predictive">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="velocity">
          <PipelineVelocity />
        </TabsContent>

        <TabsContent value="forecast">
          <RevenueForecastDashboard />
        </TabsContent>

        <TabsContent value="lenders">
          <LenderPerformance />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  Revenue vs Target
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analyticsData.revenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [
                        `$${(value as number).toLocaleString()}`,
                        name === 'revenue' ? 'Revenue' : name === 'target' ? 'Target' : 'Forecast'
                      ]} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                      <Line type="monotone" dataKey="target" stroke="hsl(var(--destructive))" strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="forecast" stroke="hsl(var(--accent))" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Deal Volume Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData.revenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="deals" 
                        stroke="hsl(var(--primary))" 
                        fill="url(#dealsGradient)"
                      />
                      <defs>
                        <linearGradient id="dealsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conversion" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Conversion Funnel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.conversion.map((stage, index) => (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{stage.stage}</span>
                        <span className="text-sm text-muted-foreground">{stage.count} ({stage.rate}%)</span>
                      </div>
                      <Progress value={stage.rate} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-orange-600" />
                  Stage Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={analyticsData.pipeline}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {analyticsData.pipeline.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-600" />
                Pipeline Health & Velocity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {analyticsData.pipeline.map((stage, index) => (
                  <div key={stage.name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{stage.name}</h4>
                      <Badge variant="outline">{stage.value}</Badge>
                    </div>
                    <Progress value={stage.percentage} className="mb-2" />
                    <p className="text-sm text-muted-foreground">{stage.percentage}% of total pipeline</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChartIcon className="h-5 w-5 text-green-600" />
                Daily Activity Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.performance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="emails" stroke="hsl(var(--secondary))" strokeWidth={2} />
                    <Line type="monotone" dataKey="meetings" stroke="hsl(var(--accent))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Team Performance Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.teamMetrics.map((member, index) => (
                  <div key={member.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={index < 3 ? "default" : "secondary"}>#{index + 1}</Badge>
                      <div>
                        <h4 className="font-medium">{member.name}</h4>
                        <p className="text-sm text-muted-foreground">{member.deals} deals closed</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${member.revenue.toLocaleString()}</p>
                      <div className="flex items-center gap-2">
                        <Progress value={member.efficiency} className="w-20 h-2" />
                        <span className="text-sm text-muted-foreground">{member.efficiency}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictive" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  AI Revenue Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData.predictive}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${(value as number).toLocaleString()}`, 'Predicted Revenue']} />
                      <Area 
                        type="monotone" 
                        dataKey="predicted" 
                        stroke="hsl(var(--primary))" 
                        fill="url(#predictiveGradient)"
                      />
                      <defs>
                        <linearGradient id="predictiveGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  AI Insights & Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-green-800">Opportunity Identified</h4>
                        <p className="text-sm text-green-700">Q3 pipeline shows 23% higher conversion potential than Q2</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-800">Action Required</h4>
                        <p className="text-sm text-yellow-700">12 deals approaching 45-day mark without activity</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Target className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-800">Forecast Accuracy</h4>
                        <p className="text-sm text-blue-700">AI confidence level: 89% for next quarter predictions</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}