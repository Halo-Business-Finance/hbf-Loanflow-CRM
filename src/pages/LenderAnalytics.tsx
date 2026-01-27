import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { StandardKPICard } from '@/components/StandardKPICard';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  Award,
  ArrowLeft,
} from 'lucide-react';
import { useLenderAnalytics } from '@/hooks/useLenderAnalytics';
import { formatCurrency, formatNumber } from '@/lib/utils';

const PERFORMANCE_COLORS = {
  excellent: 'hsl(var(--chart-1))',
  good: 'hsl(var(--chart-2))',
  average: 'hsl(var(--chart-3))',
  poor: 'hsl(var(--chart-4))',
};

export default function LenderAnalytics() {
  const navigate = useNavigate();
  const { loading, lenderPerformance, monthlyTrends } = useLenderAnalytics();
  const [selectedMetric, setSelectedMetric] = useState<'volume' | 'amount' | 'speed'>('amount');

  if (loading) {
    return <LoadingSkeleton />;
  }

  // Calculate summary stats
  const totalLenders = lenderPerformance.length;
  const totalFunded = lenderPerformance.reduce((sum, l) => sum + l.total_funded, 0);
  const avgTimeToFunding = lenderPerformance.reduce((sum, l) => sum + l.avg_days_to_funding, 0) / totalLenders;
  const bestPerformer = lenderPerformance.sort((a, b) => b.total_funded - a.total_funded)[0];

  // Get color based on time to funding
  const getSpeedColor = (days: number) => {
    if (days < 30) return PERFORMANCE_COLORS.excellent;
    if (days < 60) return PERFORMANCE_COLORS.good;
    if (days < 90) return PERFORMANCE_COLORS.average;
    return PERFORMANCE_COLORS.poor;
  };

  // Prepare data for charts
  const sortedByAmount = [...lenderPerformance]
    .sort((a, b) => b.total_funded - a.total_funded)
    .slice(0, 10);

  const sortedByVolume = [...lenderPerformance]
    .sort((a, b) => b.total_loans - a.total_loans)
    .slice(0, 10);

  const sortedBySpeed = [...lenderPerformance]
    .filter(l => l.avg_days_to_funding > 0)
    .sort((a, b) => a.avg_days_to_funding - b.avg_days_to_funding)
    .slice(0, 10);

  // Performance matrix data for scatter plot
  const matrixData = lenderPerformance
    .filter(l => l.total_funded > 0 && l.avg_days_to_funding > 0)
    .map(l => ({
      name: l.name,
      amount: l.total_funded,
      speed: l.avg_days_to_funding,
      volume: l.total_loans,
      lender_type: l.lender_type,
    }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/lenders')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Lenders
        </Button>
      </div>

      <IBMPageHeader
        title="Lender Performance Analytics"
        subtitle="Compare lender performance across key metrics"
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StandardKPICard
          title="Active Lenders"
          value={formatNumber(totalLenders)}
          trend={{ value: '12% vs last period', direction: 'up' }}
        />
        <StandardKPICard
          title="Total Funded"
          value={formatCurrency(totalFunded)}
          trend={{ value: '18% vs last period', direction: 'up' }}
        />
        <StandardKPICard
          title="Avg Time to Fund"
          value={`${Math.round(avgTimeToFunding)} days`}
          trend={{ value: '8% faster', direction: 'up' }}
        />
        <StandardKPICard
          title="Best Performer"
          value={bestPerformer?.name || 'N/A'}
          trend={{ value: `${Math.round(bestPerformer?.avg_days_to_funding || 0)} days avg`, direction: 'neutral' }}
        />
      </div>

      {/* Chart Selection Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Top Performing Lenders</CardTitle>
              <CardDescription>Compare lenders by different metrics</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedMetric === 'amount' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric('amount')}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                By Amount
              </Button>
              <Button
                variant={selectedMetric === 'volume' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric('volume')}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                By Volume
              </Button>
              <Button
                variant={selectedMetric === 'speed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric('speed')}
              >
                <Clock className="h-4 w-4 mr-2" />
                By Speed
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <>
              {selectedMetric === 'amount' && (
                <BarChart data={sortedByAmount} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Bar dataKey="total_funded" fill={PERFORMANCE_COLORS.excellent} radius={[0, 8, 8, 0]} />
                </BarChart>
              )}
              {selectedMetric === 'volume' && (
                <BarChart data={sortedByVolume} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="total_loans" fill={PERFORMANCE_COLORS.good} radius={[0, 8, 8, 0]} />
                </BarChart>
              )}
              {selectedMetric === 'speed' && (
                <BarChart data={sortedBySpeed} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: any) => `${Math.round(value)} days`}
                  />
                  <Bar dataKey="avg_days_to_funding" fill={PERFORMANCE_COLORS.average} radius={[0, 8, 8, 0]} />
                </BarChart>
              )}
            </>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Matrix Scatter Plot */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Matrix</CardTitle>
          <CardDescription>
            Funding amount vs. time to funding (bubble size = loan volume)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                type="number" 
                dataKey="amount" 
                name="Total Funded"
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(value) => formatCurrency(value)}
              />
              <YAxis 
                type="number" 
                dataKey="speed" 
                name="Days to Fund"
                stroke="hsl(var(--muted-foreground))"
                label={{ value: 'Days to Fund (Lower is Better)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'Total Funded') return formatCurrency(value);
                  if (name === 'Days to Fund') return `${Math.round(value)} days`;
                  return value;
                }}
              />
              <Scatter 
                name="Lenders" 
                data={matrixData} 
                fill={PERFORMANCE_COLORS.good}
              >
                {matrixData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getSpeedColor(entry.speed)}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      {monthlyTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Funding Trends</CardTitle>
            <CardDescription>Top 5 lenders performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Legend />
                {sortedByAmount.slice(0, 5).map((lender, index) => (
                  <Line
                    key={lender.id}
                    type="monotone"
                    dataKey={lender.name}
                    stroke={Object.values(PERFORMANCE_COLORS)[index % 4]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Lender Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Performance Metrics</CardTitle>
          <CardDescription>Complete performance breakdown by lender</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Lender</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Total Loans</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Total Funded</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Avg Days</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {lenderPerformance.map((lender) => (
                  <tr 
                    key={lender.id} 
                    className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/lenders/${lender.id}`)}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {lender.logo_url ? (
                          <img 
                            src={lender.logo_url} 
                            alt={lender.name}
                            className="h-8 w-8 rounded object-contain"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <Award className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{lender.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary">{lender.lender_type}</Badge>
                    </td>
                    <td className="text-right p-3">{formatNumber(lender.total_loans)}</td>
                    <td className="text-right p-3 font-semibold text-primary">
                      {formatCurrency(lender.total_funded)}
                    </td>
                    <td className="text-right p-3">
                      <span 
                        className="px-2 py-1 rounded text-sm"
                        style={{ 
                          backgroundColor: `${getSpeedColor(lender.avg_days_to_funding)}20`,
                          color: getSpeedColor(lender.avg_days_to_funding)
                        }}
                      >
                        {Math.round(lender.avg_days_to_funding) || 0} days
                      </span>
                    </td>
                    <td className="text-right p-3">
                      {lender.conversion_rate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
