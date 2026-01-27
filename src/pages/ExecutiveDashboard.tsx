import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StandardKPICard } from "@/components/StandardKPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Calendar, Download, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPipeline: 0,
    closedWon: 0,
    conversionRate: 0,
    avgDealSize: 0,
    leadsThisMonth: 0,
    activeDeals: 0,
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, timeRange]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    const [leadsRes, clientsRes] = await Promise.all([
      supabase.from("leads").select("*, contact_entities(loan_amount, stage)"),
      supabase.from("clients").select("*, contact_entities(loan_amount)"),
    ]);

    const leads = leadsRes.data || [];
    const clients = clientsRes.data || [];

    // Calculate total pipeline value from leads
    const totalPipeline = leads.reduce((sum, lead: any) => {
      const amount = lead.contact_entities?.loan_amount || 0;
      return sum + amount;
    }, 0);

    // Calculate actual closed/won revenue from clients
    const closedWon = clients.reduce((sum, client: any) => {
      const amount = client.contact_entities?.loan_amount || 0;
      return sum + amount;
    }, 0);

    // Calculate average deal size from actual client data
    const avgDealSize = clients.length > 0 ? closedWon / clients.length : 0;

    // Count leads this month
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const leadsThisMonth = leads.filter((l: any) => new Date(l.created_at) > thirtyDaysAgo).length;

    // Count active deals (leads not in Loan Funded or Archive)
    const activeDeals = leads.filter((l: any) => {
      const stage = l.contact_entities?.stage || '';
      return stage !== 'Loan Funded' && stage !== 'Archive';
    }).length;

    setStats({
      totalPipeline,
      closedWon,
      conversionRate: leads.length > 0 ? (clients.length / leads.length) * 100 : 0,
      avgDealSize,
      leadsThisMonth,
      activeDeals,
    });
    setIsLoading(false);
  };

  const revenueData = [
    { month: "Jul", revenue: 420000, target: 400000 },
    { month: "Aug", revenue: 480000, target: 450000 },
    { month: "Sep", revenue: 520000, target: 500000 },
    { month: "Oct", revenue: 610000, target: 550000 },
    { month: "Nov", revenue: 580000, target: 600000 },
    { month: "Dec", revenue: 720000, target: 650000 },
  ];

  const pipelineData = [
    { stage: "New", value: 2400000, count: 45 },
    { stage: "Qualified", value: 1800000, count: 32 },
    { stage: "Proposal", value: 1200000, count: 18 },
    { stage: "Negotiation", value: 800000, count: 12 },
    { stage: "Closing", value: 400000, count: 6 },
  ];

  const productMix = [
    { name: "SBA 7(a)", value: 40, color: "#3b82f6" },
    { name: "Commercial RE", value: 25, color: "#10b981" },
    { name: "Equipment", value: 20, color: "#f59e0b" },
    { name: "Line of Credit", value: 15, color: "#8b5cf6" },
  ];

  const teamPerformance = [
    { name: "John Smith", closed: 12, pipeline: 2400000, conversion: 28 },
    { name: "Sarah Johnson", closed: 10, pipeline: 1800000, conversion: 25 },
    { name: "Mike Williams", closed: 8, pipeline: 1500000, conversion: 22 },
    { name: "Emily Davis", closed: 6, pipeline: 1200000, conversion: 20 },
  ];

  const kpiCards = [
    {
      title: "Total Pipeline",
      value: `$${(stats.totalPipeline / 1000000).toFixed(1)}M`,
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "bg-blue-500/20 text-blue-400",
    },
    {
      title: "Closed Won (YTD)",
      value: `$${(stats.closedWon / 1000000).toFixed(1)}M`,
      change: "+8.2%",
      trend: "up",
      icon: Target,
      color: "bg-green-500/20 text-green-400",
    },
    {
      title: "Conversion Rate",
      value: `${stats.conversionRate.toFixed(1)}%`,
      change: "-2.1%",
      trend: "down",
      icon: TrendingUp,
      color: "bg-yellow-500/20 text-yellow-400",
    },
    {
      title: "Avg Deal Size",
      value: `$${(stats.avgDealSize / 1000).toFixed(0)}K`,
      change: "+5.3%",
      trend: "up",
      icon: Users,
      color: "bg-purple-500/20 text-purple-400",
    },
  ];

  if (isLoading) {
    return (
      <StandardPageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </StandardPageLayout>
    );
  }

  return (
    <StandardPageLayout>
      <IBMPageHeader
        title="Executive Dashboard"
        subtitle="Real-time KPI monitoring and drill-down analytics"
        actions={
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={fetchDashboardData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {kpiCards.map((kpi, index) => (
          <StandardKPICard
            key={index}
            title={kpi.title}
            value={kpi.value}
            trend={{
              value: kpi.change,
              direction: kpi.trend === "up" ? "up" : "down"
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Target</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v/1000}K`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                  formatter={(value: number) => [`$${(value/1000).toFixed(0)}K`, '']}
                />
                <Area type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" strokeDasharray="5 5" />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v/1000000}M`} />
                <YAxis type="category" dataKey="stage" stroke="hsl(var(--muted-foreground))" width={80} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                  formatter={(value: number) => [`$${(value/1000000).toFixed(1)}M`, 'Value']}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Product Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={productMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {productMix.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {productMix.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm">{item.name}</span>
                  <span className="text-sm text-muted-foreground ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Team Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamPerformance.map((member, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-medium">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.closed} deals closed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium">${(member.pipeline / 1000000).toFixed(1)}M</p>
                      <p className="text-xs text-muted-foreground">Pipeline</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{member.conversion}%</p>
                      <p className="text-xs text-muted-foreground">Conversion</p>
                    </div>
                    <Badge variant={member.conversion >= 25 ? "default" : "secondary"}>
                      {member.conversion >= 25 ? "On Track" : "Needs Focus"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </StandardPageLayout>
  );
}
