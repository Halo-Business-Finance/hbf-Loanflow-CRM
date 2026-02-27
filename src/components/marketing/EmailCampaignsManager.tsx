import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StandardKPICard } from '@/components/StandardKPICard';
import { StandardContentCard } from '@/components/StandardContentCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Mail, Eye, MousePointerClick, Target, Search,
  MoreVertical, Play, Pause, Trash2, Edit, Copy,
  Send, Clock, Users, TrendingUp, BarChart3,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────────
interface Campaign {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  status: string;
  subject_line: string | null;
  email_template: string | null;
  target_audience: Record<string, unknown> | null;
  send_schedule: Record<string, unknown> | null;
  trigger_conditions: Record<string, unknown> | null;
  performance_metrics: Record<string, unknown> | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  archived: 'bg-muted text-muted-foreground border-border',
};

const typeLabels: Record<string, string> = {
  blast: 'One-Time Blast',
  drip: 'Drip Sequence',
  triggered: 'Event Triggered',
  newsletter: 'Newsletter',
};

// ── Component ──────────────────────────────────────────────────────────
export function EmailCampaignsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('blast');
  const [formSubject, setFormSubject] = useState('');
  const [formTemplate, setFormTemplate] = useState('');

  // ── Queries ──────────────────────────────────
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  // ── Mutations ────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (campaign: Record<string, unknown>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert([{ ...campaign, user_id: user.id }] as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign created' });
      resetForm();
      setIsCreateOpen(false);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, unknown> & { id: string }) => {
      const { error } = await supabase
        .from('email_campaigns')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign updated' });
      setEditingCampaign(null);
      resetForm();
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign deleted' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ── Helpers ──────────────────────────────────
  function resetForm() {
    setFormName('');
    setFormDescription('');
    setFormType('blast');
    setFormSubject('');
    setFormTemplate('');
  }

  function openEdit(c: Campaign) {
    setEditingCampaign(c);
    setFormName(c.name);
    setFormDescription(c.description ?? '');
    setFormType(c.campaign_type);
    setFormSubject(c.subject_line ?? '');
    setFormTemplate(c.email_template ?? '');
    setIsCreateOpen(true);
  }

  function handleSubmit() {
    const payload = {
      name: formName,
      description: formDescription || null,
      campaign_type: formType,
      subject_line: formSubject || null,
      email_template: formTemplate || null,
    };

    if (editingCampaign) {
      updateMutation.mutate({ id: editingCampaign.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleStatus(c: Campaign) {
    const newStatus = c.status === 'active' ? 'paused' : 'active';
    updateMutation.mutate({ id: c.id, status: newStatus });
  }

  // ── Filter ───────────────────────────────────
  const filtered = campaigns.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.subject_line ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // ── KPIs ─────────────────────────────────────
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const draftCampaigns = campaigns.filter((c) => c.status === 'draft').length;
  const completedCampaigns = campaigns.filter((c) => c.status === 'completed').length;

  const metrics = campaigns.reduce(
    (acc, c) => {
      const m = (c.performance_metrics ?? {}) as Record<string, number>;
      acc.sent += m.sent ?? 0;
      acc.opened += m.opened ?? 0;
      acc.clicked += m.clicked ?? 0;
      return acc;
    },
    { sent: 0, opened: 0, clicked: 0 },
  );

  return (
    <div className="space-y-6">
      {/* ── KPIs ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StandardKPICard title="Active Campaigns" value={activeCampaigns} trend={{ value: `${draftCampaigns} drafts`, direction: 'neutral' }} />
        <StandardKPICard title="Total Sent" value={metrics.sent.toLocaleString()} />
        <StandardKPICard title="Avg Open Rate" value={metrics.sent ? `${((metrics.opened / metrics.sent) * 100).toFixed(1)}%` : '—'} />
        <StandardKPICard title="Completed" value={completedCampaigns} />
      </div>

      {/* ── Toolbar ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { setEditingCampaign(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Q1 SBA Loan Push" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blast">One-Time Blast</SelectItem>
                    <SelectItem value="drip">Drip Sequence</SelectItem>
                    <SelectItem value="triggered">Event Triggered</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Email subject line" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Campaign description..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Email Template (HTML)</Label>
                <Textarea value={formTemplate} onChange={(e) => setFormTemplate(e.target.value)} placeholder="<html>...</html>" rows={4} className="font-mono text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); setEditingCampaign(null); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!formName.trim()}>
                {editingCampaign ? 'Save Changes' : 'Create Campaign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Campaign List ─────────────────────── */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
      ) : filtered.length === 0 ? (
        <StandardContentCard>
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground mb-1">No campaigns found</h3>
            <p className="text-muted-foreground text-sm">Create your first email campaign to get started.</p>
          </div>
        </StandardContentCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const m = (c.performance_metrics ?? {}) as Record<string, number>;
            const sent = m.sent ?? 0;
            const opened = m.opened ?? 0;
            const clicked = m.clicked ?? 0;
            const openRate = sent ? (opened / sent) * 100 : 0;
            const clickRate = sent ? (clicked / sent) * 100 : 0;

            return (
              <StandardContentCard key={c.id}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="font-semibold text-foreground truncate">{c.name}</h4>
                      <Badge variant="outline" className={statusStyles[c.status] ?? statusStyles.draft}>{c.status}</Badge>
                      <Badge variant="outline" className="text-xs">{typeLabels[c.campaign_type] ?? c.campaign_type}</Badge>
                    </div>
                    {c.subject_line && (
                      <p className="text-sm text-muted-foreground truncate mb-1">
                        <Mail className="inline h-3.5 w-3.5 mr-1" />
                        {c.subject_line}
                      </p>
                    )}
                    <div className="flex gap-5 text-xs text-muted-foreground">
                      <span><Send className="inline h-3 w-3 mr-0.5" />{sent.toLocaleString()} sent</span>
                      <span><Eye className="inline h-3 w-3 mr-0.5" />{openRate.toFixed(1)}% opened</span>
                      <span><MousePointerClick className="inline h-3 w-3 mr-0.5" />{clickRate.toFixed(1)}% clicked</span>
                      <span><Clock className="inline h-3 w-3 mr-0.5" />{format(new Date(c.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-40 hidden lg:block">
                    <div className="text-xs text-muted-foreground mb-1">Open rate</div>
                    <Progress value={openRate} className="h-2" />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus(c)} title={c.status === 'active' ? 'Pause' : 'Activate'}>
                      {c.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          createMutation.mutate({ name: `${c.name} (Copy)`, description: c.description, campaign_type: c.campaign_type, subject_line: c.subject_line, email_template: c.email_template });
                        }}>
                          <Copy className="h-4 w-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
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
