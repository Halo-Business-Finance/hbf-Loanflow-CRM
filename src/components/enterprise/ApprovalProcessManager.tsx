import { useState, useEffect } from "react";
import { ibmDb } from "@/lib/ibm";
const supabase = ibmDb; // IBM migration shim
import { getAuthUser } from '@/lib/auth-utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle, XCircle, Clock, User } from "lucide-react";

interface ApprovalProcess {
  id: string;
  name: string;
  object_type: string;
  entry_criteria: any;
  approval_steps: any;
  final_approval_actions: any;
  final_rejection_actions: any;
  is_active: boolean;
  created_at: string;
}

interface ApprovalRequest {
  id: string;
  process_id: string;
  record_id: string;
  record_type: string;
  status: string;
  current_step: number;
  submitted_by: string;
  submitted_at: string;
  completed_at: string;
  comments: string;
}

export function ApprovalProcessManager() {
  const [processes, setProcesses] = useState<ApprovalProcess[]>([]);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const { toast } = useToast();

  const [processForm, setProcessForm] = useState({
    name: "",
    object_type: "opportunities",
    entry_criteria: JSON.stringify({
      conditions: [
        {
          field: "amount",
          operator: "greater_than",
          value: 100000
        }
      ]
    }, null, 2),
    approval_steps: JSON.stringify([
      {
        step: 1,
        name: "Manager Approval",
        approver_role: "manager",
        required: true
      },
      {
        step: 2,
        name: "Director Approval",
        approver_role: "director",
        required: true
      }
    ], null, 2),
    final_approval_actions: JSON.stringify({
      actions: [
        {
          type: "update_field",
          field: "status",
          value: "approved"
        },
        {
          type: "send_notification",
          recipients: ["submitter", "managers"],
          template: "approval_notification"
        }
      ]
    }, null, 2),
    final_rejection_actions: JSON.stringify({
      actions: [
        {
          type: "update_field",
          field: "status",
          value: "rejected"
        },
        {
          type: "send_notification",
          recipients: ["submitter"],
          template: "rejection_notification"
        }
      ]
    }, null, 2)
  });

  const objectTypes = [
    { value: "opportunities", label: "Opportunities" },
    { value: "leads", label: "Leads" },
    { value: "clients", label: "Clients" },
    { value: "loans", label: "Loans" },
    { value: "custom_records", label: "Custom Records" }
  ];

  useEffect(() => {
    fetchProcesses();
    fetchRequests();
  }, []);

  const fetchProcesses = async () => {
    try {
      const { data, error } = await supabase
        .from('approval_processes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProcesses(data || []);
    } catch (error) {
      console.error('Error fetching processes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch approval processes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast({
        title: "Error",
        description: "Failed to fetch approval requests",
        variant: "destructive"
      });
    }
  };

  const handleCreateProcess = async () => {
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      let entryCriteria, approvalSteps, finalApprovalActions, finalRejectionActions;
      
      try {
        entryCriteria = JSON.parse(processForm.entry_criteria);
        approvalSteps = JSON.parse(processForm.approval_steps);
        finalApprovalActions = JSON.parse(processForm.final_approval_actions);
        finalRejectionActions = JSON.parse(processForm.final_rejection_actions);
      } catch (e) {
        throw new Error('Invalid JSON in one or more fields');
      }

      const { error } = await supabase
        .from('approval_processes')
        .insert({
          name: processForm.name,
          object_type: processForm.object_type,
          entry_criteria: entryCriteria,
          approval_steps: approvalSteps,
          final_approval_actions: finalApprovalActions,
          final_rejection_actions: finalRejectionActions,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Approval process created successfully"
      });

      setShowProcessDialog(false);
      resetForm();
      fetchProcesses();
    } catch (error) {
      console.error('Error creating process:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create approval process",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setProcessForm({
      name: "",
      object_type: "opportunities",
      entry_criteria: JSON.stringify({
        conditions: [
          {
            field: "amount",
            operator: "greater_than",
            value: 100000
          }
        ]
      }, null, 2),
      approval_steps: JSON.stringify([
        {
          step: 1,
          name: "Manager Approval",
          approver_role: "manager",
          required: true
        },
        {
          step: 2,
          name: "Director Approval",
          approver_role: "director",
          required: true
        }
      ], null, 2),
      final_approval_actions: JSON.stringify({
        actions: [
          {
            type: "update_field",
            field: "status",
            value: "approved"
          }
        ]
      }, null, 2),
      final_rejection_actions: JSON.stringify({
        actions: [
          {
            type: "update_field",
            field: "status",
            value: "rejected"
          }
        ]
      }, null, 2)
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "outline",
      rejected: "destructive",
      recalled: "secondary"
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Approval Processes</h2>
          <p className="text-muted-foreground">
            Create multi-step approval workflows for deals, pricing, and more
          </p>
        </div>
        <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Process
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Approval Process</DialogTitle>
              <DialogDescription>
                Define a new approval workflow with multiple steps
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="process-name">Process Name</Label>
                  <Input
                    id="process-name"
                    value={processForm.name}
                    onChange={(e) => setProcessForm({ ...processForm, name: e.target.value })}
                    placeholder="e.g., Large Deal Approval"
                  />
                </div>
                <div>
                  <Label htmlFor="object-type">Object Type</Label>
                  <Select
                    value={processForm.object_type}
                    onValueChange={(value) => setProcessForm({ ...processForm, object_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {objectTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="entry-criteria">Entry Criteria (JSON)</Label>
                  <Textarea
                    id="entry-criteria"
                    value={processForm.entry_criteria}
                    onChange={(e) => setProcessForm({ ...processForm, entry_criteria: e.target.value })}
                    className="font-mono text-sm min-h-[120px]"
                  />
                </div>
                <div>
                  <Label htmlFor="approval-steps">Approval Steps (JSON)</Label>
                  <Textarea
                    id="approval-steps"
                    value={processForm.approval_steps}
                    onChange={(e) => setProcessForm({ ...processForm, approval_steps: e.target.value })}
                    className="font-mono text-sm min-h-[120px]"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="approval-actions">Final Approval Actions (JSON)</Label>
                  <Textarea
                    id="approval-actions"
                    value={processForm.final_approval_actions}
                    onChange={(e) => setProcessForm({ ...processForm, final_approval_actions: e.target.value })}
                    className="font-mono text-sm min-h-[150px]"
                  />
                </div>
                <div>
                  <Label htmlFor="rejection-actions">Final Rejection Actions (JSON)</Label>
                  <Textarea
                    id="rejection-actions"
                    value={processForm.final_rejection_actions}
                    onChange={(e) => setProcessForm({ ...processForm, final_rejection_actions: e.target.value })}
                    className="font-mono text-sm min-h-[150px]"
                  />
                </div>
                <Button onClick={handleCreateProcess} className="w-full">
                  Create Approval Process
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approval Processes */}
        <Card>
          <CardHeader>
            <CardTitle>
              Approval Processes
            </CardTitle>
            <CardDescription>
              Manage your approval workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processes.map((process) => (
                <div
                  key={process.id}
                  className="p-3 border rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{process.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {objectTypes.find(t => t.value === process.object_type)?.label}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {Array.isArray(process.approval_steps) 
                            ? `${process.approval_steps.length} steps`
                            : 'Custom steps'
                          }
                        </Badge>
                        <Badge variant={process.is_active ? "default" : "secondary"}>
                          {process.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Approval Requests */}
        <Card>
          <CardHeader>
            <CardTitle>
              Recent Requests
            </CardTitle>
            <CardDescription>
              Latest approval requests across all processes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-mono text-sm">
                      {request.record_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(request.status)}
                        {getStatusBadge(request.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        Step {request.current_step}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(request.submitted_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}