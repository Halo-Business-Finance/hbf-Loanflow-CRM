import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertTriangle, Eye, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface SecurityAlert {
  id: string;
  event_type: string;
  severity: string;
  details: any;
  created_at: string;
}

interface SecurityMetrics {
  risk_score: number;
  active_sessions: number;
  failed_login_attempts: number;
  suspicious_activities: number;
}

export const AdvancedSecurityMonitor: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    risk_score: 0,
    active_sessions: 0,
    failed_login_attempts: 0,
    suspicious_activities: 0
  });
  const [isMonitoring, setIsMonitoring] = useState(true);

  // Real-time security monitoring
  const monitorSecurity = useCallback(async () => {
    if (!user || !isMonitoring) return;

    try {
      // Get recent security events
      const { data: recentAlerts } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentAlerts) {
        setAlerts(recentAlerts);
        
        // Check for critical events
        const criticalEvents = recentAlerts.filter(alert => alert.severity === 'critical');
        if (criticalEvents.length > 0) {
          toast.error('Critical security events detected', {
            description: `${criticalEvents.length} critical security events in the last 24 hours`
          });
        }
      }

      // Get security metrics
      const { data: sessionsData } = await supabase
        .from('active_sessions')
        .select('count')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const { data: suspiciousData } = await supabase
        .from('security_events')
        .select('count')
        .eq('user_id', user.id)
        .in('event_type', ['suspicious_login', 'rapid_user_actions', 'ip_change'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Calculate risk score based on recent events
      let riskScore = 0;
      recentAlerts?.forEach(alert => {
        switch (alert.severity) {
          case 'critical': riskScore += 50; break;
          case 'high': riskScore += 25; break;
          case 'medium': riskScore += 10; break;
          case 'low': riskScore += 5; break;
        }
      });

      setMetrics({
        risk_score: Math.min(riskScore, 100),
        active_sessions: sessionsData?.[0]?.count || 0,
        failed_login_attempts: recentAlerts?.filter(a => a.event_type === 'login_failure').length || 0,
        suspicious_activities: suspiciousData?.[0]?.count || 0
      });

    } catch (error) {
      console.error('Security monitoring error:', error);
    }
  }, [user, isMonitoring]);

  // Set up real-time monitoring
  useEffect(() => {
    if (!user) return;

    // Initial load
    monitorSecurity();

    // Set up periodic monitoring
    const interval = setInterval(monitorSecurity, 30000); // Every 30 seconds

    // Set up real-time subscriptions for security events
    const subscription = supabase
      .channel('security_events')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'security_events',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload) => {
          const newAlert = payload.new as SecurityAlert;
          setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
          
          // Show notification for high severity events
          if (newAlert.severity === 'critical' || newAlert.severity === 'high') {
            toast.warning(`Security Alert: ${newAlert.event_type}`, {
              description: `Severity: ${newAlert.severity}`
            });
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [user, monitorSecurity]);

  // Anomaly detection for user behavior
  useEffect(() => {
    if (!isMonitoring) return;

    let clickCount = 0;
    let lastResetTime = Date.now();

    const detectAnomalies = () => {
      clickCount++;
      
      const now = Date.now();
      if (now - lastResetTime > 60000) { // Reset every minute
        if (clickCount > 100) { // More than 100 clicks per minute
          supabase.rpc('log_enhanced_security_event', {
            p_user_id: user?.id,
            p_event_type: 'excessive_clicking',
            p_severity: 'medium',
            p_details: { clicks_per_minute: clickCount }
          });
        }
        clickCount = 0;
        lastResetTime = now;
      }
    };

    document.addEventListener('click', detectAnomalies);
    return () => document.removeEventListener('click', detectAnomalies);
  }, [user, isMonitoring]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getRiskLevel = (score: number) => {
    if (score >= 75) return { label: 'High Risk', color: 'destructive' };
    if (score >= 50) return { label: 'Medium Risk', color: 'warning' };
    if (score >= 25) return { label: 'Low Risk', color: 'secondary' };
    return { label: 'Normal', color: 'success' };
  };

  if (!user) return null;

  const riskLevel = getRiskLevel(metrics.risk_score);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-medium">Risk Level</span>
              </div>
              <Badge variant={riskLevel.color as any}>
                {riskLevel.label} ({metrics.risk_score}%)
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">Active Sessions</span>
              </div>
              <span className="text-lg font-bold">{metrics.active_sessions}</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Failed Logins (24h)</span>
              </div>
              <span className="text-lg font-bold">{metrics.failed_login_attempts}</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Suspicious Activities</span>
              </div>
              <span className="text-lg font-bold">{metrics.suspicious_activities}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 5).map(alert => (
                <Alert key={alert.id}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{alert.event_type.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityColor(alert.severity) as any}>
                        {alert.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};