import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  details: any;
  created_at: string;
}

interface ThreatAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
}

export const RealTimeSecurityMonitor: React.FC = () => {
  const { user } = useAuth();
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [threatAlerts, setThreatAlerts] = useState<ThreatAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (!user) return;

    let eventSubscription: any;
    let threatSubscription: any;

    const startMonitoring = async () => {
      setIsMonitoring(true);

      // Subscribe to real-time security events
      eventSubscription = supabase
        .channel('security_events')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'security_events',
            filter: `user_id=eq.${user.id}`
          }, 
          (payload) => {
            const newEvent = payload.new as SecurityEvent;
            setSecurityEvents(prev => [newEvent, ...prev.slice(0, 9)]);
            
            // Show toast for high severity events
            if (newEvent.severity === 'high' || newEvent.severity === 'critical') {
              toast.error(`Security Alert: ${newEvent.event_type}`, {
                description: 'Check security dashboard for details'
              });
            }
          }
        )
        .subscribe();

      // Subscribe to threat detection alerts
      threatSubscription = supabase
        .channel('threat_alerts')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'security_notifications',
            filter: `user_id=eq.${user.id}`
          }, 
          (payload) => {
            const newThreat: ThreatAlert = {
              id: payload.new.id,
              type: payload.new.notification_type,
              severity: payload.new.severity,
              message: payload.new.message,
              timestamp: payload.new.created_at
            };
            
            setThreatAlerts(prev => [newThreat, ...prev.slice(0, 4)]);
            
            if (newThreat.severity === 'critical') {
              toast.error('Critical Security Threat Detected!', {
                description: newThreat.message,
                duration: 10000
              });
            }
          }
        )
        .subscribe();

      // Load recent events
      const { data: events } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (events) setSecurityEvents(events);

      // Load recent threats
      const { data: threats } = await supabase
        .from('security_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (threats) {
        setThreatAlerts(threats.map(t => ({
          id: t.id,
          type: t.notification_type,
          severity: (t.severity as 'low' | 'medium' | 'high' | 'critical'),
          message: t.message,
          timestamp: t.created_at
        })));
      }
    };

    startMonitoring();

    return () => {
      setIsMonitoring(false);
      if (eventSubscription) eventSubscription.unsubscribe();
      if (threatSubscription) threatSubscription.unsubscribe();
    };
  }, [user]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <Shield className="h-4 w-4 text-yellow-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!user || !isMonitoring) return null;

  return (
    <div className="space-y-4">
      {threatAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {threatAlerts[0].message}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Monitoring
            <Badge variant={isMonitoring ? "default" : "secondary"}>
              {isMonitoring ? "Active" : "Inactive"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {securityEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(event.severity)}
                  <span className="text-sm font-medium">{event.event_type}</span>
                  <Badge variant="outline">{event.severity}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {securityEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent security events</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};