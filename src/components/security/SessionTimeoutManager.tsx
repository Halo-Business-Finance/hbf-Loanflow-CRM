import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSessionSecurity } from '@/hooks/useSessionSecurity';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface SessionTimeoutManagerProps {
  warningThreshold?: number; // minutes before timeout to show warning
  sessionDuration?: number; // total session duration in minutes
}

export const SessionTimeoutManager: React.FC<SessionTimeoutManagerProps> = ({
  warningThreshold = 5,
  sessionDuration = 30
}) => {
  const { user } = useAuth();
  const { trackActivity, secureSignOut } = useSessionSecurity();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(warningThreshold * 60);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Track user activity
  const handleActivity = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
    trackActivity();
  }, [trackActivity]);

  // Set up activity listeners
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [user, handleActivity]);

  // Session timeout management
  useEffect(() => {
    if (!user) return;

    const checkTimeout = () => {
      const timeSinceActivity = Date.now() - lastActivity;
      const warningTime = (sessionDuration - warningThreshold) * 60 * 1000;
      const logoutTime = sessionDuration * 60 * 1000;

      if (timeSinceActivity >= logoutTime) {
        // Auto logout
        toast.error('Session expired due to inactivity');
        secureSignOut();
        return;
      }

      if (timeSinceActivity >= warningTime && !showWarning) {
        // Show warning
        const remainingTime = Math.ceil((logoutTime - timeSinceActivity) / 1000);
        setTimeLeft(remainingTime);
        setShowWarning(true);
        
        toast.warning('Session expiring soon', {
          description: `Your session will expire in ${Math.ceil(remainingTime / 60)} minutes`,
          duration: 10000
        });
      }

      if (showWarning) {
        const remainingTime = Math.ceil((logoutTime - timeSinceActivity) / 1000);
        setTimeLeft(Math.max(0, remainingTime));
      }
    };

    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [user, lastActivity, sessionDuration, warningThreshold, showWarning, secureSignOut]);

  const extendSession = () => {
    handleActivity();
    setShowWarning(false);
    toast.success('Session extended');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!user || !showWarning) return null;

  const progressValue = (timeLeft / (warningThreshold * 60)) * 100;

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Session Expiring Soon
          </DialogTitle>
          <DialogDescription>
            Your session will expire due to inactivity. Please save your work and extend your session to continue.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Time remaining: {formatTime(timeLeft)}
          </div>
          
          <Progress value={progressValue} className="w-full" />
          
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={secureSignOut}>
              Sign Out
            </Button>
            <Button onClick={extendSession}>
              Extend Session
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};