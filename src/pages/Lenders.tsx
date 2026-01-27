import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { StandardKPICard } from '@/components/StandardKPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin,
  Users,
  Filter,
  ArrowUpDown,
  BarChart3
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPhoneNumber, formatCurrency, formatNumber } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useLenderAnalytics } from '@/hooks/useLenderAnalytics';

interface Lender {
  id: string;
  name: string;
  lender_type: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  user_id: string;
  contact_count?: number;
}

const PERFORMANCE_COLORS = {
  excellent: 'hsl(var(--chart-1))',
  good: 'hsl(var(--chart-2))',
  average: 'hsl(var(--chart-3))',
  poor: 'hsl(var(--chart-4))',
};

export default function Lenders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLenders, setSelectedLenders] = useState<string[]>([]);
  const { loading: analyticsLoading, lenderPerformance, monthlyTrends } = useLenderAnalytics();

  useEffect(() => {
    if (user) {
      fetchLenders();
    }
  }, [user]);

  const fetchLenders = async () => {
    try {
      setLoading(true);
      
      // Fetch lenders and contact counts in parallel
      const [lendersResult, contactCountsResult] = await Promise.all([
        supabase.from('lenders').select('*').order('name'),
        supabase.from('lender_contacts').select('lender_id')
      ]);

      if (lendersResult.error) throw lendersResult.error;

      // Aggregate contact counts on client side (more efficient than N queries)
      const contactCounts = (contactCountsResult.data || []).reduce((acc, contact) => {
        acc[contact.lender_id] = (acc[contact.lender_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const lendersWithCount = (lendersResult.data || []).map(lender => ({
        ...lender,
        contact_count: contactCounts[lender.id] || 0
      }));

      setLenders(lendersWithCount);
    } catch (error) {
      console.error('Error fetching lenders:', error);
      toast({
        title: "Error",
        description: "Failed to load lenders",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLenders(filteredLenders.map(l => l.id));
    } else {
      setSelectedLenders([]);
    }
  };

  const handleSelectLender = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedLenders([...selectedLenders, id]);
    } else {
      setSelectedLenders(selectedLenders.filter(lid => lid !== id));
    }
  };

  const filteredLenders = lenders.filter(lender =>
    lender.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lender.lender_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lender.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lender.state?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalLenders = lenders.length;
  const activeLenders = lenders.filter(l => l.is_active).length;
  const inactiveLenders = lenders.filter(l => !l.is_active).length;
  const totalContacts = lenders.reduce((sum, l) => sum + (l.contact_count || 0), 0);

  // Prepare chart data
  const topFiveFunded = [...lenderPerformance]
    .sort((a, b) => b.total_funded - a.total_funded)
    .slice(0, 5);

  const topFiveSpeed = [...lenderPerformance]
    .filter(l => l.avg_days_to_funding > 0)
    .sort((a, b) => a.avg_days_to_funding - b.avg_days_to_funding)
    .slice(0, 5);

  const getSpeedColor = (days: number) => {
    if (days < 30) return PERFORMANCE_COLORS.excellent;
    if (days < 60) return PERFORMANCE_COLORS.good;
    if (days < 90) return PERFORMANCE_COLORS.average;
    return PERFORMANCE_COLORS.poor;
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Banks & Lenders"
        subtitle="Manage your lending partners and their contacts"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/lenders/analytics')}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Button>
            <Button onClick={() => navigate('/lenders/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Lender
            </Button>
          </div>
        }
      />
      
      <div className="p-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StandardKPICard title="Total Lenders" value={totalLenders.toString()} />
          <StandardKPICard title="Active Lenders" value={activeLenders.toString()} />
          <StandardKPICard title="Inactive Lenders" value={inactiveLenders.toString()} />
          <StandardKPICard title="Total Contacts" value={totalContacts.toString()} />
        </div>

        {/* Performance Charts */}
        {!analyticsLoading && lenderPerformance.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Lenders by Funding Amount */}
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Top 5 Lenders by Funding</h3>
                  <p className="text-sm text-muted-foreground">Total amount funded per lender</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topFiveFunded} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="total_funded" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Time to Funding */}
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Fastest Time to Funding</h3>
                  <p className="text-sm text-muted-foreground">Average days to fund per lender</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topFiveSpeed} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" label={{ value: 'Days', position: 'insideBottom', offset: -5 }} />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip
                      formatter={(value: number) => `${value.toFixed(1)} days`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="avg_days_to_funding" radius={[0, 4, 4, 0]}>
                      {topFiveSpeed.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getSpeedColor(entry.avg_days_to_funding)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly Funding Trends */}
        {!analyticsLoading && monthlyTrends.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground">Monthly Funding Trends</h3>
                <p className="text-sm text-muted-foreground">Top 5 lenders performance over time</p>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  {Object.keys(monthlyTrends[0] || {})
                    .filter(key => key !== 'month')
                    .map((lenderName, index) => (
                      <Line
                        key={lenderName}
                        type="monotone"
                        dataKey={lenderName}
                        stroke={`hsl(var(--chart-${(index % 5) + 1}))`}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Search Bar with Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search lenders by name, type, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="default" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lenders Table */}
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLenders.length === filteredLenders.length && filteredLenders.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="uppercase text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      Lender Name
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="uppercase text-xs font-semibold">Contact Information</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">Lender Type</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      Status
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead className="uppercase text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      Created
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLenders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No lenders found</h3>
                      <p className="text-muted-foreground">
                        {searchQuery ? 'Try adjusting your search' : 'Get started by adding your first lender'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLenders.map((lender) => (
                    <TableRow
                      key={lender.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/lenders/${lender.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLenders.includes(lender.id)}
                          onCheckedChange={(checked) => handleSelectLender(lender.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center overflow-hidden">
                            {lender.logo_url ? (
                              <img src={lender.logo_url} alt={`${lender.name} logo`} className="h-full w-full object-cover" />
                            ) : (
                              <Building2 className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{lender.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {lender.contact_count || 0} contacts
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {lender.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span>{formatPhoneNumber(lender.phone)}</span>
                            </div>
                          )}
                          {lender.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[200px]">{lender.email}</span>
                            </div>
                          )}
                          {lender.city && lender.state && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{lender.city}, {lender.state}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {lender.lender_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lender.is_active ? (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="text-sm">Active</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                            <span className="text-sm">Inactive</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(lender.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                          <div className="text-xs text-muted-foreground">
                            {new Date(lender.created_at).toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            })}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
