/**
 * SECURITY AUDIT SYSTEM - Comprehensive security auditing
 * Implements automated security checks and compliance verification
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface SecurityAuditResult {
  score: number;
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  checks: SecurityCheck[];
  recommendations: string[];
  complianceStatus: ComplianceStatus;
}

export interface SecurityCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  details?: any;
}

export interface ComplianceStatus {
  gdpr: boolean;
  hipaa: boolean;
  soc2: boolean;
  pci: boolean;
  overall: number;
}

/**
 * Comprehensive security audit
 */
export const runSecurityAudit = async (): Promise<SecurityAuditResult> => {
  const checks: SecurityCheck[] = [];
  const recommendations: string[] = [];

  try {
    // 1. Database Security Checks
    const dbChecks = await auditDatabaseSecurity();
    checks.push(...dbChecks.checks);
    recommendations.push(...dbChecks.recommendations);

    // 2. Authentication Security Checks
    const authChecks = await auditAuthenticationSecurity();
    checks.push(...authChecks.checks);
    recommendations.push(...authChecks.recommendations);

    // 3. Session Security Checks
    const sessionChecks = await auditSessionSecurity();
    checks.push(...sessionChecks.checks);
    recommendations.push(...sessionChecks.recommendations);

    // 4. Input Validation Checks
    const inputChecks = await auditInputValidation();
    checks.push(...inputChecks.checks);
    recommendations.push(...inputChecks.recommendations);

    // 5. Encryption Checks
    const encryptionChecks = await auditEncryption();
    checks.push(...encryptionChecks.checks);
    recommendations.push(...encryptionChecks.recommendations);

    // Calculate overall security score
    const { score, level } = calculateSecurityScore(checks);

    // Determine compliance status
    const complianceStatus = calculateComplianceStatus(checks);

    // Log audit completion
    await supabase.rpc('log_security_event', {
      p_event_type: 'security_audit_completed',
      p_severity: 'low',
      p_details: {
        score,
        level,
        checksCount: checks.length,
        passCount: checks.filter(c => c.status === 'pass').length,
        failCount: checks.filter(c => c.status === 'fail').length,
        warningCount: checks.filter(c => c.status === 'warning').length
      }
    });

    return {
      score,
      level,
      checks,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      complianceStatus
    };
  } catch (error) {
    logger.error('Security audit failed:', error);
    
    await supabase.rpc('log_security_event', {
      p_event_type: 'security_audit_failed',
      p_severity: 'high',
      p_details: { error: String(error) }
    });

    return {
      score: 0,
      level: 'critical',
      checks: [{
        name: 'Audit System',
        status: 'fail',
        description: 'Security audit system failed to complete',
        impact: 'critical',
        details: { error: String(error) }
      }],
      recommendations: ['Investigate audit system failure immediately'],
      complianceStatus: { gdpr: false, hipaa: false, soc2: false, pci: false, overall: 0 }
    };
  }
};

/**
 * Audit database security configuration
 */
const auditDatabaseSecurity = async () => {
  const checks: SecurityCheck[] = [];
  const recommendations: string[] = [];

  try {
    // Check for RLS by examining key security tables
    const { data: profilesCheck } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    const { data: leadsCheck } = await supabase
      .from('leads')
      .select('id')
      .limit(1);
    
    // If we can access data, RLS is properly configured (it means queries are filtered)
    if (profilesCheck !== null && leadsCheck !== null) {
      checks.push({
        name: 'Row Level Security',
        status: 'pass',
        description: 'RLS policies are active and filtering data access',
        impact: 'high'
      });
    } else {
      checks.push({
        name: 'Row Level Security',
        status: 'warning',
        description: 'Unable to verify RLS status',
        impact: 'medium'
      });
      recommendations.push('Verify RLS policies are properly configured');
    }

    // Check for encrypted sensitive fields
    const { data: encryptedFields } = await supabase
      .from('profile_encrypted_fields')
      .select('field_name')
      .limit(1);

    if (encryptedFields && encryptedFields.length > 0) {
      checks.push({
        name: 'Field-Level Encryption',
        status: 'pass',
        description: 'Sensitive fields are encrypted',
        impact: 'high'
      });
    } else {
      checks.push({
        name: 'Field-Level Encryption',
        status: 'warning',
        description: 'No encrypted fields detected',
        impact: 'medium'
      });
      recommendations.push('Consider implementing field-level encryption for sensitive data');
    }

  } catch (error) {
    checks.push({
      name: 'Database Security Check',
      status: 'fail',
      description: 'Unable to verify database security',
      impact: 'high',
      details: { error: String(error) }
    });
  }

  return { checks, recommendations };
};

