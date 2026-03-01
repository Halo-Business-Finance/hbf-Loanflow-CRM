import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ibmDb, supabase } from '@/lib/ibm';
import { getAuthUser } from '@/lib/auth-utils';
import { StandardKPICard } from '@/components/StandardKPICard';
import { StandardContentCard } from '@/components/StandardContentCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Workflow, Play, Pause, Trash2, Edit, MoreVertical,
  Zap, Clock, Mail, Users, ArrowRight, CheckCircle, AlertTriangle,
  Search, GitBranch, Timer, Target,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────
interface AutomationStep {
  id: string;
  type: 'email' | 'delay' | 'condition' | 'action';
  label: string;
  config: Record<string, unknown>;
}

interface Automation {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  automation_type: string;
  status: string;
  trigger_type: string;
  trigger_conditions: Record<string, unknown>;
  steps: AutomationStep[];
  target_audience: Record<string, unknown>;
  performance_metrics: Record<string, unknown>;
  enrolled_count: number;
  completed_count: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

const triggerLabels: Record<string, { label: string; icon: React.ElementType }> = {
  manual: { label: 'Manual Enrollment', icon: Users },
  new_lead: { label: 'New Lead Created', icon: Zap },
  stage_change: { label: 'Stage Change', icon: GitBranch },
  inactivity: { label: 'Lead Inactivity', icon: Timer },
  score_threshold: { label: 'Score Threshold', icon: Target },
  form_submission: { label: 'Form Submission', icon: Mail },
};

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const stepTypeConfig = {
  email: { icon: Mail, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  delay: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  condition: { icon: GitBranch, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  action: { icon: Zap, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
};

// ── Component ──────────────────────────────────────────────────────────
export function DripSequenceAutomation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTrigger, setFormTrigger] = useState('new_lead');
  const [formSteps, setFormSteps] = useState<AutomationStep[]>([]);

  // ── Queries ──────────────────────────────────
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['marketing-automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_automations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((a: Record<string, unknown>) => ({
        ...a,
        steps: Array.isArray(a.steps) ? a.steps : [],
        trigger_conditions: (a.trigger_conditions ?? {}) as Record<string, unknown>,
        target_audience: (a.target_audience ?? {}) as Record<string, unknown>,
        performance_metrics: (a.performance_metrics ?? {}) as Record<string, unknown>,
      })) as Automation[];
    },
  });

  // ── Mutations ────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (automation: Record<string, unknown>) => {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('marketing_automations')
        .insert([{ ...automation, user_id: user.id }] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-automations'] });
      toast({ title: 'Automation created' });
      resetForm();
      setIsCreateOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, unknown> & { id: string }) => {
      const { error } = await supabase
        .from('marketing_automations')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-automations'] });
      toast({ title: 'Automation updated' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_automations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-automations'] });
      toast({ title: 'Automation deleted' });
      if (selectedAutomation) setSelectedAutomation(null);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ── Helpers ──────────────────────────────────
  function resetForm() {
    setFormName('');
    setFormDescription('');
    setFormTrigger('new_lead');
    setFormSteps([]);
  }

  function addStep(type: AutomationStep['type']) {
    const labels: Record<string, string> = {
      email: 'Send Email',
      delay: 'Wait 2 days',
      condition: 'If lead score > 50',
      action: 'Assign to team',
    };
    setFormSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type, label: labels[type], config: {} },
    ]);
  }

  function removeStep(id: string) {
    setFormSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function handleCreate() {
    createMutation.mutate({
      name: formName,
      description: formDescription || null,
      trigger_type: formTrigger,
      steps: formSteps as unknown as AutomationStep[],
    });
  }

  // ── Filter ───────────────────────────────────
  const filtered = automations.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  const activeCount = automations.filter((a) => a.is_active).length;
  const totalEnrolled = automations.reduce((s, a) => s + (a.enrolled_count ?? 0), 0);
  const totalCompleted = automations.reduce((s, a) => s + (a.completed_count ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* ── KPIs ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StandardKPICard title="Total Automations" value={automations.length} />
        <StandardKPICard title="Active" value={activeCount} trend={{ value: `${automations.length - activeCount} paused/draft`, direction: 'neutral' }} />
        <StandardKPICard title="Total Enrolled" value={totalEnrolled.toLocaleString()} />
        <StandardKPICard title="Completed Journeys" value={totalCompleted.toLocaleString()} />
      </div>

      {/* ── Toolbar ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search automations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" /> New Automation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Drip Sequence</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Automation Name</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. New Lead Welcome Series" />
                </div>
                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <Select value={formTrigger} onValueChange={setFormTrigger}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(triggerLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="What does this automation do?" rows={2} />
              </div>

              {/* ── Visual Workflow Builder ──────── */}
              <div className="space-y-2">
                <Label>Workflow Steps</Label>
                <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-2">
                  {/* Trigger node */}
                  <div className="flex items-center gap-3 p-3 rounded-md border border-primary/30 bg-primary/5">
                    <Zap className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      Trigger: {triggerLabels[formTrigger]?.label ?? formTrigger}
                    </span>
                  </div>

                  {formSteps.map((step, i) => {
                    const cfg = stepTypeConfig[step.type];
                    const StepIcon = cfg.icon;
                    return (
                      <React.Fragment key={step.id}>
                        <div className="flex justify-center">
                          <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                        </div>
                        <div className={`flex items-center justify-between gap-3 p-3 rounded-md border ${cfg.bg}`}>
                          <div className="flex items-center gap-3">
                            <StepIcon className={`h-5 w-5 ${cfg.color}`} />
                            <Input
                              value={step.label}
                              onChange={(e) => {
                                const updated = [...formSteps];
                                updated[i] = { ...updated[i], label: e.target.value };
                                setFormSteps(updated);
                              }}
                              className="h-8 text-sm bg-transparent border-0 p-0 focus-visible:ring-0"
                            />
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removeStep(step.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {/* Add step buttons */}
                  <div className="flex justify-center pt-2">
                    <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90 mb-2" />
                  </div>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => addStep('email')} className="gap-1.5 text-xs">
                      <Mail className="h-3.5 w-3.5" /> + Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addStep('delay')} className="gap-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5" /> + Delay
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addStep('condition')} className="gap-1.5 text-xs">
                      <GitBranch className="h-3.5 w-3.5" /> + Condition
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addStep('action')} className="gap-1.5 text-xs">
                      <Zap className="h-3.5 w-3.5" /> + Action
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!formName.trim() || formSteps.length === 0}>Create Automation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Automation List ────────────────────── */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading automations...</div>
      ) : filtered.length === 0 ? (
        <StandardContentCard>
          <div className="text-center py-12">
            <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">No automations yet</h3>
            <p className="text-muted-foreground text-sm">Create your first drip sequence to automate lead nurturing.</p>
          </div>
        </StandardContentCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const trigger = triggerLabels[a.trigger_type] ?? { label: a.trigger_type, icon: Zap };
            const TriggerIcon = trigger.icon;
            const steps = Array.isArray(a.steps) ? a.steps : [];

            return (
              <StandardContentCard key={a.id}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Workflow className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-foreground truncate">{a.name}</h4>
                      <Badge variant="outline" className={statusStyles[a.status] ?? statusStyles.draft}>{a.status}</Badge>
                    </div>
                    {a.description && (
                      <p className="text-sm text-muted-foreground mb-1.5 truncate">{a.description}</p>
                    )}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><TriggerIcon className="h-3 w-3" />{trigger.label}</span>
                      <span>{steps.length} steps</span>
                      <span><Users className="inline h-3 w-3 mr-0.5" />{a.enrolled_count} enrolled</span>
                      <span><CheckCircle className="inline h-3 w-3 mr-0.5" />{a.completed_count} completed</span>
                    </div>

                    {/* Mini workflow visualization */}
                    {steps.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 overflow-x-auto">
                        {steps.slice(0, 6).map((step: AutomationStep, i: number) => {
                          const cfg = stepTypeConfig[step.type] ?? stepTypeConfig.action;
                          const StepIcon = cfg.icon;
                          return (
                            <React.Fragment key={step.id ?? i}>
                              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                              <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs border flex-shrink-0 ${cfg.bg}`} title={step.label}>
                                <StepIcon className={`h-3 w-3 ${cfg.color}`} />
                                <span className="max-w-20 truncate">{step.label}</span>
                              </div>
                            </React.Fragment>
                          );
                        })}
                        {steps.length > 6 && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">+{steps.length - 6} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateMutation.mutate({ id: a.id, is_active: !a.is_active, status: a.is_active ? 'paused' : 'active' })}
                      title={a.is_active ? 'Pause' : 'Activate'}
                    >
                      {a.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { /* TODO: edit modal */ }}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(a.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </StandardContentCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
