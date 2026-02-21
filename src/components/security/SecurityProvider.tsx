import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSessionSecurity } from '@/hooks/useSessionSecurity';
import { ibmDb } from '@/lib/ibm';
import { toast } from 'sonner';

interface SecurityContextType {
  isSecurityMonitoring: boolean;
  securityLevel: 'low' | 'medium' | 'high' | 'critical';
  enableSecurityMonitoring: () => void;
  disableSecurityMonitoring: () => void;
  reportSecurityEvent: (eventType: string, severity: string, details?: any) => Promise<void>;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export const useSecurityContext = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within SecurityProvider');
  }
  return context;
};

interface SecurityProviderProps {
  children: React.ReactNode;
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { validateSession, trackActivity } = useSessionSecurity();
  const [isSecurityMonitoring, setIsSecurityMonitoring] = useState(true);
  const [securityLevel, setSecurityLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [activityBuffer, setActivityBuffer] = useState<number[]>([]);

  // Monitor for suspicious activities using in-memory state instead of localStorage
  useEffect(() => {
    if (!isSecurityMonitoring) return;

    const handleSuspiciousActivity = (event: Event) => {
      // Track activity using session security hook (server-side validation)
      trackActivity();
      
      // Monitor for rapid clicks using in-memory buffer
      const now = Date.now();
      
      setActivityBuffer(prev => {
        const recent = [...prev, now].filter(time => now - time < 1000); // Keep last second
        
        // Check for suspicious rapid activity (more than 10 actions per second)
        if (recent.length > 10) {
          reportSecurityEvent('rapid_user_actions', 'medium', {
            actions_per_second: recent.length,
            event_type: event.type
          });
        }
        
        return recent;
      });
    };

    const events = ['click', 'keydown', 'submit'];
    events.forEach(eventType => {
      document.addEventListener(eventType, handleSuspiciousActivity);
    });

    return () => {
      events.forEach(eventType => {
        document.removeEventListener(eventType, handleSuspiciousActivity);
      });
    };
  }, [isSecurityMonitoring, trackActivity]);

  const enableSecurityMonitoring = () => {
    setIsSecurityMonitoring(true);
    toast.success('Security monitoring enabled');
  };

  const disableSecurityMonitoring = () => {
    setIsSecurityMonitoring(false);
    toast.warning('Security monitoring disabled');
  };

  const reportSecurityEvent = async (eventType: string, severity: string, details?: any) => {
    try {
      await ibmDb.rpc('log_security_event', {
        p_user_id: user?.id,
        p_event_type: eventType,
        p_severity: severity,
        p_details: details || {}
      });

      // Adjust security level based on event severity
      if (severity === 'critical') {
        setSecurityLevel('critical');
        toast.error('Critical security event detected');
      } else if (severity === 'high') {
        setSecurityLevel('high');
        toast.warning('High priority security event detected');
      }
    } catch (error) {
      console.error('Failed to report security event:', error);
    }
  };

  const value: SecurityContextType = {
    isSecurityMonitoring,
    securityLevel,
    enableSecurityMonitoring,
    disableSecurityMonitoring,
    reportSecurityEvent
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};