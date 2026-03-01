import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StandardKPICard } from '@/components/StandardKPICard';
import { StandardContentCard } from '@/components/StandardContentCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
  FunnelChart, Funnel, LabelList,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Mail, MousePointerClick,
  Eye, Target, ArrowUpRight, Calendar, Filter, Download,
  Megaphone, BarChart3, PieChart as PieChartIcon, Activity,
} from 'lucide-react';
import { ibmDb, supabase } from '@/lib/ibm';

// ── Mock/seed analytics data ───────────────────────────────────────────────
const monthlyTraffic = [
  { month: 'Sep', visitors: 4200, leads: 310, conversions: 42 },
  { month: 'Oct', visitors: 5100, leads: 380, conversions: 55 },
  { month: 'Nov', visitors: 4800, leads: 350, conversions: 48 },
  { month: 'Dec', visitors: 5600, leads: 420, conversions: 63 },
  { month: 'Jan', visitors: 6200, leads: 490, conversions: 71 },
  { month: 'Feb', visitors: 7100, leads: 560, conversions: 88 },
];

const leadSources = [
  { name: 'Direct / Organic', value: 34, color: 'hsl(var(--primary))' },
  { name: 'Email Campaign', value: 26, color: 'hsl(210, 80%, 55%)' },
  { name: 'Referral', value: 22, color: 'hsl(150, 60%, 45%)' },
  { name: 'Social Media', value: 10, color: 'hsl(45, 90%, 55%)' },
  { name: 'Paid Ads', value: 8, color: 'hsl(0, 70%, 55%)' },
];

const conversionFunnel = [
  { name: 'Website Visitors', value: 7100, fill: 'hsl(var(--primary))' },
  { name: 'Form Submissions', value: 560, fill: 'hsl(210, 80%, 55%)' },
  { name: 'Qualified Leads', value: 320, fill: 'hsl(150, 60%, 45%)' },
  { name: 'Applications', value: 142, fill: 'hsl(45, 90%, 55%)' },
  { name: 'Closed Loans', value: 88, fill: 'hsl(0, 70%, 55%)' },
];

const campaignPerformance = [
  { name: 'SBA Loan Awareness', sent: 2400, opened: 1680, clicked: 456, conversions: 32, status: 'active', type: 'drip' },
  { name: 'Q1 Refinance Push', sent: 1800, opened: 1170, clicked: 351, conversions: 28, status: 'active', type: 'blast' },
  { name: 'New Borrower Welcome', sent: 890, opened: 712, clicked: 267, conversions: 45, status: 'active', type: 'drip' },
  { name: 'Commercial RE Series', sent: 1200, opened: 780, clicked: 234, conversions: 18, status: 'paused', type: 'drip' },
  { name: 'Holiday Rate Special', sent: 3200, opened: 1920, clicked: 512, conversions: 41, status: 'completed', type: 'blast' },
];

const weeklyEngagement = [
  { day: 'Mon', opens: 320, clicks: 89 },
  { day: 'Tue', opens: 410, clicks: 112 },
  { day: 'Wed', opens: 380, clicks: 95 },
  { day: 'Thu', opens: 450, clicks: 134 },
  { day: 'Fri', opens: 290, clicks: 78 },
  { day: 'Sat', opens: 120, clicks: 34 },
  { day: 'Sun', opens: 90, clicks: 22 },
];

const statusColor: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-muted text-muted-foreground border-border',
};

