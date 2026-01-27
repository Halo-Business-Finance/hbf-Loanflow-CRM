import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  Clock, 
  Settings2, 
  Plus, 
  Trash2,
  Mail,
  MessageSquare,
  Phone,
  CheckCircle2,
  Edit2,
  Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReminderRule {
  id: string;
  name: string;
  triggerStage: string;
  delayDays: number;
  delayHours: number;
  channels: ('email' | 'sms' | 'in_app')[];
  message: string;
  isActive: boolean;
  lastTriggered?: string;
  triggerCount: number;
}

const LOAN_STAGES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Application Submitted',
  'Documentation',
  'Underwriting',
  'Approved',
  'Closing',
  'Funded',
  'Lost'
];

const DEFAULT_RULES: ReminderRule[] = [
  {
    id: '1',
    name: 'New Lead Follow-up',
    triggerStage: 'New Lead',
    delayDays: 1,
    delayHours: 0,
    channels: ['email', 'in_app'],
    message: 'New lead requires initial contact within 24 hours',
    isActive: true,
    triggerCount: 45
  },
  {
    id: '2',
    name: 'Documentation Request',
    triggerStage: 'Qualified',
    delayDays: 2,
    delayHours: 0,
    channels: ['email', 'sms'],
    message: 'Request required documentation from borrower',
    isActive: true,
    triggerCount: 32
  },
  {
    id: '3',
    name: 'Stale Application Alert',
    triggerStage: 'Application Submitted',
    delayDays: 5,
    delayHours: 0,
    channels: ['email', 'in_app'],
    message: 'Application has been pending for 5 days - review status',
    isActive: true,
    triggerCount: 18
  },
  {
    id: '4',
    name: 'Underwriting Follow-up',
    triggerStage: 'Underwriting',
    delayDays: 3,
    delayHours: 0,
    channels: ['in_app'],
    message: 'Check underwriting progress and address any conditions',
    isActive: false,
    triggerCount: 12
  }
];

export function AutomatedReminders() {
  const [rules, setRules] = useState<ReminderRule[]>(DEFAULT_RULES);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<ReminderRule>>({
    name: '',
    triggerStage: 'New Lead',
    delayDays: 1,
    delayHours: 0,
    channels: ['email'],
    message: '',
    isActive: true
  });
  const { toast } = useToast();

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    ));
    const rule = rules.find(r => r.id === ruleId);
    toast({
      title: rule?.isActive ? "Rule Disabled" : "Rule Enabled",
      description: `"${rule?.name}" has been ${rule?.isActive ? 'disabled' : 'enabled'}`,
    });
  };

  const deleteRule = (ruleId: string) => {
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
    toast({
      title: "Rule Deleted",
      description: "The reminder rule has been removed",
    });
  };

  const addRule = () => {
    if (!newRule.name || !newRule.message) {
      toast({
        title: "Missing Information",
        description: "Please provide a name and message for the rule",
        variant: "destructive"
      });
      return;
    }

    const rule: ReminderRule = {
      id: `rule-${Date.now()}`,
      name: newRule.name || '',
      triggerStage: newRule.triggerStage || 'New Lead',
      delayDays: newRule.delayDays || 1,
      delayHours: newRule.delayHours || 0,
      channels: newRule.channels || ['email'],
      message: newRule.message || '',
      isActive: true,
      triggerCount: 0
    };

    setRules(prev => [...prev, rule]);
    setNewRule({
      name: '',
      triggerStage: 'New Lead',
      delayDays: 1,
      delayHours: 0,
      channels: ['email'],
      message: '',
      isActive: true
    });

    toast({
      title: "Rule Created",
      description: `"${rule.name}" has been added to your automation rules`,
    });
  };

  const toggleChannel = (channel: 'email' | 'sms' | 'in_app') => {
    setNewRule(prev => {
      const channels = prev.channels || [];
      if (channels.includes(channel)) {
        return { ...prev, channels: channels.filter(c => c !== channel) };
      }
      return { ...prev, channels: [...channels, channel] };
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-3 w-3" />;
      case 'sms': return <MessageSquare className="h-3 w-3" />;
      case 'in_app': return <Bell className="h-3 w-3" />;
      default: return null;
    }
  };

  const activeRules = rules.filter(r => r.isActive).length;
  const totalTriggers = rules.reduce((sum, r) => sum + r.triggerCount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Automated Follow-up Reminders
            </CardTitle>
            <CardDescription>
              Stage-based reminder automation rules
            </CardDescription>
          </div>
          <div className="flex gap-2 text-sm">
            <Badge variant="outline" className="px-3">
              {activeRules} Active Rules
            </Badge>
            <Badge variant="secondary" className="px-3">
              {totalTriggers} Total Triggers
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="rules">
          <TabsList className="mb-4">
            <TabsTrigger value="rules">
              <Settings2 className="h-4 w-4 mr-1" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="h-4 w-4 mr-1" />
              Create Rule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules">
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div 
                    key={rule.id}
                    className={`p-4 rounded-lg border transition-all ${
                      rule.isActive 
                        ? 'bg-muted/30 border-border' 
                        : 'bg-muted/10 border-dashed opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{rule.name}</h4>
                          {rule.isActive && (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            Stage: {rule.triggerStage}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {rule.delayDays}d {rule.delayHours}h delay
                          </Badge>
                          {rule.channels.map(channel => (
                            <Badge key={channel} variant="secondary" className="text-xs">
                              {getChannelIcon(channel)}
                              <span className="ml-1 capitalize">{channel.replace('_', ' ')}</span>
                            </Badge>
                          ))}
                        </div>
                        
                        <p className="text-sm text-muted-foreground">{rule.message}</p>
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Triggered {rule.triggerCount} times</span>
                          {rule.lastTriggered && (
                            <span>Last: {rule.lastTriggered}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={rule.isActive}
                          onCheckedChange={() => toggleRule(rule.id)}
                        />
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="create">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input 
                    placeholder="e.g., Weekly Check-in"
                    value={newRule.name}
                    onChange={e => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Trigger Stage</Label>
                  <Select 
                    value={newRule.triggerStage}
                    onValueChange={value => setNewRule(prev => ({ ...prev, triggerStage: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_STAGES.map(stage => (
                        <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Delay (Days)</Label>
                  <Input 
                    type="number"
                    min={0}
                    value={newRule.delayDays}
                    onChange={e => setNewRule(prev => ({ ...prev, delayDays: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Delay (Hours)</Label>
                  <Input 
                    type="number"
                    min={0}
                    max={23}
                    value={newRule.delayHours}
                    onChange={e => setNewRule(prev => ({ ...prev, delayHours: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notification Channels</Label>
                <div className="flex gap-2">
                  {(['email', 'sms', 'in_app'] as const).map(channel => (
                    <Button
                      key={channel}
                      variant={newRule.channels?.includes(channel) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleChannel(channel)}
                    >
                      {getChannelIcon(channel)}
                      <span className="ml-1 capitalize">{channel.replace('_', ' ')}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reminder Message</Label>
                <Input 
                  placeholder="e.g., Follow up with borrower on missing documents"
                  value={newRule.message}
                  onChange={e => setNewRule(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>

              <Button onClick={addRule} className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                Create Reminder Rule
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
