import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Zap, 
  Settings, 
  Play, 
  Pause, 
  Plus,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Activity,
  BarChart3,
  Filter,
  Search,
  Calendar,
  Mail,
  Phone,
  FileText,
  Database,
  Bot,
  ArrowRight,
  Copy,
  Eye
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'lead_created' | 'stage_changed' | 'document_uploaded' | 'time_based' | 'email_received';
    conditions: Record<string, any>;
  };
  actions: Array<{
    type: 'send_email' | 'create_task' | 'update_field' | 'notify_user' | 'schedule_call';
    config: Record<string, any>;
  }>;
  isActive: boolean;
  created: string;
  lastRun?: string;
  totalRuns: number;
  successRate: number;
}

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'lead_management' | 'follow_up' | 'documentation' | 'notifications';
  popularity: number;
  estimatedTime: string;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startTime: string;
  endTime?: string;
  triggerData: Record<string, any>;
  result?: string;
}

export function WorkflowAutomation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<WorkflowRule[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const automationTemplates: AutomationTemplate[] = [
    {
      id: '1',
      name: 'New Lead Welcome Sequence',
      description: 'Automatically send welcome email and schedule follow-up when new lead is created',
      category: 'lead_management',
      popularity: 95,
      estimatedTime: '2 mins'
    },
    {
      id: '2',
      name: 'Document Upload Notifications',
      description: 'Notify team members when important documents are uploaded',
      category: 'documentation',
      popularity: 87,
      estimatedTime: '1 min'
    },
    {
      id: '3',
      name: 'Stage Progression Alerts',
      description: 'Send alerts when leads move through pipeline stages',
      category: 'notifications',
      popularity: 92,
      estimatedTime: '3 mins'
    },
    {
      id: '4',
      name: 'Follow-up Reminders',
      description: 'Automatically create follow-up tasks based on lead activity',
      category: 'follow_up',
      popularity: 89,
      estimatedTime: '5 mins'
    }
  ];

  // Fetch workflow data from database
  useEffect(() => {
    const fetchWorkflows = async () => {
      setLoading(true);
      try {
        // TODO: Fetch real workflow data from database
        // For now, show empty state
        setWorkflows([]);
        setExecutions([]);
      } catch (error) {
        console.error('Error fetching workflows:', error);
        toast({
          title: "Error",
          description: "Failed to load workflows",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkflows();
  }, [toast]);

  const handleCreateWorkflow = () => {
    setIsCreating(true);
    // This would open a workflow builder dialog
    toast({
      title: "Workflow Builder",
      description: "Opening workflow creation interface...",
    });
  };

  const handleToggleWorkflow = (workflowId: string) => {
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId ? { ...w, isActive: !w.isActive } : w
    ));
    
    const workflow = workflows.find(w => w.id === workflowId);
    toast({
      title: workflow?.isActive ? "Workflow Paused" : "Workflow Activated",
      description: `${workflow?.name} is now ${workflow?.isActive ? 'paused' : 'active'}`,
    });
  };

  const handleRunWorkflow = (workflowId: string) => {
    const workflow = workflows.find(w => w.id === workflowId);
    toast({
      title: "Workflow Triggered",
      description: `${workflow?.name} is now running...`,
    });
  };

  const getStatusColor = (status: WorkflowExecution['status']) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryIcon = (category: AutomationTemplate['category']) => {
    switch (category) {
      case 'lead_management': return Database;
      case 'follow_up': return Clock;
      case 'documentation': return FileText;
      case 'notifications': return Mail;
      default: return Bot;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading workflow automation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflow Automation</h2>
          <p className="text-muted-foreground">Automate repetitive tasks and streamline operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <Button onClick={handleCreateWorkflow}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      </div>

      <Tabs defaultValue="workflows" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workflows">Active Workflows</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="executions">Execution History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map(workflow => (
              <Card key={workflow.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{workflow.description}</p>
                    </div>
                    <Switch
                      checked={workflow.isActive}
                      onCheckedChange={() => handleToggleWorkflow(workflow.id)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Success Rate</span>
                      <span className="font-medium">{workflow.successRate}%</span>
                    </div>
                    <Progress value={workflow.successRate} className="h-2" />
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Runs</span>
                        <p className="font-medium">{workflow.totalRuns}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Run</span>
                        <p className="font-medium">
                          {workflow.lastRun ? formatDistanceToNow(new Date(workflow.lastRun), { addSuffix: true }) : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleRunWorkflow(workflow.id)}>
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedWorkflow(workflow)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${workflow.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {automationTemplates.map(template => {
              const CategoryIcon = getCategoryIcon(template.category);
              return (
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <CategoryIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{template.estimatedTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <span>{template.popularity}% popular</span>
                        </div>
                      </div>
                      <Badge variant="outline">{template.category.replace('_', ' ')}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1">
                        Use Template
                      </Button>
                      <Button variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="executions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Executions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {executions.map(execution => (
                    <div key={execution.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(execution.status)}`}></div>
                        <div>
                          <h4 className="font-medium">{execution.workflowName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(execution.startTime), { addSuffix: true })}
                          </p>
                          {execution.result && (
                            <p className="text-xs text-muted-foreground mt-1">{execution.result}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          execution.status === 'completed' ? 'default' :
                          execution.status === 'running' ? 'secondary' :
                          execution.status === 'failed' ? 'destructive' : 'outline'
                        }>
                          {execution.status}
                        </Badge>
                        {execution.endTime && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Duration: {Math.round((new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime()) / 1000)}s
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Automations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{workflows.length}</div>
                <p className="text-sm text-muted-foreground">Active workflows</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">—</div>
                <p className="text-sm text-muted-foreground">No workflow data yet</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Time Saved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">—</div>
                <p className="text-sm text-muted-foreground">Not tracked</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Workflow Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflows.map(workflow => (
                  <div key={workflow.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <h4 className="font-medium">{workflow.name}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{workflow.totalRuns} runs</span>
                        <span>{workflow.successRate}% success</span>
                      </div>
                    </div>
                    <Progress value={workflow.successRate} className="w-24 h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Workflow Details Dialog */}
      {selectedWorkflow && (
        <Dialog open={!!selectedWorkflow} onOpenChange={() => setSelectedWorkflow(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedWorkflow.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedWorkflow.description}</p>
              </div>

              <div>
                <h4 className="font-medium mb-2">Trigger</h4>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">When {selectedWorkflow.trigger.type.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Actions</h4>
                <div className="space-y-2">
                  {selectedWorkflow.actions.map((action, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{action.type.replace('_', ' ')}</span>
                      {index < selectedWorkflow.actions.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="font-medium">{formatDistanceToNow(new Date(selectedWorkflow.created), { addSuffix: true })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium">{selectedWorkflow.isActive ? 'Active' : 'Paused'}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}