import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Filter, 
  Eye, 
  Phone, 
  Mail,
  Users,
  ArrowUpDown,
  DollarSign,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Lead {
  id: string;
  lead_id: string;
  name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  loan_type: string | null;
  loan_amount: number | null;
  stage: string;
  priority: string;
  created_at: string;
}

interface LeadStats {
  totalLeads: number;
  newLeads: number;
  highPriorityLeads: number;
  pipelineValue: number;
}

export const ActiveLeadsWidget = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats>({
    totalLeads: 0,
    newLeads: 0,
    highPriorityLeads: 0,
    pipelineValue: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [filterPriority, setFilterPriority] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch leads assigned to current user or unassigned
      let query = supabase
        .from('leads')
        .select(`
          id,
          contact_entity_id,
          user_id,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (showUnassignedOnly) {
        query = query.is('user_id', null);
      }

      const { data: leadsData, error: leadsError } = await query;
      if (leadsError) throw leadsError;

      if (!leadsData || leadsData.length === 0) {
        setLeads([]);
        setStats({
          totalLeads: 0,
          newLeads: 0,
          highPriorityLeads: 0,
          pipelineValue: 0
        });
        setLoading(false);
        return;
      }

      // Fetch contact entities
      const contactIds = leadsData.map(l => l.contact_entity_id).filter(Boolean);
      const { data: contacts, error: contactsError } = await supabase
        .from('contact_entities')
        .select('id, name, business_name, email, phone, loan_type, loan_amount, stage, priority')
        .in('id', contactIds as string[]);

      if (contactsError) throw contactsError;

      const contactsById = new Map((contacts || []).map(c => [c.id, c]));

      const formattedLeads = leadsData.map(lead => {
        const contact: any = contactsById.get(lead.contact_entity_id);
        if (!contact) return null;
        return {
          id: contact.id,
          lead_id: lead.id,
          name: contact.name,
          business_name: contact.business_name,
          email: contact.email,
          phone: contact.phone,
          loan_type: contact.loan_type,
          loan_amount: contact.loan_amount,
          stage: contact.stage || 'New Lead',
          priority: contact.priority || 'Medium',
          created_at: lead.created_at
        };
      }).filter(Boolean) as Lead[];

      setLeads(formattedLeads);

      // Calculate stats
      const newLeads = formattedLeads.filter(l => l.stage === 'New Lead' || l.stage === 'Initial Contact').length;
      const highPriorityLeads = formattedLeads.filter(l => l.priority?.toLowerCase() === 'high').length;
      const pipelineValue = formattedLeads.reduce((sum, l) => sum + (l.loan_amount || 0), 0);

      setStats({
        totalLeads: formattedLeads.length,
        newLeads,
        highPriorityLeads,
        pipelineValue
      });

    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [showUnassignedOnly]);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = searchTerm === '' ||
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.business_name && lead.business_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesPriority = filterPriority === 'all' || 
      lead.priority.toLowerCase() === filterPriority.toLowerCase();

    return matchesSearch && matchesPriority;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelection = new Set(selectedLeads);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      newSelection.add(leadId);
    }
    setSelectedLeads(newSelection);
  };

  return (
    <Card className="border-border bg-card relative z-10">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Active Leads</CardTitle>
          <Button 
            variant={showUnassignedOnly ? "default" : "outline"} 
            size="sm"
            onClick={() => setShowUnassignedOnly(!showUnassignedOnly)}
            className="h-8 text-xs"
          >
            <Users className="h-3.5 w-3.5 mr-2" />
            Unassigned Only
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Total Leads</p>
            <p className="text-2xl font-bold text-primary">{stats.totalLeads}</p>
          </div>
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">New Leads</p>
            <p className="text-2xl font-bold text-primary">{stats.newLeads}</p>
          </div>
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">High Priority Leads</p>
            <p className="text-2xl font-bold text-primary">{stats.highPriorityLeads}</p>
          </div>
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Pipeline Value</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(stats.pipelineValue)}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, email, or company..."
              className="pl-10 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="primary" size="sm" className="h-10 px-4">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Filter by Priority</h4>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Table Header */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted/30 border-b border-border px-4 py-3">
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1"></div>
              <div className="col-span-2 flex items-center gap-1">
                Lead Name <ArrowUpDown className="h-3 w-3" />
              </div>
              <div className="col-span-3">Contact Information</div>
              <div className="col-span-2 flex items-center gap-1">
                Loan Details <ArrowUpDown className="h-3 w-3" />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                Lead Status <ArrowUpDown className="h-3 w-3" />
              </div>
              <div className="col-span-1 flex items-center gap-1">
                Created <ArrowUpDown className="h-3 w-3" />
              </div>
              <div className="col-span-1"></div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-4">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1"><Skeleton className="h-4 w-4" /></div>
                    <div className="col-span-2"><Skeleton className="h-4 w-24" /></div>
                    <div className="col-span-3"><Skeleton className="h-4 w-32" /></div>
                    <div className="col-span-2"><Skeleton className="h-4 w-20" /></div>
                    <div className="col-span-2"><Skeleton className="h-4 w-24" /></div>
                    <div className="col-span-1"><Skeleton className="h-4 w-16" /></div>
                    <div className="col-span-1"><Skeleton className="h-8 w-16" /></div>
                  </div>
                </div>
              ))
            ) : filteredLeads.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                <p className="text-sm">No leads found</p>
              </div>
            ) : (
              filteredLeads.slice(0, 10).map((lead) => {
                const { date, time } = formatDate(lead.created_at);
                return (
                  <div key={lead.id} className="px-4 py-4 hover:bg-muted/30 transition-colors">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-1">
                        <Checkbox
                          checked={selectedLeads.has(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                        />
                      </div>
                      <div className="col-span-2">
                        <p className="font-medium text-sm text-foreground">{lead.name}</p>
                        {lead.business_name && (
                          <p className="text-xs text-primary">{lead.business_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Loan ID: {lead.lead_id.slice(0, 8)}</p>
                      </div>
                      <div className="col-span-3 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5 text-primary" />
                          <span>{lead.phone || 'No phone'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        {lead.loan_type && (
                          <div className="flex items-center gap-1 text-sm mb-1">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{lead.loan_type}</span>
                          </div>
                        )}
                        {lead.loan_amount && (
                          <div className="flex items-center gap-1 text-sm">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{formatCurrency(lead.loan_amount)}</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <Badge variant="secondary" className="mb-1">
                          {lead.stage}
                        </Badge>
                        <div className={`text-xs flex items-center gap-1 ${getPriorityColor(lead.priority)}`}>
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
                          {lead.priority}
                        </div>
                      </div>
                      <div className="col-span-1 text-xs text-muted-foreground">
                        <p>{date}</p>
                        <p>{time}</p>
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => navigate(`/leads/${lead.lead_id}`)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {filteredLeads.length > 10 && (
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => navigate('/leads')}>
              View All {filteredLeads.length} Leads
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