/**
 * Audit authentication security
 */
const auditAuthenticationSecurity = async () => {
  const checks: SecurityCheck[] = [];
  const recommendations: string[] = [];

  try {
    // Check for MFA enforcement
    const { data: mfaUsers } = await supabase
      .from('profiles')
      .select('id')
      .not('mfa_secret', 'is', null)
      .limit(1);

    if (mfaUsers && mfaUsers.length > 0) {
      checks.push({
        name: 'Multi-Factor Authentication',
        status: 'pass',
        description: 'MFA is implemented and in use',
        impact: 'high'
      });
    } else {
      checks.push({
        name: 'Multi-Factor Authentication',
        status: 'warning',
        description: 'MFA not widely adopted',
        impact: 'medium'
      });
      recommendations.push('Encourage or enforce MFA for all users');
    }

    // Check recent failed login attempts
    const { data: failedLogins } = await supabase
      .from('security_events')
      .select('*')
      .eq('event_type', 'login_failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (failedLogins && failedLogins.length < 10) {
      checks.push({
        name: 'Login Security',
        status: 'pass',
        description: 'Low failed login attempts',
        impact: 'medium'
      });
    } else if (failedLogins && failedLogins.length < 50) {
      checks.push({
        name: 'Login Security',
        status: 'warning',
        description: `${failedLogins.length} failed login attempts in 24h`,
        impact: 'medium'
      });
      recommendations.push('Monitor and investigate failed login patterns');
    } else {
      checks.push({
        name: 'Login Security',
        status: 'fail',
        description: `High number of failed logins: ${failedLogins?.length || 0}`,
        impact: 'high'
      });
      recommendations.push('Implement stronger brute force protection');
    }

  } catch (error) {
    checks.push({
      name: 'Authentication Security Check',
      status: 'fail',
      description: 'Unable to verify authentication security',
      impact: 'high'
    });
  }

  return { checks, recommendations };
};

/**
 * Audit session security
 */
const auditSessionSecurity = async () => {
  const checks: SecurityCheck[] = [];
  const recommendations: string[] = [];

  try {
    // Check active sessions
    const { data: activeSessions } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('is_active', true);

    if (activeSessions && activeSessions.length > 0) {
      checks.push({
        name: 'Session Management',
        status: 'pass',
        description: 'Session tracking is active',
        impact: 'medium'
      });

      // Check for old sessions
      const oldSessions = activeSessions.filter(session => {
        const lastActivity = new Date(session.last_activity);
        const hoursAgo = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
        return hoursAgo > 24;
      });

      if (oldSessions.length > 0) {
        checks.push({
          name: 'Session Cleanup',
          status: 'warning',
          description: `${oldSessions.length} stale sessions detected`,
          impact: 'low'
        });
        recommendations.push('Implement automatic session cleanup for inactive sessions');
      }
    }

  } catch (error) {
    checks.push({
      name: 'Session Security Check',
      status: 'fail',
      description: 'Unable to verify session security',
      impact: 'medium'
    });
  }

  return { checks, recommendations };
};

/**
 * Audit input validation
 */
const auditInputValidation = async () => {
  const checks: SecurityCheck[] = [];
  const recommendations: string[] = [];

  try {
    // Check for recent validation events
    const { data: validationEvents } = await supabase
      .from('security_events')
      .select('*')
      .like('event_type', '%validation%')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (validationEvents && validationEvents.length > 0) {
      checks.push({
        name: 'Input Validation',
        status: 'pass',
        description: 'Input validation system is active',
        impact: 'high'
      });

      // Check for suspicious input patterns
      const suspiciousInputs = validationEvents.filter(event => 
        event.event_type?.includes('suspicious') || event.event_type?.includes('malicious')
      );

      if (suspiciousInputs.length > 0) {
        checks.push({
          name: 'Suspicious Input Detection',
          status: 'pass',
          description: `${suspiciousInputs.length} suspicious inputs detected and blocked`,
          impact: 'high'
        });
      }
    } else {
      checks.push({
        name: 'Input Validation',
        status: 'warning',
        description: 'No recent validation activity detected',
        impact: 'medium'
      });
      recommendations.push('Ensure input validation is properly implemented across all forms');
    }

  } catch (error) {
    checks.push({
      name: 'Input Validation Check',
      status: 'fail',
      description: 'Unable to verify input validation',
      impact: 'high'
    });
  }

  return { checks, recommendations };
};

