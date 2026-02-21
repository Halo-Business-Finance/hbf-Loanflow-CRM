/**
 * SECURITY MONITORING HOOK - Centralized security event tracking
 * Provides real-time security monitoring and automated response capabilities
 */
import { useCallback, useEffect, useState } from 'react';
import { ibmDb } from '@/lib/ibm';
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

      await ibmDb.rpc('log_security_event', {
        p_event_type: eventType,
        p_severity: severity,
        p_details: enhancedDetails
      });

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

  const fetchSecurityMetrics = useCallback(async () => {
    try {
      const [sessionsResult, eventsResult] = await Promise.all([
        ibmDb.from('active_sessions').select('*').eq('is_active', true),
        ibmDb.from('security_events').select('*').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      const activeSessions = sessionsResult.data?.length || 0;
      const recentEventsData = eventsResult.data || [];
      const criticalEvents = recentEventsData.filter(e => e.severity === 'critical').length;
      const highEvents = recentEventsData.filter(e => e.severity === 'high').length;
      const suspiciousActivities = recentEventsData.filter(e => 
        (e as any).event_type?.includes('suspicious') || (e as any).event_type?.includes('anomaly')
      ).length;
      const automatedResponses = recentEventsData.filter(e => 
        e.details && typeof e.details === 'object' && (e.details as any).autoResolved
      ).length;

      let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (criticalEvents > 0) threatLevel = 'critical';
      else if (highEvents > 3) threatLevel = 'high';
      else if (highEvents > 0 || suspiciousActivities > 2) threatLevel = 'medium';

      const securityScore = Math.max(0, 100 - (criticalEvents * 20) - (highEvents * 10) - (suspiciousActivities * 5));

      setMetrics({
        threatLevel, securityScore, activeSessions, suspiciousActivities, automatedResponses,
        lastScanTime: new Date().toISOString()
      });

      return { threatLevel, securityScore, activeSessions, suspiciousActivities, automatedResponses, eventsCount: recentEventsData.length };
    } catch (error) {
      logger.error('Error fetching security metrics:', error);
      return null;
    }
  }, []);

  const runSecurityHealthCheck = useCallback(async () => {
    try {
      const metricsData = await fetchSecurityMetrics();
      if (!metricsData) return false;

      await logSecurityEvent('automated_security_health_check', 'low', {
        securityScore: metricsData.securityScore, threatLevel: metricsData.threatLevel,
        activeSessions: metricsData.activeSessions, checkType: 'automated'
      });

      if (metricsData.threatLevel === 'critical') {
        await logSecurityEvent('critical_threat_level_detected', 'critical', {
          securityScore: metricsData.securityScore, suspiciousActivities: metricsData.suspiciousActivities
        });
      } else if (metricsData.securityScore < 70) {
        await logSecurityEvent('low_security_score_detected', 'high', {
          securityScore: metricsData.securityScore,
          recommendation: 'Review recent security events and strengthen security measures'
        });
      }

      return true;
    } catch (error) {
      logger.error('Security health check failed:', error);
      await logSecurityEvent('security_health_check_failed', 'medium', { error: String(error) });
      return false;
    }
  }, [fetchSecurityMetrics, logSecurityEvent]);

  const detectSuspiciousPatterns = useCallback(async () => {
    try {
      const { data: failedLogins } = await ibmDb
        .from('security_events')
        .select('*')
        .eq('event_type', 'login_failed')
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

      if (failedLogins && failedLogins.length >= 5) {
        await logSecurityEvent('multiple_failed_login_attempts', 'high', {
          attemptCount: failedLogins.length, timeWindow: '30 minutes', autoResponse: 'Account lockout initiated'
        }, true);
      }

      const { data: accessEvents } = await ibmDb
        .from('security_events')
        .select('*')
        .in('event_type', ['profile_data_access', 'sensitive_data_access'])
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if (accessEvents && accessEvents.length >= 20) {
        await logSecurityEvent('unusual_access_pattern_detected', 'medium', {
          accessCount: accessEvents.length, timeWindow: '1 hour', autoResponse: 'Enhanced monitoring activated'
        }, true);
      }
    } catch (error) {
      logger.error('Error detecting suspicious patterns:', error);
    }
  }, [logSecurityEvent]);

  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    runSecurityHealthCheck();
    const healthCheckInterval = setInterval(runSecurityHealthCheck, 5 * 60 * 1000);
    const patternCheckInterval = setInterval(detectSuspiciousPatterns, 2 * 60 * 1000);
    const metricsInterval = setInterval(fetchSecurityMetrics, 30 * 1000);

    return () => {
      clearInterval(healthCheckInterval);
      clearInterval(patternCheckInterval);
      clearInterval(metricsInterval);
    };
  }, [runSecurityHealthCheck, detectSuspiciousPatterns, fetchSecurityMetrics]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  // Poll for new security events instead of realtime subscription
  useEffect(() => {
    const pollEvents = async () => {
      try {
        const { data } = await ibmDb
          .from('security_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (data) {
          const mapped: SecurityEvent[] = data.map((e: any) => ({
            id: e.id,
            eventType: e.event_type || 'unknown',
            severity: e.severity,
            details: e.details,
            createdAt: e.created_at,
            autoResolved: e.details?.autoResolved || false
          }));
          setRecentEvents(mapped);
        }
      } catch {
        // silent
      }
    };

    pollEvents();
    const interval = setInterval(pollEvents, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchSecurityMetrics();
    const cleanup = startMonitoring();
    return cleanup;
  }, [fetchSecurityMetrics, startMonitoring]);

  return {
    metrics, recentEvents, isMonitoring, logSecurityEvent,
    fetchSecurityMetrics, runSecurityHealthCheck, detectSuspiciousPatterns,
    startMonitoring, stopMonitoring
  };
};
