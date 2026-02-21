/**
 * CRITICAL SECURITY FIX: Enhanced authentication validation hook
 */
import { useState, useEffect, useCallback } from 'react';
import { ibmDb } from '@/lib/ibm';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSessionSecurity } from '@/hooks/useSessionSecurity';
import { useToast } from '@/hooks/use-toast';

interface SecurityCheck {
  sessionValid: boolean;
  requires2FA: boolean;
  riskScore: number;
  securityFlags: string[];
  reason: string;
}

export const useSecureAuthentication = () => {
  const { user } = useAuth();
  const { validateSession, secureSignOut } = useSessionSecurity();
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [lastSecurityCheck, setLastSecurityCheck] = useState<SecurityCheck | null>(null);

  const performSecurityCheck = useCallback(async (requiresHighSecurity: boolean = false): Promise<SecurityCheck> => {
    if (!user) {
      return { sessionValid: false, requires2FA: false, riskScore: 100, securityFlags: ['not_authenticated'], reason: 'User not authenticated' };
    }
    setIsValidating(true);
    try {
      const { data: sessionValidation, error } = await ibmDb.rpc('validate_session_with_security_checks', {
        p_user_id: user.id,
        p_session_token: await getSessionToken(),
        p_ip_address: null,
        p_user_agent: navigator.userAgent
      });

      if (error) {
        console.error('Security check failed:', error);
        return { sessionValid: false, requires2FA: true, riskScore: 100, securityFlags: ['validation_error'], reason: 'Security validation failed' };
      }

      const result: SecurityCheck = {
        sessionValid: (sessionValidation as any)?.valid || false,
        requires2FA: (sessionValidation as any)?.requires_reauth || requiresHighSecurity,
        riskScore: (sessionValidation as any)?.risk_score || 0,
        securityFlags: (sessionValidation as any)?.security_flags || [],
        reason: (sessionValidation as any)?.reason || 'Session validated'
      };
      setLastSecurityCheck(result);

      if (result.riskScore > 50) {
        toast({ title: "Security Alert", description: "Unusual activity detected. Additional verification may be required.", variant: "destructive" });
      }
      if (result.riskScore > 75 || (requiresHighSecurity && result.riskScore > 25)) {
        toast({ title: "Security Verification Required", description: "Please re-authenticate for this operation.", variant: "destructive" });
        if (result.riskScore > 90) { setTimeout(() => secureSignOut(), 2000); }
      }
      return result;
    } catch (error) {
      console.error('Security check error:', error);
      return { sessionValid: false, requires2FA: true, riskScore: 100, securityFlags: ['check_failed'], reason: 'Security check failed' };
    } finally { setIsValidating(false); }
  }, [user, secureSignOut, toast]);

  const getSessionToken = async (): Promise<string> => {
    try {
      // Auth still uses supabase for now (Phase 2)
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || '';
    } catch { return ''; }
  };

  const validateCriticalOperation = useCallback(async (): Promise<boolean> => {
    const securityCheck = await performSecurityCheck(true);
    if (!securityCheck.sessionValid) {
      toast({ title: "Authentication Required", description: "Please log in to continue.", variant: "destructive" });
      return false;
    }
    if (securityCheck.riskScore > 50) {
      toast({ title: "Security Check Failed", description: "This operation requires additional verification.", variant: "destructive" });
      return false;
    }
    return true;
  }, [performSecurityCheck, toast]);

  const validateAdminOperation = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const { data: userRole } = await ibmDb.rpc('get_user_role', { p_user_id: user.id });
    if (!['admin', 'super_admin'].includes(userRole as string)) {
      toast({ title: "Access Denied", description: "You don't have permission for this operation.", variant: "destructive" });
      return false;
    }
    const securityCheck = await performSecurityCheck(true);
    if (!securityCheck.sessionValid || securityCheck.riskScore > 30) {
      toast({ title: "Admin Security Check Failed", description: "Admin operations require enhanced security validation.", variant: "destructive" });
      return false;
    }
    return true;
  }, [user, performSecurityCheck, toast]);

  useEffect(() => {
    if (!user) return;
    performSecurityCheck(false);
    const interval = setInterval(() => { performSecurityCheck(false); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, performSecurityCheck]);

  return { isValidating, lastSecurityCheck, performSecurityCheck, validateCriticalOperation, validateAdminOperation, secureSignOut };
};
