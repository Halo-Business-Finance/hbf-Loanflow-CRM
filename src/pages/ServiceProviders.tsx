import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StandardKPICard } from "@/components/StandardKPICard";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, Phone, Mail, MapPin, Plus, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ServiceProvider {
  id: string;
  name: string;
  provider_type: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  average_closing_days: number | null;
  success_rate: number | null;
  is_active: boolean;
}

export default function ServiceProviders() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [relatedLeadsCount, setRelatedLeadsCount] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchProviders();
    fetchRelatedLeadsCount();
  }, []);

  const fetchRelatedLeadsCount = async () => {
    try {
      const { data: contactData, error } = await supabase
        .from("contact_entities")
        .select("title_company_id, escrow_company_id");

      if (error) throw error;

      const counts: Record<string, number> = {};
      contactData?.forEach((contact) => {
        if (contact.title_company_id) {
          counts[contact.title_company_id] = (counts[contact.title_company_id] || 0) + 1;
        }
        if (contact.escrow_company_id) {
          counts[contact.escrow_company_id] = (counts[contact.escrow_company_id] || 0) + 1;
        }
      });

      setRelatedLeadsCount(counts);
    } catch (error) {
      console.error("Error fetching related leads count:", error);
    }
  };

  const fetchProviders = async () => {
    try {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .order("name");

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error("Error fetching service providers:", error);
      toast.error("Failed to load service providers");
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = providers.filter((provider) => {
    const matchesSearch = provider.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType =
      filterType === "all" || provider.provider_type === filterType;
    return matchesSearch && matchesType;
  });

  const totalProviders = providers.length;
  const activeProviders = providers.filter(p => p.is_active).length;
  const inactiveProviders = providers.filter(p => !p.is_active).length;
  const totalLeads = Object.values(relatedLeadsCount).reduce((sum, count) => sum + count, 0);

  // Prepare chart data - Top 5 by related leads
  const topFiveByLeads = providers
    .map(provider => ({
      name: provider.name,
      leads: relatedLeadsCount[provider.id] || 0
    }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

  // Fastest closing times
  const topFiveBySpeed = providers
    .filter(p => p.average_closing_days !== null)
    .map(provider => ({
      name: provider.name,
      days: provider.average_closing_days
    }))
    .sort((a, b) => (a.days || 0) - (b.days || 0))
    .slice(0, 5);

  const getSpeedColor = (days: number | null) => {
    if (!days) return 'hsl(var(--chart-4))';
    if (days < 20) return 'hsl(var(--chart-1))';
    if (days < 30) return 'hsl(var(--chart-2))';
    if (days < 45) return 'hsl(var(--chart-3))';
    return 'hsl(var(--chart-4))';
  };

  const getProviderTypeColor = (type: string) => {
    switch (type) {
      case "title":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "escrow":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "both":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Title & Escrow Companies"
        subtitle="Manage your title and escrow service providers"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => navigate('/service-providers/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              New Title Company
            </Button>
          </div>
        }
      />
      
      <div className="p-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StandardKPICard title="Total Providers" value={totalProviders.toString()} />
          <StandardKPICard title="Active Providers" value={activeProviders.toString()} />
          <StandardKPICard title="Inactive Providers" value={inactiveProviders.toString()} />
          <StandardKPICard title="Related Leads" value={totalLeads.toString()} />
        </div>

        {/* Performance Charts */}
        {providers.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Providers by Related Leads */}
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Top 5 Providers by Activity</h3>
                  <p className="text-sm text-muted-foreground">Number of related leads</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topFiveByLeads} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="leads" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Fastest Closing Times */}
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Fastest Closing Times</h3>
                  <p className="text-sm text-muted-foreground">Average days to close per provider</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topFiveBySpeed} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" label={{ value: 'Days', position: 'insideBottom', offset: -5 }} />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip />
                    <Bar dataKey="days">
                      {topFiveBySpeed.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getSpeedColor(entry.days)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
        {/* Filters and Provider List */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search providers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterType === "all" ? "default" : "outline"}
                  onClick={() => setFilterType("all")}
                >
                  All
                </Button>
                <Button
                  variant={filterType === "title" ? "default" : "outline"}
                  onClick={() => setFilterType("title")}
                >
                  Title
                </Button>
                <Button
                  variant={filterType === "escrow" ? "default" : "outline"}
                  onClick={() => setFilterType("escrow")}
                >
                  Escrow
                </Button>
                <Button
                  variant={filterType === "both" ? "default" : "outline"}
                  onClick={() => setFilterType("both")}
                >
                  Both
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Providers Grid */}
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredProviders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No service providers found
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProviders.map((provider) => (
              <Card
                key={provider.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/service-providers/${provider.id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">
                        {provider.name}
                      </h3>
                      <Badge
                        className={getProviderTypeColor(provider.provider_type)}
                      >
                        {provider.provider_type === "both"
                          ? "Title & Escrow"
                          : provider.provider_type.charAt(0).toUpperCase() +
                            provider.provider_type.slice(1)}
                      </Badge>
                    </div>
                    {!provider.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  <div className="space-y-3">
                    {provider.contact_person && (
                      <div className="text-sm text-muted-foreground">
                        Contact: {provider.contact_person}
                      </div>
                    )}
                    {provider.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{provider.phone}</span>
                      </div>
                    )}
                    {provider.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{provider.email}</span>
                      </div>
                    )}
                    {(provider.city || provider.state) && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {provider.city}
                          {provider.city && provider.state && ", "}
                          {provider.state}
                        </span>
                      </div>
                    )}
                    {provider.average_closing_days !== null && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Avg Closing:</span>{" "}
                        <span className="font-medium">
                          {provider.average_closing_days} days
                        </span>
                      </div>
                    )}
                    {provider.success_rate !== null && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Success Rate:</span>{" "}
                        <span className="font-medium">
                          {provider.success_rate}%
                        </span>
                      </div>
                    )}
                    {relatedLeadsCount[provider.id] && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Related Leads:</span>{" "}
                        <span className="font-medium">
                          {relatedLeadsCount[provider.id]}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