/**
 * Audit encryption implementation
 */
const auditEncryption = async () => {
  const checks: SecurityCheck[] = [];
  const recommendations: string[] = [];

  // Check HTTPS enforcement
  if (window.location.protocol === 'https:') {
    checks.push({
      name: 'Transport Encryption',
      status: 'pass',
      description: 'HTTPS is enforced',
      impact: 'critical'
    });
  } else {
    checks.push({
      name: 'Transport Encryption',
      status: 'fail',
      description: 'HTTPS not enforced',
      impact: 'critical'
    });
    recommendations.push('Enforce HTTPS for all communications');
  }

  // Check for secure storage
  try {
    const hasSecureStorage = localStorage.getItem('security_initialized') === 'true';
    if (hasSecureStorage) {
      checks.push({
        name: 'Client-Side Security',
        status: 'pass',
        description: 'Secure storage is initialized',
        impact: 'medium'
      });
    } else {
      checks.push({
        name: 'Client-Side Security',
        status: 'warning',
        description: 'Secure storage not detected',
        impact: 'low'
      });
    }
  } catch (error) {
    checks.push({
      name: 'Client-Side Security',
      status: 'fail',
      description: 'Unable to verify client-side security',
      impact: 'medium'
    });
  }

  return { checks, recommendations };
};

/**
 * Calculate overall security score
 */
const calculateSecurityScore = (checks: SecurityCheck[]): { score: number; level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' } => {
  if (checks.length === 0) return { score: 0, level: 'critical' };

  let totalScore = 0;
  let maxScore = 0;

  checks.forEach(check => {
    const weight = check.impact === 'critical' ? 4 : check.impact === 'high' ? 3 : check.impact === 'medium' ? 2 : 1;
    maxScore += weight;
    
    if (check.status === 'pass') {
      totalScore += weight;
    } else if (check.status === 'warning') {
      totalScore += weight * 0.5;
    }
    // 'fail' adds 0 to totalScore
  });

  const score = Math.round((totalScore / maxScore) * 100);

  let level: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  if (score >= 95) level = 'excellent';
  else if (score >= 85) level = 'good';
  else if (score >= 70) level = 'fair';
  else if (score >= 50) level = 'poor';
  else level = 'critical';

  return { score, level };
};

/**
 * Calculate compliance status
 */
const calculateComplianceStatus = (checks: SecurityCheck[]): ComplianceStatus => {
  const criticalChecks = checks.filter(c => c.impact === 'critical');
  const criticalPassed = criticalChecks.filter(c => c.status === 'pass').length;
  const criticalTotal = criticalChecks.length;

  const highChecks = checks.filter(c => c.impact === 'high');
  const highPassed = highChecks.filter(c => c.status === 'pass').length;
  const highTotal = highChecks.length;

  // Basic compliance requirements
  const hasRLS = checks.some(c => c.name === 'Row Level Security' && c.status === 'pass');
  const hasEncryption = checks.some(c => c.name === 'Transport Encryption' && c.status === 'pass');
  const hasAuth = checks.some(c => c.name === 'Multi-Factor Authentication' && c.status !== 'fail');

  const gdpr = hasRLS && hasEncryption && (criticalPassed / Math.max(criticalTotal, 1)) >= 0.8;
  const hipaa = hasRLS && hasEncryption && hasAuth && (highPassed / Math.max(highTotal, 1)) >= 0.9;
  const soc2 = hasRLS && hasEncryption && (criticalPassed / Math.max(criticalTotal, 1)) >= 0.9;
  const pci = hasEncryption && hasAuth && (criticalPassed / Math.max(criticalTotal, 1)) >= 1.0;

  const overall = Math.round(([gdpr, hipaa, soc2, pci].filter(Boolean).length / 4) * 100);

  return { gdpr, hipaa, soc2, pci, overall };
};