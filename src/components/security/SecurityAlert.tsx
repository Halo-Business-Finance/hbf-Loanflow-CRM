import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from '@/hooks/use-toast';

interface SecurityAlertProps {
  type?: 'session' | 'data' | 'access' | 'general';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, any>;
  onDismiss?: () => void;
  actionRequired?: boolean;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  details: any;
  created_at: string;
  acknowledged?: boolean;
}

export const SecurityAlert: React.FC<SecurityAlertProps> = ({
  type = 'general',
  severity = 'medium',
  message,
  details,
  onDismiss,
  actionRequired = false
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': 
      case 'high': 
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: 
        return <Shield className="h-4 w-4 text-primary" />;
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleAcknowledge = async () => {
    try {
      await supabase.functions.invoke('security-monitor', {
        body: {
          action: 'acknowledge_alert',
          alert_type: type,
          severity,
          message,
          details
        }
      });
      
      toast({
        title: "Alert Acknowledged",
        description: "Security alert has been recorded and acknowledged.",
      });
      
      handleDismiss();
    } catch (error) {
      console.error('Error acknowledging security alert:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <Alert variant={getSeverityColor(severity)} className="mb-4 border-l-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2 flex-1">
          {getSeverityIcon(severity)}
          <div className="flex-1">
            <AlertTitle className="flex items-center space-x-2">
              <span>Security Alert</span>
              <span className="text-xs px-2 py-1 bg-background rounded uppercase">
                {severity}
              </span>
            </AlertTitle>
            <AlertDescription className="mt-2">
              {message}
              
              {details && Object.keys(details).length > 0 && (
                <div className="mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-6 px-2"
                  >
                    {isExpanded ? (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Show Details
                      </>
                    )}
                  </Button>
                  
                  {isExpanded && (
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                      <pre className="whitespace-pre-wrap text-xs">
                        {JSON.stringify(details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </AlertDescription>
            
            {actionRequired && (
              <div className="mt-3 flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcknowledge}
                >
                  Acknowledge
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {!actionRequired && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Alert>
  );
};

export const SecurityMonitor: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchRecentAlerts();
      
      // Set up real-time monitoring
      const interval = setInterval(fetchRecentAlerts, 30000); // Check every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchRecentAlerts = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', user?.id)
        .in('severity', ['high', 'critical'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching security alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  if (!user || alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <SecurityAlert
          key={alert.id}
          type={alert.event_type.includes('session') ? 'session' : 'general'}
          severity={alert.severity as any}
          message={`Security Event: ${alert.event_type.replace('_', ' ')}`}
          details={alert.details}
          onDismiss={() => dismissAlert(alert.id)}
          actionRequired={alert.severity === 'critical'}
        />
      ))}
    </div>
  );
};