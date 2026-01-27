import React, { useEffect } from 'react';
// import HybridLayout from '@/components/HybridLayout';
import { SecurityWrapper } from '@/components/SecurityWrapper';
import { useSessionSecurity } from '@/hooks/useSessionSecurity';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';

interface SecureLayoutProps {
  children: React.ReactNode;
  requireRole?: string;
}

export const SecureLayout: React.FC<SecureLayoutProps> = ({ children, requireRole }) => {
  const { user } = useAuth();
  const { validateSession, trackActivity } = useSessionSecurity();

  // Validate session on mount and periodically
  useEffect(() => {
    if (user) {
      const interval = setInterval(async () => {
        const isValid = await validateSession();
        // Only show error and sign out if validation explicitly fails due to expired session
        // Don't trigger on network errors or temporary issues
        if (!isValid) {
          console.warn('Session validation failed - this may be due to network issues');
          // Remove automatic sign out to prevent page refreshes
        }
      }, 10 * 60 * 1000); // Every 10 minutes

      return () => clearInterval(interval);
    }
  }, [user, validateSession]);

  // Track activity for session management
  useEffect(() => {
    const handleActivity = () => trackActivity();
    
    // Track various user interactions
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [trackActivity]);

  return (
    <SecurityWrapper requireRole={requireRole}>
      <div className="p-6">
        {children}
      </div>
    </SecurityWrapper>
  );
};