export function MarketingAnalyticsDashboard() {
  const [campaigns, setCampaigns] = useState(campaignPerformance);
  const [dbCampaignCount, setDbCampaignCount] = useState<number | null>(null);

  // Try to get real campaign count from Supabase
  useEffect(() => {
    supabase
      .from('email_campaigns')
      .select('id')
      .then(({ data }) => {
        if (data) setDbCampaignCount(data.length);
      });
  }, []);

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalOpened = campaigns.reduce((s, c) => s + c.opened, 0);
  const totalClicked = campaigns.reduce((s, c) => s + c.clicked, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);

  return (
    <div className="space-y-6">
      {/* ── KPI Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StandardKPICard
          title="Total Campaigns"
          value={dbCampaignCount ?? campaigns.length}
          trend={{ value: '+2 this month', direction: 'up' }}
        />
        <StandardKPICard
          title="Emails Sent"
          value={totalSent.toLocaleString()}
          trend={{ value: '+18% vs last month', direction: 'up' }}
        />
        <StandardKPICard
          title="Open Rate"
          value={`${((totalOpened / totalSent) * 100).toFixed(1)}%`}
          trend={{ value: '+2.3%', direction: 'up' }}
        />
        <StandardKPICard
          title="Click Rate"
          value={`${((totalClicked / totalSent) * 100).toFixed(1)}%`}
          trend={{ value: '+1.1%', direction: 'up' }}
        />
        <StandardKPICard
          title="Conversions"
          value={totalConversions}
          trend={{ value: `${((totalConversions / totalClicked) * 100).toFixed(1)}% CTR→Conv`, direction: 'up' }}
        />
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><Megaphone className="h-4 w-4" /> Campaigns</TabsTrigger>
          <TabsTrigger value="sources" className="gap-1.5"><PieChartIcon className="h-4 w-4" /> Lead Sources</TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1.5"><Target className="h-4 w-4" /> Conversion Funnel</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ───────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traffic & Leads trend */}
            <StandardContentCard title="Traffic & Lead Generation">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTraffic}>
                    <defs>
                      <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(150,60%,45%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(150,60%,45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="visitors" stroke="hsl(var(--primary))" fill="url(#colorVisitors)" name="Visitors" />
                    <Area type="monotone" dataKey="leads" stroke="hsl(150,60%,45%)" fill="url(#colorLeads)" name="Leads" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </StandardContentCard>

            {/* Weekly Engagement */}
            <StandardContentCard title="Weekly Email Engagement">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyEngagement}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Bar dataKey="opens" fill="hsl(var(--primary))" name="Opens" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="clicks" fill="hsl(210,80%,55%)" name="Clicks" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </StandardContentCard>
          </div>
        </TabsContent>

        {/* ── CAMPAIGNS TAB ──────────────────────────────────── */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Campaign Performance</h3>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <StandardContentCard key={c.name}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-foreground truncate">{c.name}</h4>
                      <Badge variant="outline" className={statusColor[c.status]}>{c.status}</Badge>
                      <Badge variant="outline" className="text-xs">{c.type}</Badge>
                    </div>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <span><Mail className="inline h-3.5 w-3.5 mr-1" />{c.sent.toLocaleString()} sent</span>
                      <span><Eye className="inline h-3.5 w-3.5 mr-1" />{((c.opened / c.sent) * 100).toFixed(1)}% opened</span>
                      <span><MousePointerClick className="inline h-3.5 w-3.5 mr-1" />{((c.clicked / c.sent) * 100).toFixed(1)}% clicked</span>
                      <span><Target className="inline h-3.5 w-3.5 mr-1" />{c.conversions} conversions</span>
                    </div>
                  </div>
                  <div className="w-48">
                    <div className="text-xs text-muted-foreground mb-1">Open rate</div>
                    <Progress value={(c.opened / c.sent) * 100} className="h-2" />
                  </div>
                </div>
              </StandardContentCard>
            ))}
          </div>
        </TabsContent>

        {/* ── LEAD SOURCES TAB ───────────────────────────────── */}
        <TabsContent value="sources" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StandardContentCard title="Lead Source Distribution">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={leadSources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {leadSources.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </StandardContentCard>

            <StandardContentCard title="Source Performance">
              <div className="space-y-4">
                {leadSources.map((s) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-foreground font-medium">{s.name}</span>
                        <span className="text-muted-foreground">{s.value}%</span>
                      </div>
                      <Progress value={s.value} className="h-1.5 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </StandardContentCard>
          </div>
        </TabsContent>

        {/* ── CONVERSION FUNNEL TAB ──────────────────────────── */}
        <TabsContent value="funnel" className="space-y-6">
          <StandardContentCard title="Conversion Funnel">
            <div className="space-y-3">
              {conversionFunnel.map((stage, i) => {
                const prevValue = i === 0 ? stage.value : conversionFunnel[i - 1].value;
                const dropOff = i === 0 ? 100 : ((stage.value / prevValue) * 100);
                const width = (stage.value / conversionFunnel[0].value) * 100;

                return (
                  <div key={stage.name} className="flex items-center gap-4">
                    <div className="w-36 text-sm text-muted-foreground text-right">{stage.name}</div>
                    <div className="flex-1">
                      <div
                        className="h-10 rounded-md flex items-center px-3 text-sm font-medium text-white transition-all"
                        style={{ width: `${Math.max(width, 8)}%`, backgroundColor: stage.fill }}
                      >
                        {stage.value.toLocaleString()}
                      </div>
                    </div>
                    <div className="w-20 text-xs text-muted-foreground">
                      {i > 0 && (
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 text-destructive" />
                          {dropOff.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </StandardContentCard>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StandardKPICard
              title="Visitor → Lead"
              value={`${((conversionFunnel[1].value / conversionFunnel[0].value) * 100).toFixed(1)}%`}
              trend={{ value: 'Form submission rate', direction: 'neutral' }}
            />
            <StandardKPICard
              title="Lead → Application"
              value={`${((conversionFunnel[3].value / conversionFunnel[1].value) * 100).toFixed(1)}%`}
              trend={{ value: 'Qualification rate', direction: 'up' }}
            />
            <StandardKPICard
              title="Application → Close"
              value={`${((conversionFunnel[4].value / conversionFunnel[3].value) * 100).toFixed(1)}%`}
              trend={{ value: 'Close rate', direction: 'up' }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
