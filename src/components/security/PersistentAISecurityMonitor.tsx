import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, Activity, Bot, Zap, Eye, Lock, Network } from 'lucide-react';
import { toast } from 'sonner';

interface AIBot {
  id: string;
  bot_name: string;
  bot_type: string;
  status: string;
  sensitivity_level: string;
  last_activity: string;
  performance_metrics: any;
  configuration: any;
}

interface AIBotAlert {
  id: string;
  bot_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'emergency';
  title: string;
  description: string;
  confidence_score: number;
  auto_response_taken: boolean;
  requires_human_review: boolean;
  acknowledged: boolean;
  created_at: string;
  threat_indicators: any;
}

export const PersistentAISecurityMonitor: React.FC = () => {
  const { user } = useAuth();
  const [aiBots, setAiBots] = useState<AIBot[]>([]);
  const [alerts, setAlerts] = useState<AIBotAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [emergencyAlerts, setEmergencyAlerts] = useState<AIBotAlert[]>([]);

  useEffect(() => {
    if (!user) return;

    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    const startMonitoring = async () => {
      setIsMonitoring(true);

      // Load AI bots status
      const { data: bots } = await supabase
        .from('ai_security_bots')
        .select('*')
        .order('last_activity', { ascending: false });

      if (bots) setAiBots(bots);

      // Load recent high-priority alerts
      const { data: recentAlerts } = await supabase
        .from('ai_bot_alerts')
        .select('*')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('created_at', { ascending: false })
        .limit(20);

      if (recentAlerts) {
        const typedAlerts = recentAlerts.map(alert => ({
          ...alert,
          severity: alert.severity as 'low' | 'medium' | 'high' | 'critical' | 'emergency'
        }));
        setAlerts(typedAlerts);
        const emergency = typedAlerts.filter(a => a.severity === 'emergency' || a.severity === 'critical');
        setEmergencyAlerts(emergency);
      }

      // Poll for new alerts and bot status every 15s
      pollingInterval = setInterval(startMonitoring, 15000);
    };

    startMonitoring();

    return () => {
      setIsMonitoring(false);
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [user]);

  const handleAlertReview = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('ai_bot_alerts')
        .update({ 
          acknowledged: true, 
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (!error) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ));
        setEmergencyAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ));
        toast.success('Alert acknowledged');
      }
    } catch (error) {
      toast.error('Failed to acknowledge alert');
    }
  };

  const triggerManualScan = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('persistent-ai-security', {
        body: { action: 'run_scan', manual_trigger: true }
      });

      if (data?.success) {
        toast.success(`Manual scan completed: ${data.threats_detected} threats detected`);
      } else {
        toast.error('Manual scan failed');
      }
    } catch (error) {
      toast.error('Failed to trigger manual scan');
    }
  };

  const getBotIcon = (botType: string) => {
    switch (botType) {
      case 'threat_detection': return <AlertTriangle className="h-4 w-4" />;
      case 'behavior_analysis': return <Eye className="h-4 w-4" />;
      case 'network_monitor': return <Network className="h-4 w-4" />;
      case 'data_protection': return <Lock className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'emergency': return <Zap className="h-4 w-4 text-red-600 animate-pulse" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Shield className="h-4 w-4 text-yellow-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'emergency': return 'destructive';
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  if (!user || !isMonitoring) return null;

  const activeBots = aiBots.filter(bot => bot.status === 'active');
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical' || alert.severity === 'emergency');

  return (
    <div className="space-y-5">
      {/* Emergency Alerts */}
      {emergencyAlerts.filter(alert => !alert.acknowledged).length > 0 && (
        <Alert variant="destructive" className="border-red-600">
          <AlertDescription className="font-semibold">
            EMERGENCY: {emergencyAlerts.filter(alert => !alert.acknowledged).length} critical threats detected by AI security bots
            <div className="mt-3 space-y-2">
              {emergencyAlerts.filter(alert => !alert.acknowledged).slice(0, 2).map(alert => (
                <div key={alert.id} className="text-sm flex justify-between items-center">
                  <span>{alert.title} ({alert.confidence_score}% confidence)</span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleAlertReview(alert.id)}
                  >
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* AI Bots Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">AI Security Bots</h3>
            <p className="text-sm text-muted-foreground">
              {activeBots.length}/{aiBots.length} bots active
            </p>
          </div>
          <Button onClick={triggerManualScan} size="sm" variant="outline">
            Manual Scan
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {aiBots.map((bot) => (
            <div key={bot.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div>
                <div className="font-medium text-sm">{bot.bot_name}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {bot.bot_type.replace('_', ' ')} • {bot.sensitivity_level} sensitivity
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase px-2 py-0.5 rounded bg-muted">
                  {bot.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(bot.last_activity).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent AI Alerts */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">AI Security Alerts</h3>
          <p className="text-sm text-muted-foreground">
            {alerts.length} total • {criticalAlerts.length} critical (last hour)
          </p>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {alerts.slice(0, 10).map((alert) => (
            <div key={alert.id} className={`p-4 border rounded-lg ${
              alert.severity === 'emergency' ? 'bg-red-50 border-red-200 dark:bg-red-950/20' : 
              alert.severity === 'critical' ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20' : 'bg-card'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase px-2 py-0.5 rounded bg-muted">
                      {alert.severity}
                    </span>
                    <span className="font-medium text-sm">{alert.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {alert.alert_type} • Confidence: {alert.confidence_score}%
                    {alert.auto_response_taken && (
                      <span className="ml-2 text-blue-600">• Auto-response executed</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {alert.requires_human_review && !alert.acknowledged && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAlertReview(alert.id)}
                    >
                      Review
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(alert.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="text-center text-muted-foreground py-8 border rounded-lg bg-card">
              <p className="text-sm">No security alerts in the last hour</p>
              <p className="text-xs mt-1">AI security bots are actively monitoring</p>
            </div>
          )}
        </div>
      </div>

      {/* Bot Performance Summary */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Security Coverage Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg bg-card text-center space-y-2">
            <div className="text-3xl font-semibold text-green-600">
              {aiBots.filter(b => b.bot_type === 'threat_detection' && b.status === 'active').length}
            </div>
            <div className="text-xs text-muted-foreground">Threat Detection</div>
          </div>
          <div className="p-4 border rounded-lg bg-card text-center space-y-2">
            <div className="text-3xl font-semibold text-blue-600">
              {aiBots.filter(b => b.bot_type === 'behavior_analysis' && b.status === 'active').length}
            </div>
            <div className="text-xs text-muted-foreground">Behavior Analysis</div>
          </div>
          <div className="p-4 border rounded-lg bg-card text-center space-y-2">
            <div className="text-3xl font-semibold text-purple-600">
              {aiBots.filter(b => b.bot_type === 'network_monitor' && b.status === 'active').length}
            </div>
            <div className="text-xs text-muted-foreground">Network Monitor</div>
          </div>
          <div className="p-4 border rounded-lg bg-card text-center space-y-2">
            <div className="text-3xl font-semibold text-orange-600">
              {aiBots.filter(b => b.bot_type === 'data_protection' && b.status === 'active').length}
            </div>
            <div className="text-xs text-muted-foreground">Data Protection</div>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          AI Bots Running Every 10-30 Seconds - High Alert Mode Active
        </p>
      </div>
    </div>
  );
};