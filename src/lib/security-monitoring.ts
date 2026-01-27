import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export class SecurityMonitoring {
  private static instance: SecurityMonitoring;

  static getInstance(): SecurityMonitoring {
    if (!SecurityMonitoring.instance) {
      SecurityMonitoring.instance = new SecurityMonitoring();
    }
    return SecurityMonitoring.instance;
  }

  async logSecurityEvent(
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>,
    userId?: string
  ) {
    try {
      await supabase.functions.invoke('security-monitor', {
        body: {
          action: 'log_event',
          event_type: eventType,
          severity,
          details,
          user_id: userId
        }
      });
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  async checkPrivilegeEscalation(
    currentUserRole: string,
    targetRole: string,
    targetUserId: string
  ): Promise<boolean> {
    // Prevent privilege escalation attempts
    const roleHierarchy = {
      'tech': 0,
      
      'loan_originator': 1,
      'loan_processor': 1,
      'funder': 1,
      'underwriter': 1,
      'closer': 1,
      'manager': 2,
      'admin': 3,
      'super_admin': 4
    };

    const currentLevel = roleHierarchy[currentUserRole as keyof typeof roleHierarchy] || 0;
    const targetLevel = roleHierarchy[targetRole as keyof typeof roleHierarchy] || 0;

    // Log privilege escalation attempts
    if (targetLevel > currentLevel) {
      await this.logSecurityEvent(
        'privilege_escalation_attempt',
        'high',
        {
          current_role: currentUserRole,
          target_role: targetRole,
          target_user_id: targetUserId,
          escalation_level: targetLevel - currentLevel
        }
      );
      return false;
    }

    // Super admin roles can only be managed by super admins
    if (targetRole === 'super_admin' && currentUserRole !== 'super_admin') {
      await this.logSecurityEvent(
        'super_admin_access_attempt',
        'critical',
        {
          current_role: currentUserRole,
          target_user_id: targetUserId
        }
      );
      return false;
    }

    return true;
  }

  async validateGeoSecurity(ipAddress: string): Promise<{
    allowed: boolean;
    risk_factors: string[];
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('geo-security', {
        body: { ip_address: ipAddress }
      });

      if (error) {
        logger.error('Geo-security check failed:', error);
        return { allowed: false, risk_factors: ['geo_check_failed'] };
      }

      return data;
    } catch (error) {
      logger.error('Geo-security validation error:', error);
      return { allowed: false, risk_factors: ['geo_validation_error'] };
    }
  }

  async auditUserAction(
    action: string,
    tableName: string,
    recordId?: string,
    details?: Record<string, any>
  ) {
    try {
      await supabase.functions.invoke('audit-log', {
        body: {
          action,
          table_name: tableName,
          record_id: recordId,
          details
        }
      });
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }
}

export const securityMonitoring = SecurityMonitoring.getInstance();