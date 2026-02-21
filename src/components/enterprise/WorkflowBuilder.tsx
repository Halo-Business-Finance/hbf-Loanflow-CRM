import { useState, useEffect } from "react";
import { ibmDb } from "@/lib/ibm";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Play, Pause, Edit, Trash2, Workflow, Zap } from "lucide-react";

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  object_type: string;
  trigger_type: string;
  trigger_conditions: any;
  flow_definition: any;
  is_active: boolean;
  created_at: string;
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  record_id: string;
  status: string;
  execution_data: any;
  error_message: string;
  started_at: string;
  completed_at: string;
}

export function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowData | null>(null);
  const { toast } = useToast();

  const [workflowForm, setWorkflowForm] = useState({
    name: "",
    description: "",
    object_type: "leads",
    trigger_type: "created",
    trigger_conditions: "{}",
    flow_definition: JSON.stringify({
      steps: [
        {
          id: "1",
          type: "send_email",
          title: "Send Welcome Email",
          config: {
            to: "{{ record.email }}",
            subject: "Welcome!",
            template: "welcome_template"
          }
        }
      ]
    }, null, 2)
  });

  const objectTypes = [
    { value: "leads", label: "Leads" },
    { value: "clients", label: "Clients" },
    { value: "opportunities", label: "Opportunities" },
    { value: "custom_records", label: "Custom Records" }
  ];

  const triggerTypes = [
    { value: "created", label: "Record Created" },
    { value: "updated", label: "Record Updated" },
    { value: "deleted", label: "Record Deleted" },
    { value: "manual", label: "Manual Trigger" }
  ];

  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (selectedWorkflow) {
      fetchExecutions(selectedWorkflow);
    }
  }, [selectedWorkflow]);

  const fetchWorkflows = async () => {
    try {
      const { data, error } = await ibmDb
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflows((data as unknown as WorkflowData[]) || []);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast({
        title: "Error",
        description: "Failed to fetch workflows",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async (workflowId: string) => {
    try {
      const { data, error } = await ibmDb
        .from('workflow_executions')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setExecutions((data as unknown as WorkflowExecution[]) || []);
    } catch (error) {
      console.error('Error fetching executions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch workflow executions",
        variant: "destructive"
      });
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      let triggerConditions;
      let flowDefinition;
      
      try {
        triggerConditions = JSON.parse(workflowForm.trigger_conditions);
        flowDefinition = JSON.parse(workflowForm.flow_definition);
      } catch (e) {
        throw new Error('Invalid JSON in trigger conditions or flow definition');
      }

      const { error } = await ibmDb
        .from('workflows')
        .insert({
          name: workflowForm.name,
          description: workflowForm.description,
          object_type: workflowForm.object_type,
          trigger_type: workflowForm.trigger_type,
          trigger_conditions: triggerConditions,
          flow_definition: flowDefinition,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Workflow created successfully"
      });

      setShowWorkflowDialog(false);
      resetForm();
      fetchWorkflows();
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create workflow",
        variant: "destructive"
      });
    }
  };

  const toggleWorkflowStatus = async (workflowId: string, isActive: boolean) => {
    try {
      const { error } = await ibmDb
        .from('workflows')
        .update({ is_active: !isActive })
        .eq('id', workflowId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Workflow ${!isActive ? 'activated' : 'deactivated'} successfully`
      });

      fetchWorkflows();
    } catch (error) {
      console.error('Error updating workflow:', error);
      toast({
        title: "Error",
        description: "Failed to update workflow status",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setWorkflowForm({
      name: "",
      description: "",
      object_type: "leads",
      trigger_type: "created",
      trigger_conditions: "{}",
      flow_definition: JSON.stringify({
        steps: [
          {
            id: "1",
            type: "send_email",
            title: "Send Welcome Email",
            config: {
              to: "{{ record.email }}",
              subject: "Welcome!",
              template: "welcome_template"
            }
          }
        ]
      }, null, 2)
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      running: "default",
      completed: "outline",
      failed: "destructive"
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
          <h2 className="text-2xl font-bold">Workflow Builder</h2>
          <p className="text-muted-foreground">
            Create visual process automation with conditional logic
          </p>
        </div>
        <Dialog open={showWorkflowDialog} onOpenChange={setShowWorkflowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create Workflow</DialogTitle>
              <DialogDescription>
                Define a new automated workflow for your CRM processes
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="workflow-name">Workflow Name</Label>
                  <Input
                    id="workflow-name"
                    value={workflowForm.name}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                    placeholder="e.g., Lead Nurture Campaign"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={workflowForm.description}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                    placeholder="Describe what this workflow does..."
                  />
                </div>
                <div>
                  <Label htmlFor="object-type">Object Type</Label>
                  <Select
                    value={workflowForm.object_type}
                    onValueChange={(value) => setWorkflowForm({ ...workflowForm, object_type: value })}
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
                  <Label htmlFor="trigger-type">Trigger</Label>
                  <Select
                    value={workflowForm.trigger_type}
                    onValueChange={(value) => setWorkflowForm({ ...workflowForm, trigger_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="trigger-conditions">Trigger Conditions (JSON)</Label>
                  <Textarea
                    id="trigger-conditions"
                    value={workflowForm.trigger_conditions}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, trigger_conditions: e.target.value })}
                    placeholder='{"field": "status", "operator": "equals", "value": "new"}'
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="flow-definition">Flow Definition (JSON)</Label>
                  <Textarea
                    id="flow-definition"
                    value={workflowForm.flow_definition}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, flow_definition: e.target.value })}
                    className="font-mono text-sm min-h-[300px]"
                  />
                </div>
                <Button onClick={handleCreateWorkflow} className="w-full">
                  Create Workflow
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflows List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Workflows
            </CardTitle>
            <CardDescription>
              Manage your automated workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedWorkflow === workflow.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedWorkflow(workflow.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{workflow.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {objectTypes.find(t => t.value === workflow.object_type)?.label} • {' '}
                        {triggerTypes.find(t => t.value === workflow.trigger_type)?.label}
                      </p>
                      {workflow.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={workflow.is_active}
                        onCheckedChange={() => toggleWorkflowStatus(workflow.id, workflow.is_active)}
                      />
                      <Badge variant={workflow.is_active ? "default" : "secondary"}>
                        {workflow.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Workflow Executions */}
        <Card>
          <CardHeader>
            <CardTitle>
              Recent Executions
            </CardTitle>
            <CardDescription>
              {selectedWorkflow 
                ? `Execution history for ${workflows.find(w => w.id === selectedWorkflow)?.name}`
                : "Select a workflow to view execution history"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedWorkflow ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Record ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell className="font-mono text-sm">
                        {execution.record_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(execution.status)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(execution.started_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {execution.completed_at 
                          ? new Date(execution.completed_at).toLocaleString()
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Select a workflow to view its execution history
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}