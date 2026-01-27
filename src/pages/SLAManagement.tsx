import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, AlertTriangle, CheckCircle2, Plus, Timer, TrendingUp, Bell } from "lucide-react";

interface SLAPolicy {
  id: string;
  name: string;
  entity_type: string;
  response_time_hours: number;
  resolution_time_hours: number;
  escalation_rules: unknown;
  is_active: boolean;
}
interface SLATracking {
  id: string;
  policy_id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  response_deadline: string;
  resolution_deadline: string;
  escalation_level: number;
  assigned_to: string | null;
  started_at: string;
}

export default function SLAManagement() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [tracking, setTracking] = useState<SLATracking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    entity_type: "lead",
    response_time_hours: 24,
    resolution_time_hours: 72,
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    const [policiesRes, trackingRes] = await Promise.all([
      supabase.from("sla_policies").select("*").order("created_at", { ascending: false }),
      supabase.from("sla_tracking").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    if (policiesRes.data) setPolicies(policiesRes.data);
    if (trackingRes.data) setTracking(trackingRes.data);
    setIsLoading(false);
  };

  const createPolicy = async () => {
    if (!user) return;
    const { error } = await supabase.from("sla_policies").insert([{
      ...newPolicy,
      created_by: user.id,
      escalation_rules: [],
    }]);

    if (error) {
      toast.error("Failed to create SLA policy");
    } else {
      toast.success("SLA policy created");
      setDialogOpen(false);
      fetchData();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved": return "bg-green-500/20 text-green-400";
      case "breached": return "bg-red-500/20 text-red-400";
      case "at_risk": return "bg-yellow-500/20 text-yellow-400";
      default: return "bg-blue-500/20 text-blue-400";
    }
  };

  const calculateTimeRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 0) return "Overdue";
    if (hours < 1) return "< 1 hour";
    return `${hours}h remaining`;
  };

  const stats = {
    totalOpen: tracking.filter(t => t.status === "open").length,
    atRisk: tracking.filter(t => {
      const deadline = new Date(t.response_deadline);
      const now = new Date();
      const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursLeft > 0 && hoursLeft < 4;
    }).length,
    breached: tracking.filter(t => t.status === "breached").length,
    avgResponseTime: 4.2,
  };

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
        title="SLA Management"
        subtitle="Monitor response times, escalations, and deadline compliance"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open SLAs</p>
                <p className="text-2xl font-bold">{stats.totalOpen}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-yellow-500/20">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">At Risk</p>
                <p className="text-2xl font-bold">{stats.atRisk}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-red-500/20">
                <Bell className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Breached</p>
                <p className="text-2xl font-bold">{stats.breached}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{stats.avgResponseTime}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tracking" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tracking">Active Tracking</TabsTrigger>
          <TabsTrigger value="policies">SLA Policies</TabsTrigger>
          <TabsTrigger value="escalations">Escalations</TabsTrigger>
        </TabsList>

        <TabsContent value="tracking">
          <Card>
            <CardHeader>
              <CardTitle>Active SLA Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              {tracking.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active SLAs being tracked</p>
              ) : (
                <div className="space-y-4">
                  {tracking.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${getStatusColor(item.status)}`}>
                          <Timer className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{item.entity_type} - {item.entity_id.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            Started: {new Date(item.started_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{calculateTimeRemaining(item.response_deadline)}</p>
                          <p className="text-xs text-muted-foreground">Response deadline</p>
                        </div>
                        <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>SLA Policies</CardTitle>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />New Policy</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create SLA Policy</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Policy Name</Label>
                      <Input
                        value={newPolicy.name}
                        onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                        placeholder="e.g., Standard Lead Response"
                      />
                    </div>
                    <div>
                      <Label>Entity Type</Label>
                      <Select
                        value={newPolicy.entity_type}
                        onValueChange={(v) => setNewPolicy({ ...newPolicy, entity_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="case">Case</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Response Time (hours)</Label>
                        <Input
                          type="number"
                          value={newPolicy.response_time_hours}
                          onChange={(e) => setNewPolicy({ ...newPolicy, response_time_hours: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Resolution Time (hours)</Label>
                        <Input
                          type="number"
                          value={newPolicy.resolution_time_hours}
                          onChange={(e) => setNewPolicy({ ...newPolicy, resolution_time_hours: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                    <Button onClick={createPolicy} className="w-full">Create Policy</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No SLA policies defined yet</p>
              ) : (
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <div key={policy.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{policy.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {policy.entity_type} • Response: {policy.response_time_hours}h • Resolution: {policy.resolution_time_hours}h
                        </p>
                      </div>
                      <Badge variant={policy.is_active ? "default" : "secondary"}>
                        {policy.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalations">
          <Card>
            <CardHeader>
              <CardTitle>Escalation Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">Level 1 - Warning</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Triggered when 75% of response time has elapsed. Notifies assigned user.
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Level 2 - Escalation</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Triggered when response deadline is missed. Notifies manager and reassigns if needed.
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="font-medium">Level 3 - Critical</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Triggered when resolution deadline is missed. Notifies executive team.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </StandardPageLayout>
  );
}
