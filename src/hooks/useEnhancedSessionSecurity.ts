import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';

interface SessionActivityMetrics {
  clickCount: number;
  pageViews: number;
  keyboardActivityCount: number;
  mouseActivityCount: number;
  scrollActivityCount: number;
  idleTimeSeconds: number;
  sessionDurationSeconds: number;
  riskFactors: string[];
}

interface SessionSecurityConfig {
  maxIdleTime: number;
  maxSessionDuration: number;
  riskThreshold: number;
  trackingEnabled: boolean;
}

export const useEnhancedSessionSecurity = () => {
  const { user, signOut } = useAuth();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [sessionMetrics, setSessionMetrics] = useState<SessionActivityMetrics>({
    clickCount: 0,
    pageViews: 0,
    keyboardActivityCount: 0,
    mouseActivityCount: 0,
    scrollActivityCount: 0,
    idleTimeSeconds: 0,
    sessionDurationSeconds: 0,
    riskFactors: []
  });
  const [securityConfig] = useState<SessionSecurityConfig>({
    maxIdleTime: 30 * 60, // 30 minutes
    maxSessionDuration: 8 * 60 * 60, // 8 hours
    riskThreshold: 40,
    trackingEnabled: true
  });

  // Enhanced device fingerprinting
  const generateEnhancedDeviceFingerprint = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Enhanced security fingerprint', 2, 2);
    }

    const fingerprint = {
      screen: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      canvas: canvas.toDataURL(),
      webgl: getWebGLFingerprint(),
      fonts: getAvailableFonts(),
      plugins: Array.from(navigator.plugins).map(p => p.name),
      hardwareConcurrency: navigator.hardwareConcurrency,
      memory: (navigator as any).deviceMemory || 'unknown',
      connection: getConnectionInfo(),
      battery: getBatteryInfo()
    };
    
    return btoa(JSON.stringify(fingerprint));
  }, []);

  const getWebGLFingerprint = () => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') as WebGLRenderingContext | null || 
                 canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
      if (!gl) return 'unsupported';
      
      const renderer = gl.getParameter(gl.RENDERER);
      const vendor = gl.getParameter(gl.VENDOR);
      return `${vendor}|${renderer}`;
    } catch {
      return 'error';
    }
  };

  const getAvailableFonts = () => {
    const testFonts = ['Arial', 'Times New Roman', 'Courier New', 'Helvetica', 'Georgia'];
    return testFonts.filter(font => {
      const span = document.createElement('span');
      span.style.fontFamily = font;
      span.textContent = 'test';
      document.body.appendChild(span);
      const width = span.offsetWidth;
      document.body.removeChild(span);
      return width > 0;
    });
  };

  const getConnectionInfo = () => {
    const connection = (navigator as any).connection;
    if (!connection) return {};
    
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  };

  const getBatteryInfo = async () => {
    try {
      const battery = await (navigator as any).getBattery?.();
      return battery ? {
        level: Math.round(battery.level * 100),
        charging: battery.charging
      } : {};
    } catch {
      return {};
    }
  };

  // Log detailed session activity
  const logSessionActivity = useCallback(async (activityType: string, details?: any) => {
    if (!user || !sessionToken || !securityConfig.trackingEnabled) return;

    try {
      await supabase
        .from('session_activity_log')
        .insert({
          session_id: sessionToken,
          user_id: user.id,
          activity_type: activityType,
          page_url: window.location.pathname,
          action_type: details?.actionType || 'interaction',
          element_id: details?.elementId,
          ip_address: null, // Will be set server-side
          user_agent: navigator.userAgent,
          device_fingerprint: generateEnhancedDeviceFingerprint(),
          geolocation: details?.geolocation || {},
          performance_metrics: {
            memory: (performance as any).memory || {},
            navigation: performance.getEntriesByType('navigation')[0] || {},
            connection: getConnectionInfo()
          },
          risk_indicators: sessionMetrics.riskFactors
        });
    } catch (error) {
      console.warn('Session activity logging error:', error);
    }
  }, [user, sessionToken, securityConfig.trackingEnabled, sessionMetrics.riskFactors, generateEnhancedDeviceFingerprint]);

  // Enhanced session validation with risk scoring
  const validateEnhancedSession = useCallback(async (): Promise<boolean> => {
    if (!user || !sessionToken) return false;

    try {
      const { data, error } = await supabase.rpc('validate_enhanced_session', {
        p_user_id: user.id,
        p_session_token: sessionToken,
        p_device_fingerprint: JSON.stringify({
          screen: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }),
        p_ip_address: null // Will be determined server-side
      });

      if (error) {
        console.warn('Enhanced session validation error:', error);
        return false;
      }

      const validationResult = data as any;
      if (!validationResult?.valid) {
        if (validationResult?.requires_2fa) {
          toast.warning('Additional security verification required', {
            description: 'Please verify your identity to continue',
            duration: 10000
          });
        }
        return false;
      }

      // Update session with enhanced metrics
      await supabase
        .from('active_sessions')
        .update({
          last_activity: new Date().toISOString(),
          page_url: window.location.pathname,
          referrer: document.referrer || null,
          click_count: sessionMetrics.clickCount,
          page_views: sessionMetrics.pageViews,
          keyboard_activity_count: sessionMetrics.keyboardActivityCount,
          mouse_activity_count: sessionMetrics.mouseActivityCount,
          scroll_activity_count: sessionMetrics.scrollActivityCount,
          session_duration_seconds: sessionMetrics.sessionDurationSeconds,
          risk_factors: sessionMetrics.riskFactors,
          browser_fingerprint: JSON.parse(generateEnhancedDeviceFingerprint()),
          screen_resolution: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
        .eq('session_token', sessionToken)
        .eq('user_id', user.id);

      return true;
    } catch (error) {
      console.warn('Enhanced session validation error:', error);
      return false;
    }
  }, [user, sessionToken, sessionMetrics, generateEnhancedDeviceFingerprint]);

  // Enhanced activity tracking with granular metrics
  const trackEnhancedActivity = useCallback((activityType: string, details?: any) => {
    setLastActivity(new Date());
    
    setSessionMetrics(prev => {
      const updated = { ...prev };
      
      switch (activityType) {
        case 'click':
          updated.clickCount++;
          break;
        case 'keypress':
          updated.keyboardActivityCount++;
          break;
        case 'mousemove':
          updated.mouseActivityCount++;
          break;
        case 'scroll':
          updated.scrollActivityCount++;
          break;
        case 'pageview':
          updated.pageViews++;
          break;
      }
      
      return updated;
    });

    // Log the activity
    logSessionActivity(activityType, details);
  }, [logSessionActivity]);

  // Enhanced activity listeners with detailed tracking
  useEffect(() => {
    if (!securityConfig.trackingEnabled) return;

    const events = [
      { name: 'click', type: 'click' },
      { name: 'keypress', type: 'keypress' },
      { name: 'mousemove', type: 'mousemove' },
      { name: 'scroll', type: 'scroll' },
      { name: 'focus', type: 'focus' },
      { name: 'blur', type: 'blur' },
      { name: 'beforeunload', type: 'pageview' }
    ];

    let activityTimeout: NodeJS.Timeout;
    let lastMouseMove = 0;
    
    const throttledActivity = (eventType: string) => {
      // Throttle mousemove events
      if (eventType === 'mousemove') {
        const now = Date.now();
        if (now - lastMouseMove < 1000) return;
        lastMouseMove = now;
      }
      
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => trackEnhancedActivity(eventType), 100);
    };
    
    events.forEach(({ name, type }) => {
      const handler = () => throttledActivity(type);
      document.addEventListener(name, handler, true);
    });

    return () => {
      events.forEach(({ name }) => {
        const handler = () => {};
        document.removeEventListener(name, handler, true);
      });
      clearTimeout(activityTimeout);
    };
  }, [trackEnhancedActivity, securityConfig.trackingEnabled]);

  // Cleanup session with enhanced security
  const cleanupEnhancedSession = useCallback(async () => {
    if (sessionToken && user) {
      try {
        // Log session end
        await logSessionActivity('session_end', {
          finalMetrics: sessionMetrics
        });

        // Deactivate session
        await supabase
          .from('active_sessions')
          .update({ 
            is_active: false,
            session_duration_seconds: sessionMetrics.sessionDurationSeconds
          })
          .eq('session_token', sessionToken)
          .eq('user_id', user.id);
      } catch (error) {
        console.warn('Enhanced session cleanup warning:', error);
      }
    }
    setSessionToken(null);
    setSessionMetrics({
      clickCount: 0,
      pageViews: 0,
      keyboardActivityCount: 0,
      mouseActivityCount: 0,
      scrollActivityCount: 0,
      idleTimeSeconds: 0,
      sessionDurationSeconds: 0,
      riskFactors: []
    });
  }, [sessionToken, user, sessionMetrics, logSessionActivity]);

  // Create enhanced session on login
  useEffect(() => {
    if (user && !sessionToken) {
      const token = crypto.randomUUID();
      setSessionToken(token);
      
      // Create enhanced session record
      supabase
        .from('active_sessions')
        .insert({
          user_id: user.id,
          session_token: token,
          device_fingerprint: generateEnhancedDeviceFingerprint(),
          user_agent: navigator.userAgent,
          expires_at: new Date(Date.now() + securityConfig.maxSessionDuration * 1000).toISOString(),
          browser_fingerprint: JSON.parse(generateEnhancedDeviceFingerprint()),
          screen_resolution: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
        .then(({ error }) => {
          if (error) {
            console.error('Enhanced session creation error:', error);
          } else {
            // Log session start
            logSessionActivity('session_start');
          }
        });
    }
  }, [user, sessionToken, securityConfig.maxSessionDuration, generateEnhancedDeviceFingerprint, logSessionActivity]);

  return {
    validateSession: validateEnhancedSession,
    trackActivity: trackEnhancedActivity,
    lastActivity,
    sessionMetrics,
    secureSignOut: async () => {
      await cleanupEnhancedSession();
      await signOut();
    },
    sessionToken,
    logSessionActivity
  };
};