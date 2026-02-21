import { useState, useCallback } from 'react';
import { ibmDb } from '@/lib/ibm';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast as toastFn } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface SecurityValidation {
  isValid: boolean;
  errors: string[];
  riskScore: number;
}

interface SessionSecurity {
  sessionValid: boolean;
  requiresReauth: boolean;
  riskFactors: string[];
}

export const useSecurityValidation = () => {
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(false);

  const validateInput = useCallback(async (inputData: Record<string, any>): Promise<SecurityValidation> => {
    try {
      setIsValidating(true);
      const { data, error } = await ibmDb.rpc('validate_secure_input', { input_data: inputData });
      if (error) {
        logger.error('Security validation error:', error);
        return { isValid: false, errors: ['Security validation failed'], riskScore: 100 };
      }
      return {
        isValid: (data as any)?.valid || false,
        errors: (data as any)?.errors || [],
        riskScore: ((data as any)?.errors?.length || 0) * 25
      };
    } catch (error) {
      logger.error('Input validation error:', error);
      return { isValid: false, errors: ['Validation system error'], riskScore: 100 };
    } finally {
      setIsValidating(false);
    }
  }, []);

  const validateSession = useCallback(async (): Promise<SessionSecurity> => {
    if (!user) {
      return { sessionValid: false, requiresReauth: true, riskFactors: ['No active session'] };
    }
    try {
      const userAgent = navigator.userAgent;
      const { data, error } = await ibmDb.rpc('validate_session_security', {
        p_user_id: user.id,
        p_session_token: 'current_session',
        p_ip_address: '127.0.0.1',
        p_user_agent: userAgent
      });
      if (error || !data) {
        return { sessionValid: false, requiresReauth: true, riskFactors: ['Session validation failed'] };
      }
      return {
        sessionValid: (data as any)?.valid || false,
        requiresReauth: (data as any)?.requires_reauth || false,
        riskFactors: (data as any)?.risk_factors || []
      };
    } catch (error) {
      logger.error('Session validation error:', error);
      return { sessionValid: false, requiresReauth: true, riskFactors: ['System error during validation'] };
    }
  }, [user]);

  const validateSecureForm = useCallback(async (formData: Record<string, any>): Promise<{
    isValid: boolean;
    errors: Record<string, string[]>;
    securityIssues: string[];
  }> => {
    const result = { isValid: true, errors: {} as Record<string, string[]>, securityIssues: [] as string[] };

    for (const [field, value] of Object.entries(formData)) {
      if (typeof value === 'string') {
        if (!value.trim()) {
          if (!result.errors[field]) result.errors[field] = [];
          result.errors[field].push(`${field} is required`);
          result.isValid = false;
        }
        if (field.includes('email') && value) {
          const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
          if (!emailRegex.test(value)) {
            if (!result.errors[field]) result.errors[field] = [];
            result.errors[field].push('Invalid email format');
            result.isValid = false;
          }
        }
        if (field.includes('phone') && value) {
          const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
          if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
            if (!result.errors[field]) result.errors[field] = [];
            result.errors[field].push('Invalid phone number format');
            result.isValid = false;
          }
        }
      }
    }

    const securityCheck = await validateInput(formData);
    if (!securityCheck.isValid) {
      result.securityIssues = securityCheck.errors;
      result.isValid = false;
    }

    return result;
  }, [validateInput]);

  const generateDeviceFingerprint = useCallback((): string => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let canvasData = '';
      if (ctx) {
        try {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('Device fingerprint', 2, 2);
          canvasData = canvas.toDataURL();
        } catch (e) {
          canvasData = 'canvas-unavailable';
        }
      }
      const fingerprint = [
        navigator.userAgent, navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage, !!window.localStorage, canvasData
      ].join('|');
      return btoa(fingerprint).slice(0, 32);
    } catch (error) {
      return btoa([navigator.userAgent, navigator.language, Date.now().toString()].join('|')).slice(0, 32);
    }
  }, []);

  const handleSecurityAlert = useCallback((alertType: string, details: any) => {
    logger.secureLog('Security Alert', alertType);
    
    ibmDb.rpc('security-monitor', {
      alert_type: alertType,
      details,
      timestamp: new Date().toISOString(),
      user_id: user?.id
    }).catch(error => {
      logger.error('Failed to log security alert:', error);
    });

    if (['session_hijack', 'injection_attempt', 'data_breach'].includes(alertType)) {
      toastFn({ title: "Security Alert", description: "Suspicious activity detected. Please verify your identity.", variant: "destructive" });
    }
  }, [user]);

  return { validateInput, validateSession, validateSecureForm, generateDeviceFingerprint, handleSecurityAlert, isValidating };
};
