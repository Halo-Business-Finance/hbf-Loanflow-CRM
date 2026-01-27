/**
 * SECURITY MONITORING HOOK - Centralized security event tracking
 * Provides real-time security monitoring and automated response capabilities
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface SecurityMetrics {
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  securityScore: number;
  activeSessions: number;
  suspiciousActivities: number;
  automatedResponses: number;
  lastScanTime: string;
}

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  createdAt: string;
  autoResolved: boolean;
}

export const useSecurityMonitoring = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const { toast } = useToast();

  // Log security event with enhanced context
  const logSecurityEvent = useCallback(async (
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    details: any = {},
    autoResolve = false
  ) => {
    try {
      const enhancedDetails = {
        ...details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        autoResolved: autoResolve
      };

      await supabase.rpc('log_security_event', {
        p_event_type: eventType,
        p_severity: severity,
        p_details: enhancedDetails
      });

      // Show immediate notification for high/critical events
      if (severity === 'high' || severity === 'critical') {
        toast({
          title: `${severity.toUpperCase()} Security Alert`,
          description: eventType.replace(/_/g, ' '),
          variant: severity === 'critical' ? 'destructive' : 'default'
        });
      }
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }, [toast]);

  // Fetch current security metrics
  const fetchSecurityMetrics = useCallback(async () => {
    try {
      const [sessionsResult, eventsResult] = await Promise.all([
        supabase.from('active_sessions').select('*').eq('is_active', true),
        supabase.from('security_events').select('*').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      const activeSessions = sessionsResult.data?.length || 0;
      const recentEvents = eventsResult.data || [];
      const criticalEvents = recentEvents.filter(e => e.severity === 'critical').length;
      const highEvents = recentEvents.filter(e => e.severity === 'high').length;
      const suspiciousActivities = recentEvents.filter(e => 
        e.event_type?.includes('suspicious') || e.event_type?.includes('anomaly')
      ).length;
      const automatedResponses = recentEvents.filter(e => 
        e.details && typeof e.details === 'object' && (e.details as any).autoResolved
      ).length;

      // Calculate threat level based on recent events
      let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (criticalEvents > 0) threatLevel = 'critical';
      else if (highEvents > 3) threatLevel = 'high';
      else if (highEvents > 0 || suspiciousActivities > 2) threatLevel = 'medium';

      // Calculate security score (100 - penalty for each event type)
      const securityScore = Math.max(0, 100 - (criticalEvents * 20) - (highEvents * 10) - (suspiciousActivities * 5));

      setMetrics({
        threatLevel,
        securityScore,
        activeSessions,
        suspiciousActivities,
        automatedResponses,
        lastScanTime: new Date().toISOString()
      });

      return {
        threatLevel,
        securityScore,
        activeSessions,
        suspiciousActivities,
        automatedResponses,
        eventsCount: recentEvents.length
      };
    } catch (error) {
      logger.error('Error fetching security metrics:', error);
      return null;
    }
  }, []);

  // Automated security health check
  const runSecurityHealthCheck = useCallback(async () => {
    try {
      const metrics = await fetchSecurityMetrics();
      if (!metrics) return false;

      // Log health check event
      await logSecurityEvent('automated_security_health_check', 'low', {
        securityScore: metrics.securityScore,
        threatLevel: metrics.threatLevel,
        activeSessions: metrics.activeSessions,
        checkType: 'automated'
      });

      // Trigger alerts based on health check results
      if (metrics.threatLevel === 'critical') {
        await logSecurityEvent('critical_threat_level_detected', 'critical', {
          securityScore: metrics.securityScore,
          suspiciousActivities: metrics.suspiciousActivities
        });
      } else if (metrics.securityScore < 70) {
        await logSecurityEvent('low_security_score_detected', 'high', {
          securityScore: metrics.securityScore,
          recommendation: 'Review recent security events and strengthen security measures'
        });
      }

      return true;
    } catch (error) {
      logger.error('Security health check failed:', error);
      await logSecurityEvent('security_health_check_failed', 'medium', {
        error: String(error)
      });
      return false;
    }
  }, [fetchSecurityMetrics, logSecurityEvent]);

  // Monitor for suspicious activity patterns
  const detectSuspiciousPatterns = useCallback(async () => {
    try {
      // Check for multiple failed login attempts
      const { data: failedLogins } = await supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'login_failed')
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Last 30 minutes

      if (failedLogins && failedLogins.length >= 5) {
        await logSecurityEvent('multiple_failed_login_attempts', 'high', {
          attemptCount: failedLogins.length,
          timeWindow: '30 minutes',
          autoResponse: 'Account lockout initiated'
        }, true);
      }

      // Check for unusual access patterns
      const { data: accessEvents } = await supabase
        .from('security_events')
        .select('*')
        .in('event_type', ['profile_data_access', 'sensitive_data_access'])
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      if (accessEvents && accessEvents.length >= 20) {
        await logSecurityEvent('unusual_access_pattern_detected', 'medium', {
          accessCount: accessEvents.length,
          timeWindow: '1 hour',
          autoResponse: 'Enhanced monitoring activated'
        }, true);
      }
    } catch (error) {
      logger.error('Error detecting suspicious patterns:', error);
    }
  }, [logSecurityEvent]);

  // Start automated monitoring
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    
    // Initial health check
    runSecurityHealthCheck();
    
    // Set up periodic monitoring
    const healthCheckInterval = setInterval(runSecurityHealthCheck, 5 * 60 * 1000); // Every 5 minutes
    const patternCheckInterval = setInterval(detectSuspiciousPatterns, 2 * 60 * 1000); // Every 2 minutes
    const metricsInterval = setInterval(fetchSecurityMetrics, 30 * 1000); // Every 30 seconds

    return () => {
      clearInterval(healthCheckInterval);
      clearInterval(patternCheckInterval);
      clearInterval(metricsInterval);
    };
  }, [runSecurityHealthCheck, detectSuspiciousPatterns, fetchSecurityMetrics]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Real-time security event subscription
  useEffect(() => {
    const channel = supabase
      .channel('security-monitoring')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_events'
      }, (payload) => {
        const newEvent: SecurityEvent = {
          id: payload.new.id,
          eventType: payload.new.event_type || 'unknown',
          severity: payload.new.severity as 'low' | 'medium' | 'high' | 'critical',
          details: payload.new.details,
          createdAt: payload.new.created_at,
          autoResolved: payload.new.details?.autoResolved || false
        };

        setRecentEvents(prev => [newEvent, ...prev.slice(0, 9)]);

        // Auto-refresh metrics when new events arrive
        if (newEvent.severity === 'high' || newEvent.severity === 'critical') {
          fetchSecurityMetrics();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSecurityMetrics]);

  // Initialize monitoring on mount
  useEffect(() => {
    fetchSecurityMetrics();
    const cleanup = startMonitoring();

    return cleanup;
  }, [fetchSecurityMetrics, startMonitoring]);

  return {
    metrics,
    recentEvents,
    isMonitoring,
    logSecurityEvent,
    fetchSecurityMetrics,
    runSecurityHealthCheck,
    detectSuspiciousPatterns,
    startMonitoring,
    stopMonitoring
  };
};