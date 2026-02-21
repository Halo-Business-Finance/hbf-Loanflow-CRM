import { useState, useEffect } from "react";
import { ibmDb } from "@/lib/ibm";
import { getAuthUser } from '@/lib/auth-utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Target, Users, DollarSign, TrendingUp } from "lucide-react";

interface Opportunity {
  id: string;
  name: string;
  amount: number;
  close_date: string;
  stage: string;
  probability: number;
  lead_id: string;
  client_id: string;
  primary_owner_id: string;
  created_at: string;
}

interface OpportunitySplit {
  id: string;
  opportunity_id: string;
  user_id: string;
  split_type: string;
  percentage: number;
  amount: number;
  role: string;
  created_at: string;
}

export function OpportunityManager() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [splits, setSplits] = useState<OpportunitySplit[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOpportunityDialog, setShowOpportunityDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const { toast } = useToast();

  const [opportunityForm, setOpportunityForm] = useState({
    name: "",
    amount: "",
    close_date: "",
    stage: "prospecting",
    probability: "10",
    lead_id: "",
    client_id: ""
  });

  const [splitForm, setSplitForm] = useState({
    user_id: "",
    split_type: "revenue",
    percentage: "",
    role: ""
  });

  const stages = [
    { value: "prospecting", label: "Prospecting", probability: 10 },
    { value: "qualification", label: "Qualification", probability: 25 },
    { value: "needs_analysis", label: "Needs Analysis", probability: 50 },
    { value: "proposal", label: "Proposal", probability: 75 },
    { value: "negotiation", label: "Negotiation", probability: 90 },
    { value: "closed_won", label: "Closed Won", probability: 100 },
    { value: "closed_lost", label: "Closed Lost", probability: 0 }
  ];

  const splitTypes = [
    { value: "revenue", label: "Revenue Split" },
    { value: "overlay", label: "Overlay" },
    { value: "split_credit", label: "Split Credit" }
  ];

  useEffect(() => {
    fetchOpportunities();
  }, []);

  useEffect(() => {
    if (selectedOpportunity) {
      fetchSplits(selectedOpportunity);
    }
  }, [selectedOpportunity]);

  const fetchOpportunities = async () => {
    try {
      const { data, error } = await ibmDb
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOpportunities((data as unknown as Opportunity[]) || []);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      toast({
        title: "Error",
        description: "Failed to fetch opportunities",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSplits = async (opportunityId: string) => {
    try {
      const { data, error } = await ibmDb
        .from('opportunity_splits')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSplits((data as unknown as OpportunitySplit[]) || []);
    } catch (error) {
      console.error('Error fetching splits:', error);
      toast({
        title: "Error",
        description: "Failed to fetch opportunity splits",
        variant: "destructive"
      });
    }
  };

  const handleCreateOpportunity = async () => {
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await ibmDb
        .from('opportunities')
        .insert({
          name: opportunityForm.name,
          amount: parseFloat(opportunityForm.amount),
          close_date: opportunityForm.close_date,
          stage: opportunityForm.stage,
          probability: parseInt(opportunityForm.probability),
          lead_id: opportunityForm.lead_id || null,
          client_id: opportunityForm.client_id || null,
          primary_owner_id: user.id,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Opportunity created successfully"
      });

      setShowOpportunityDialog(false);
      resetOpportunityForm();
      fetchOpportunities();
    } catch (error) {
      console.error('Error creating opportunity:', error);
      toast({
        title: "Error",
        description: "Failed to create opportunity",
        variant: "destructive"
      });
    }
  };

  const handleCreateSplit = async () => {
    if (!selectedOpportunity) return;

    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      const opportunity = opportunities.find(o => o.id === selectedOpportunity);
      if (!opportunity) throw new Error('Opportunity not found');

      const splitAmount = (opportunity.amount * parseFloat(splitForm.percentage)) / 100;

      const { error } = await ibmDb
        .from('opportunity_splits')
        .insert({
          opportunity_id: selectedOpportunity,
          user_id: splitForm.user_id,
          split_type: splitForm.split_type,
          percentage: parseFloat(splitForm.percentage),
          amount: splitAmount,
          role: splitForm.role,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Opportunity split created successfully"
      });

      setShowSplitDialog(false);
      resetSplitForm();
      fetchSplits(selectedOpportunity);
    } catch (error) {
      console.error('Error creating split:', error);
      toast({
        title: "Error",
        description: "Failed to create opportunity split",
        variant: "destructive"
      });
    }
  };

  const resetOpportunityForm = () => {
    setOpportunityForm({
      name: "",
      amount: "",
      close_date: "",
      stage: "prospecting",
      probability: "10",
      lead_id: "",
      client_id: ""
    });
  };

  const resetSplitForm = () => {
    setSplitForm({
      user_id: "",
      split_type: "revenue",
      percentage: "",
      role: ""
    });
  };

  const getStageBadge = (stage: string) => {
    const stageInfo = stages.find(s => s.value === stage);
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      prospecting: "secondary",
      qualification: "secondary",
      needs_analysis: "default",
      proposal: "default",
      negotiation: "outline",
      closed_won: "outline",
      closed_lost: "destructive"
    };
    return (
      <Badge variant={variants[stage] || "secondary"}>
        {stageInfo?.label || stage}
      </Badge>
    );
  };

  const calculateTotalRevenue = () => {
    return opportunities.reduce((total, opp) => total + opp.amount, 0);
  };

  const calculateWeightedPipeline = () => {
    return opportunities.reduce((total, opp) => {
      const weightedValue = (opp.amount * opp.probability) / 100;
      return total + weightedValue;
    }, 0);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Opportunity Management</h2>
          <p className="text-muted-foreground">
            Manage opportunities and revenue sharing across team members
          </p>
        </div>
        <Dialog open={showOpportunityDialog} onOpenChange={setShowOpportunityDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Opportunity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Opportunity</DialogTitle>
              <DialogDescription>
                Add a new sales opportunity to track
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="opp-name">Opportunity Name</Label>
                <Input
                  id="opp-name"
                  value={opportunityForm.name}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, name: e.target.value })}
                  placeholder="e.g., Acme Corp - CRM Implementation"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={opportunityForm.amount}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, amount: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="close-date">Close Date</Label>
                  <Input
                    id="close-date"
                    type="date"
                    value={opportunityForm.close_date}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, close_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stage">Loan Stage</Label>
                  <Select
                    value={opportunityForm.stage}
                    onValueChange={(value) => {
                      const stage = stages.find(s => s.value === value);
                      setOpportunityForm({ 
                        ...opportunityForm, 
                        stage: value,
                        probability: stage?.probability.toString() || "10"
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label} ({stage.probability}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="probability">Probability (%)</Label>
                  <Input
                    id="probability"
                    type="number"
                    min="0"
                    max="100"
                    value={opportunityForm.probability}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, probability: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleCreateOpportunity} className="w-full">
                Create Opportunity
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Opportunities</CardDescription>
            <CardTitle className="text-2xl">{opportunities.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Active deals
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Pipeline Value</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(calculateTotalRevenue())}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Gross revenue
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Weighted Pipeline</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(calculateWeightedPipeline())}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Probability adjusted
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Deal Size</CardDescription>
            <CardTitle className="text-2xl">
              {opportunities.length > 0 
                ? formatCurrency(calculateTotalRevenue() / opportunities.length)
                : formatCurrency(0)
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              Per opportunity
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Opportunities List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Opportunities
            </CardTitle>
            <CardDescription>
              Manage your sales opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {opportunities.map((opportunity) => (
                <div
                  key={opportunity.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedOpportunity === opportunity.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedOpportunity(opportunity.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{opportunity.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-medium">
                          {formatCurrency(opportunity.amount)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {opportunity.probability}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Close: {new Date(opportunity.close_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStageBadge(opportunity.stage)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Opportunity Splits */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  Revenue Splits
                </CardTitle>
                <CardDescription>
                  {selectedOpportunity 
                    ? `Revenue sharing for ${opportunities.find(o => o.id === selectedOpportunity)?.name}`
                    : "Select an opportunity to manage splits"
                  }
                </CardDescription>
              </div>
              {selectedOpportunity && (
                <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Split
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Revenue Split</DialogTitle>
                      <DialogDescription>
                        Define how revenue will be shared for this opportunity
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="split-user-id">User ID</Label>
                        <Input
                          id="split-user-id"
                          value={splitForm.user_id}
                          onChange={(e) => setSplitForm({ ...splitForm, user_id: e.target.value })}
                          placeholder="Enter user ID"
                        />
                      </div>
                      <div>
                        <Label htmlFor="split-type">Split Type</Label>
                        <Select
                          value={splitForm.split_type}
                          onValueChange={(value) => setSplitForm({ ...splitForm, split_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {splitTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="percentage">Percentage</Label>
                          <Input
                            id="percentage"
                            type="number"
                            min="0"
                            max="100"
                            value={splitForm.percentage}
                            onChange={(e) => setSplitForm({ ...splitForm, percentage: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor="role">Role</Label>
                          <Input
                            id="role"
                            value={splitForm.role}
                            onChange={(e) => setSplitForm({ ...splitForm, role: e.target.value })}
                            placeholder="e.g., Sales Rep, Manager"
                          />
                        </div>
                      </div>
                      <Button onClick={handleCreateSplit} className="w-full">
                        Add Split
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedOpportunity ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Share</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {splits.map((split) => (
                    <TableRow key={split.id}>
                      <TableCell className="font-mono text-sm">
                        {split.user_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {splitTypes.find(t => t.value === split.split_type)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{split.percentage}%</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(split.amount)}
                      </TableCell>
                      <TableCell>{split.role || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Select an opportunity to view and manage revenue splits
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}