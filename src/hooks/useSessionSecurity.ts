import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';
import { useZeroLocalStorage } from '@/lib/zero-localStorage-security';

interface SessionValidationResult {
  valid: boolean;
  reason: string;
  requires_reauth: boolean;
}

export const useSessionSecurity = () => {
  const { user, signOut } = useAuth();
  const { auditLocalStorage } = useZeroLocalStorage();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());

  // Cleanup session on logout
  const cleanupSession = useCallback(async () => {
    if (sessionToken && user) {
      try {
        await supabase
          .from('active_sessions')
          .update({ is_active: false })
          .eq('session_token', sessionToken)
          .eq('user_id', user.id);
      } catch (error) {
        // Silently handle cleanup errors - don't prevent signout
        console.warn('Session cleanup warning:', error);
      }
    }
    setSessionToken(null);
  }, [sessionToken, user]);

  // Enhanced logout with session cleanup
  const secureSignOut = useCallback(async () => {
    try {
      await cleanupSession();
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      // Force cleanup even if there's an error
      setSessionToken(null);
      // Still attempt to sign out from Supabase auth
      try {
        await signOut();
      } catch (authError) {
        console.error('Auth sign out error:', authError);
        // Even if auth signout fails, we've cleaned up our session
      }
    }
  }, [cleanupSession, signOut]);

  // Generate session token on login with localStorage audit
  useEffect(() => {
    if (user && !sessionToken) {
      // Audit and clean localStorage on session start
      auditLocalStorage();
      
      const token = crypto.randomUUID();
      setSessionToken(token);
      
      // Create session record with enhanced security
      supabase
        .from('active_sessions')
        .insert({
          user_id: user.id,
          session_token: token,
          device_fingerprint: generateDeviceFingerprint(),
          user_agent: navigator.userAgent,
          expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours
          ip_address: null, // Will be updated on first validation
          browser_fingerprint: generateDeviceFingerprint(),
          screen_resolution: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
        .then(({ error }) => {
          if (error) {
            console.error('Session creation error:', error);
          } else {
            // Log session start with security audit
            supabase
              .from('security_events')
              .insert({
                event_type: 'secure_session_started',
                severity: 'low',
                details: {
                  localStorage_cleaned: true,
                  enhanced_tracking: true,
                  timestamp: new Date().toISOString()
                }
              });
          }
        });
    }
  }, [user, sessionToken, auditLocalStorage]);

  // Generate device fingerprint
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
      
      const fingerprint = {
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        canvas: canvasData
      };
      
      return btoa(JSON.stringify(fingerprint));
    } catch (error) {
      return btoa(JSON.stringify({
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }));
    }
  }, []);

  // Enhanced session validation with security checks
  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!user || !sessionToken) return false;

    try {
      // Use simplified validation approach without external IP lookup
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) {
        console.warn('Session validation error:', error);
        // Don't show toast for validation errors during periodic checks
        return false;
      }

      if (!data) {
        // Session not found or expired - only show toast for user-initiated actions
        console.warn('Session not found or expired');
        return false;
      }

      // Update last activity with comprehensive monitoring
      await supabase
        .from('active_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          user_agent: navigator.userAgent,
          page_url: window.location.pathname,
          referrer: document.referrer || null,
          last_security_check: new Date().toISOString()
        })
        .eq('id', data.id);

      // Periodic localStorage audit during session
      if (Math.random() < 0.1) { // 10% chance to audit
        auditLocalStorage();
      }

      return true;
    } catch (error) {
      console.warn('Session validation error:', error);
      // Don't show error toasts for periodic validation failures
      return false;
    }
  }, [user, sessionToken]);

  // Track user activity
  const trackActivity = useCallback(() => {
    setLastActivity(new Date());
  }, []);

  // Enhanced activity tracking with throttling
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'focus', 'blur'];
    let activityTimeout: NodeJS.Timeout;
    
    const throttledActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(trackActivity, 1000); // Throttle to once per second
    };
    
    events.forEach(event => {
      document.addEventListener(event, throttledActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledActivity, true);
      });
      clearTimeout(activityTimeout);
    };
  }, [trackActivity]);

  // Periodic session validation
  useEffect(() => {
    if (!user || !sessionToken) return;

    const interval = setInterval(() => {
      validateSession();
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [user, sessionToken, validateSession]);

  // Session timeout warning
  useEffect(() => {
    if (!user) return;

    const timeoutWarning = setTimeout(() => {
      toast.warning('Your session will expire soon. Please save your work.', {
        duration: 10000,
        action: {
          label: 'Extend Session',
          onClick: () => trackActivity()
        }
      });
    }, 25 * 60 * 1000); // Warn 5 minutes before 30-minute timeout

    return () => clearTimeout(timeoutWarning);
  }, [lastActivity, user, trackActivity]);


  return {
    validateSession,
    trackActivity,
    lastActivity,
    secureSignOut,
    sessionToken
  };
};