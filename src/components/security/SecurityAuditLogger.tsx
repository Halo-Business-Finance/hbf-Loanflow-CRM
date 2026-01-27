import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

export interface SecurityAuditEvent {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  tableName?: string;
  recordId?: string;
}

export const useSecurityAuditLogger = () => {
  const { user } = useAuth();

  const logSecurityEvent = useCallback(async (event: SecurityAuditEvent) => {
    try {
      // Log to security_events table
      const { error: securityError } = await supabase.rpc('log_enhanced_security_event', {
        p_user_id: user?.id || null,
        p_event_type: event.eventType,
        p_severity: event.severity,
        p_details: event.details,
        p_ip_address: null, // Will be populated by server
        p_user_agent: navigator.userAgent,
        p_device_fingerprint: null,
        p_location: {}
      });

      if (securityError) {
        console.error('Failed to log security event:', securityError);
      }

      // Also log to audit_logs for compliance
      const { error: auditError } = await supabase.rpc('create_audit_log', {
        p_action: `security_${event.eventType}`,
        p_table_name: event.tableName || 'security_events',
        p_record_id: event.recordId,
        p_new_values: {
          event_type: event.eventType,
          severity: event.severity,
          details: event.details,
          timestamp: new Date().toISOString()
        }
      });

      if (auditError) {
        console.error('Failed to log audit event:', auditError);
      }

    } catch (error) {
      console.error('Security audit logging error:', error);
    }
  }, [user?.id]);

  const logDataAccess = useCallback(async (
    tableName: string,
    action: 'read' | 'create' | 'update' | 'delete',
    recordId?: string,
    additionalDetails?: Record<string, any>
  ) => {
    await logSecurityEvent({
      eventType: 'data_access',
      severity: 'low',
      details: {
        table: tableName,
        action,
        record_id: recordId,
        ...additionalDetails
      },
      tableName,
      recordId
    });
  }, [logSecurityEvent]);

  const logSuspiciousActivity = useCallback(async (
    activity: string,
    details: Record<string, any>,
    severity: 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    await logSecurityEvent({
      eventType: 'suspicious_activity',
      severity,
      details: {
        activity,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        ...details
      }
    });
  }, [logSecurityEvent]);

  const logAuthenticationEvent = useCallback(async (
    eventType: 'login_attempt' | 'login_success' | 'login_failure' | 'logout',
    details: Record<string, any> = {}
  ) => {
    const severity = eventType === 'login_failure' ? 'medium' : 'low';
    
    await logSecurityEvent({
      eventType: `auth_${eventType}`,
      severity,
      details: {
        auth_event: eventType,
        user_agent: navigator.userAgent,
        ...details
      }
    });
  }, [logSecurityEvent]);

  const logFormValidationFailure = useCallback(async (
    formName: string,
    validationErrors: string[],
    securityFlags: string[]
  ) => {
    const severity = securityFlags.length > 0 ? 'high' : 'low';
    
    await logSecurityEvent({
      eventType: 'form_validation_failure',
      severity,
      details: {
        form: formName,
        validation_errors: validationErrors,
        security_flags: securityFlags,
        potential_attack: securityFlags.includes('xss_attempt') || 
                        securityFlags.includes('sql_injection_attempt')
      }
    });
  }, [logSecurityEvent]);

  return {
    logSecurityEvent,
    logDataAccess,
    logSuspiciousActivity,
    logAuthenticationEvent,
    logFormValidationFailure
  };
};

export const SecurityAuditLogger: React.FC = () => {
  // This component doesn't render anything, it's just for hook access
  return null;
};