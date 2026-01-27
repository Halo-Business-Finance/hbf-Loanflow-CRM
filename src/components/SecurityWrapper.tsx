import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSessionSecurity } from '@/hooks/useSessionSecurity';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface SecurityWrapperProps {
  children: React.ReactNode;
  requireRole?: string;
  fallback?: React.ReactNode;
}

export const SecurityWrapper: React.FC<SecurityWrapperProps> = ({
  children,
  requireRole,
  fallback,
}) => {
  const location = useLocation();
  const { user, hasRole, loading } = useAuth();
  const { trackActivity } = useSessionSecurity();

  // Show loading state while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="ml-3">Checking authentication...</p>
      </div>
    );
  }

  // If not authenticated, always route to sign-in (prevents blank/blocked protected pages)
  if (!user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (requireRole && !hasRole(requireRole)) {
    return (
      fallback || (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this content. Required role: {requireRole}
          </AlertDescription>
        </Alert>
      )
    );
  }

  return (
    <div onClick={trackActivity} onKeyDown={trackActivity}>
      {children}
    </div>
  );
};
