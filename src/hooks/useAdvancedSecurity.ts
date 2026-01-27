import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

interface RateLimitResult {
  allowed: boolean;
  attempts_remaining: number;
  reset_time: string;
}

interface SecurityEventParams {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export const useAdvancedSecurity = () => {
  const { user } = useAuth();

  // Enhanced rate limiting with secure database tracking
  const checkRateLimit = useCallback(async (
    action: string, 
    maxAttempts: number = 5, 
    windowMinutes: number = 15
  ): Promise<RateLimitResult> => {
    try {
      const { data, error } = await supabase.rpc('check_user_rate_limit_secure', {
        p_action_type: action,
        p_max_attempts: maxAttempts,
        p_window_minutes: windowMinutes
      });

      if (error) throw error;

      return data as unknown as RateLimitResult;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: false, attempts_remaining: 0, reset_time: new Date().toISOString() };
    }
  }, []);

  // Create security alerts
  const createSecurityAlert = useCallback(async (
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    description: string,
    metadata: any = {}
  ) => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .insert({
          alert_type: alertType,
          severity,
          title,
          description,
          user_id: user?.id,
          metadata
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to create security alert:', error);
    }
  }, [user?.id]);

  // Log session anomalies
  const logSessionAnomaly = useCallback(async (
    anomalyType: string,
    riskScore: number,
    details: any = {}
  ) => {
    try {
      const { error } = await supabase
        .from('session_anomalies')
        .insert({
          user_id: user?.id,
          session_token: sessionStorage.getItem('session_token') || 'unknown',
          anomaly_type: anomalyType,
          risk_score: riskScore,
          details
        });

      if (error) throw error;

      // Auto-create alert for high-risk anomalies
      if (riskScore > 70) {
        await createSecurityAlert(
          'session_anomaly',
          riskScore > 90 ? 'critical' : 'high',
          `Session Anomaly: ${anomalyType}`,
          `High-risk session activity detected with score ${riskScore}`,
          { anomaly_type: anomalyType, risk_score: riskScore }
        );
      }
    } catch (error) {
      console.error('Failed to log session anomaly:', error);
    }
  }, [user?.id, createSecurityAlert]);

  // Enhanced input validation with XSS protection
  const validateInput = useCallback(async (
    input: string,
    fieldType: 'text' | 'email' | 'phone' | 'numeric' | 'url' = 'text',
    maxLength: number = 255,
    allowHtml: boolean = false
  ) => {
    try {
      const { data, error } = await supabase.rpc('validate_and_sanitize_input_enhanced', {
        p_input: input,
        p_field_type: fieldType,
        p_max_length: maxLength,
        p_allow_html: allowHtml
      });

      if (error) throw error;

      // Log suspicious input attempts
      const validationResult = data as any;
      if (!validationResult.valid && validationResult.errors?.some((err: string) => 
        err.includes('malicious') || err.includes('injection')
      )) {
        await createSecurityAlert(
          'malicious_input_attempt',
          'high',
          'Malicious Input Detected',
          `Potentially dangerous input was blocked: ${input.substring(0, 50)}...`,
          { input: input.substring(0, 100), field_type: fieldType }
        );
      }

      return validationResult;
    } catch (error) {
      console.error('Input validation failed:', error);
      return { valid: false, sanitized: null, errors: ['Validation service unavailable'] };
    }
  }, [createSecurityAlert]);

  // Monitor for suspicious patterns
  useEffect(() => {
    if (!user) return;

    let rapidClickCount = 0;
    let rapidClickTimer: NodeJS.Timeout;

    const monitorRapidClicks = () => {
      rapidClickCount++;
      
      if (rapidClickCount === 1) {
        rapidClickTimer = setTimeout(() => {
          rapidClickCount = 0;
        }, 5000);
      }
      
      if (rapidClickCount > 20) {
        logSessionAnomaly('rapid_clicking', 60, {
          click_count: rapidClickCount,
          timeframe: '5_seconds'
        });
        rapidClickCount = 0;
      }
    };

    const monitorTabVisibility = () => {
      if (document.hidden) {
        logSessionAnomaly('tab_hidden_during_session', 20, {
          timestamp: new Date().toISOString()
        });
      }
    };

    const monitorDevTools = () => {
      const threshold = 160;
      if (window.outerHeight - window.innerHeight > threshold ||
          window.outerWidth - window.innerWidth > threshold) {
        logSessionAnomaly('devtools_detected', 40, {
          window_dimensions: {
            outer: { width: window.outerWidth, height: window.outerHeight },
            inner: { width: window.innerWidth, height: window.innerHeight }
          }
        });
      }
    };

    document.addEventListener('click', monitorRapidClicks);
    document.addEventListener('visibilitychange', monitorTabVisibility);
    
    const devToolsInterval = setInterval(monitorDevTools, 10000);

    return () => {
      document.removeEventListener('click', monitorRapidClicks);
      document.removeEventListener('visibilitychange', monitorTabVisibility);
      clearInterval(devToolsInterval);
      clearTimeout(rapidClickTimer);
    };
  }, [user, logSessionAnomaly]);

  return {
    checkRateLimit,
    createSecurityAlert,
    logSessionAnomaly,
    validateInput
  };
};