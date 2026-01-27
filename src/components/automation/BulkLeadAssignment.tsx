import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  UserPlus, 
  Filter, 
  CheckCircle2, 
  Loader2,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Lead {
  id: string;
  name: string;
  stage: string;
  requested_amount: number | null;
  loan_originator_id: string | null;
  processor_id: string | null;
}

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

export function BulkLeadAssignment() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState<string>('loan_originator');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();
  const { hasRole } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          loan_originator_id,
          processor_id,
          contact_entities!inner(name, stage, requested_amount)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (leadsError) throw leadsError;

      const formattedLeads: Lead[] = (leadsData || []).map(lead => ({
        id: lead.id,
        name: (lead.contact_entities as any)?.name || 'Unknown',
        stage: (lead.contact_entities as any)?.stage || 'New Lead',
        requested_amount: (lead.contact_entities as any)?.requested_amount || null,
        loan_originator_id: lead.loan_originator_id,
        processor_id: lead.processor_id
      }));

      setLeads(formattedLeads);

      // Fetch team members
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          user_roles!inner(role, is_active)
        `)
        .eq('user_roles.is_active', true);

      if (profilesError) throw profilesError;

      const members: TeamMember[] = (profiles || []).map(profile => ({
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        role: Array.isArray(profile.user_roles) ? profile.user_roles[0]?.role || 'loan_originator' : 'loan_originator'
      }));

      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load leads and team members",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleLead = (leadId: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const filteredLeads = getFilteredLeads();
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const getFilteredLeads = () => {
    if (filterStage === 'all') return leads;
    return leads.filter(lead => lead.stage === filterStage);
  };

  const getEligibleAssignees = () => {
    return teamMembers.filter(member => {
      switch (selectedRole) {
        case 'loan_originator':
          return ['loan_originator', 'manager', 'admin', 'super_admin'].includes(member.role);
        case 'loan_processor':
          return ['loan_processor', 'manager', 'admin', 'super_admin'].includes(member.role);
        case 'closer':
          return ['loan_originator', 'manager', 'admin', 'super_admin'].includes(member.role);
        case 'funder':
          return ['funder', 'manager', 'admin', 'super_admin'].includes(member.role);
        default:
          return true;
      }
    });
  };

  const assignLeads = async () => {
    if (selectedLeads.size === 0) {
      toast({
        title: "No Leads Selected",
        description: "Please select at least one lead to assign",
        variant: "destructive"
      });
      return;
    }

    if (!selectedAssignee) {
      toast({
        title: "No Assignee Selected",
        description: "Please select a team member to assign leads to",
        variant: "destructive"
      });
      return;
    }

    setAssigning(true);
    try {
      const updateField = getRoleFieldName(selectedRole);
      
      const { error } = await supabase
        .from('leads')
        .update({ [updateField]: selectedAssignee })
        .in('id', Array.from(selectedLeads));

      if (error) throw error;

      toast({
        title: "Leads Assigned",
        description: `${selectedLeads.size} leads have been assigned successfully`,
      });

      setSelectedLeads(new Set());
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error assigning leads:', error);
      toast({
        title: "Error",
        description: "Failed to assign leads",
        variant: "destructive"
      });
    } finally {
      setAssigning(false);
    }
  };

  const filteredLeads = getFilteredLeads();
  const eligibleAssignees = getEligibleAssignees();
  const stages = [...new Set(leads.map(l => l.stage))];

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return 'Unassigned';
    const member = teamMembers.find(m => m.id === memberId);
    return member ? `${member.first_name} ${member.last_name}` : 'Unknown';
  };

  const getRoleFieldName = (role: string): string => {
    if (role === 'loan_processor') return 'processor_id';
    return `${role}_id`;
  };

  if (!hasRole('manager') && !hasRole('admin') && !hasRole('super_admin')) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          You don't have permission to bulk assign leads.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Bulk Lead Assignment
            </CardTitle>
            <CardDescription>
              Assign multiple leads to team members at once
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Assignment Controls */}
        <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">Filter by Stage</label>
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger>
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stages.map(stage => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">Assignment Role</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loan_originator">Loan Originator</SelectItem>
                <SelectItem value="loan_processor">Loan Processor</SelectItem>
                <SelectItem value="closer">Closer</SelectItem>
                <SelectItem value="funder">Funder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1 block">Assign To</label>
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {eligibleAssignees.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.first_name} {member.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
              onCheckedChange={selectAll}
            />
            <span className="text-sm text-muted-foreground">
              {selectedLeads.size} of {filteredLeads.length} selected
            </span>
          </div>

          <Button 
            onClick={assignLeads}
            disabled={selectedLeads.size === 0 || !selectedAssignee || assigning}
          >
            {assigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1" />
                Assign {selectedLeads.size} Leads
              </>
            )}
          </Button>
        </div>

        {/* Leads List */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leads found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLeads.map((lead) => (
                <div 
                  key={lead.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedLeads.has(lead.id) 
                      ? 'bg-primary/10 border-primary' 
                      : 'bg-muted/30 border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleLead(lead.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={selectedLeads.has(lead.id)}
                      onCheckedChange={() => toggleLead(lead.id)}
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lead.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {lead.stage}
                        </Badge>
                        {lead.requested_amount && (
                          <Badge variant="secondary" className="text-xs">
                            {formatCurrency(lead.requested_amount)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Originator: {getMemberName(lead.loan_originator_id)}</span>
                        <span>Processor: {getMemberName(lead.processor_id)}</span>
                      </div>
                    </div>

                    {selectedLeads.has(lead.id) && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
