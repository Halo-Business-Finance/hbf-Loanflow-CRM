import { useAuth } from '@/components/auth/AuthProvider';
import { useCallback } from 'react';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'loan_originator' | 'loan_processor' | 'funder' | 'underwriter' | 'closer' | 'tech';

interface RoleHierarchy {
  [key: string]: number;
}

const ROLE_HIERARCHY: RoleHierarchy = {
  'tech': 0,
  'closer': 1,
  'underwriter': 1,
  'funder': 1,
  'loan_processor': 1,
  'loan_originator': 1,
  
  'manager': 2,
  'admin': 3,
  'super_admin': 4
};

export const useRoleBasedAccess = () => {
  const { hasRole, userRole } = useAuth();

  const hasMinimumRole = useCallback((requiredRole: UserRole): boolean => {
    if (!userRole) return false;
    
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  }, [userRole]);

  const canAccessLeads = useCallback((): boolean => {
    if (!userRole) return false;
    // All roles except tech can access leads
    return userRole !== 'tech';
  }, [userRole]);

  const canManageUsers = useCallback((): boolean => {
    return hasMinimumRole('admin');
  }, [hasMinimumRole]);

  const canAccessAdminFeatures = useCallback((): boolean => {
    return hasMinimumRole('admin');
  }, [hasMinimumRole]);

  const canModifySystemSettings = useCallback((): boolean => {
    return hasMinimumRole('super_admin');
  }, [hasMinimumRole]);

  const canDeleteLeads = useCallback((): boolean => {
    // Admins and super_admins can delete all leads
    return hasMinimumRole('admin');
  }, [hasMinimumRole]);

  const canViewReports = useCallback((): boolean => {
    return hasMinimumRole('loan_originator');
  }, [hasMinimumRole]);

  const canManageClients = useCallback((): boolean => {
    return hasMinimumRole('loan_originator');
  }, [hasMinimumRole]);

  // Loan-specific role permissions
  const canOriginateLoans = useCallback((): boolean => {
    return hasRole('loan_originator') || hasMinimumRole('manager');
  }, [hasRole, hasMinimumRole]);

  const canProcessLoans = useCallback((): boolean => {
    return hasRole('loan_processor') || hasMinimumRole('manager');
  }, [hasRole, hasMinimumRole]);

  const canFundLoans = useCallback((): boolean => {
    return hasRole('funder') || hasMinimumRole('admin');
  }, [hasRole, hasMinimumRole]);

  const canUnderwriteLoans = useCallback((): boolean => {
    return hasRole('underwriter') || hasMinimumRole('manager');
  }, [hasRole, hasMinimumRole]);

  const canCloseLoans = useCallback((): boolean => {
    return hasRole('closer') || hasMinimumRole('manager');
  }, [hasRole, hasMinimumRole]);

  return {
    userRole,
    hasRole,
    hasMinimumRole,
    canAccessLeads,
    canManageUsers,
    canAccessAdminFeatures,
    canModifySystemSettings,
    canDeleteLeads,
    canViewReports,
    canManageClients,
    canOriginateLoans,
    canProcessLoans,
    canFundLoans,
    canUnderwriteLoans,
    canCloseLoans
  };
};