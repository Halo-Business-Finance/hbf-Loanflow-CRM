import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Shield, Eye, EyeOff, Users, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRoleBasedAccess } from '@/hooks/useRoleBasedAccess';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RoleCheck {
  name: string;
  description: string;
  hasAccess: boolean;
  route?: string;
  type: 'permission' | 'route' | 'ui';
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: string; responseTime: number; message?: string };
    authentication: { status: string; message?: string };
    sessions: { status: string; activeSessions: number; message?: string };
    storage: { status: string; message?: string };
  };
}

export default function RoleDiagnostics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    userRole,
    hasMinimumRole,
    canOriginateLoans,
    canProcessLoans,
    canFundLoans,
    canUnderwriteLoans,
    canCloseLoans,
    canAccessAdminFeatures,
    canManageUsers,
  } = useRoleBasedAccess();

  const [checks, setChecks] = useState<RoleCheck[]>([]);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [showRoleInfo, setShowRoleInfo] = useState(true);

  useEffect(() => {
    if (userRole) {
      performDiagnostics();
    }
  }, [userRole]);

  const performDiagnostics = () => {
    const diagnostics: RoleCheck[] = [
      // Permission checks
      {
        name: 'Originate Loans',
        description: 'Can create and manage new loan applications',
        hasAccess: canOriginateLoans(),
        type: 'permission',
      },
      {
        name: 'Process Loans',
        description: 'Can access loan processing features',
        hasAccess: canProcessLoans(),
        type: 'permission',
      },
      {
        name: 'Fund Loans',
        description: 'Can initiate loan funding',
        hasAccess: canFundLoans(),
        type: 'permission',
      },
      {
        name: 'Underwrite Loans',
        description: 'Can perform loan underwriting',
        hasAccess: canUnderwriteLoans(),
        type: 'permission',
      },
      {
        name: 'Close Loans',
        description: 'Can close loan deals',
        hasAccess: canCloseLoans(),
        type: 'permission',
      },
      {
        name: 'Admin Features',
        description: 'Can access admin-only features',
        hasAccess: canAccessAdminFeatures(),
        type: 'permission',
      },
      {
        name: 'Manage Users',
        description: 'Can create/edit user accounts',
        hasAccess: canManageUsers(),
        type: 'permission',
      },

      // Route checks
      {
        name: 'Loan Originator Dashboard',
        description: '/loan-originator',
        hasAccess: canOriginateLoans(),
        route: '/loan-originator',
        type: 'route',
      },
      {
        name: 'Processor Dashboard',
        description: '/dashboards/processor',
        hasAccess: canProcessLoans(),
        route: '/dashboards/processor',
        type: 'route',
      },
      {
        name: 'Underwriter Dashboard',
        description: '/dashboards/underwriter',
        hasAccess: canUnderwriteLoans(),
        route: '/dashboards/underwriter',
        type: 'route',
      },
      {
        name: 'Closer Dashboard',
        description: '/dashboards/closer',
        hasAccess: canCloseLoans(),
        route: '/dashboards/closer',
        type: 'route',
      },
      {
        name: 'Data Integrity Dashboard',
        description: '/dashboards/data-integrity',
        hasAccess: canAccessAdminFeatures(),
        route: '/dashboards/data-integrity',
        type: 'route',
      },
      {
        name: 'Security Settings',
        description: '/settings/system',
        hasAccess: canAccessAdminFeatures(),
        route: '/settings/system',
        type: 'route',
      },

      // UI element checks
      {
        name: 'Dashboard Sub-menu Visibility',
        description: 'Role-specific dashboards in sidebar',
        hasAccess: canProcessLoans() || canUnderwriteLoans() || canCloseLoans(),
        type: 'ui',
      },
      {
        name: 'Security Section Visibility',
        description: 'Security menu items in sidebar',
        hasAccess: true, // All authenticated users can see security
        type: 'ui',
      },
    ];

    setChecks(diagnostics);
  };

  const checkHealthEndpoint = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('health-check');
      
      if (error) {
        toast.error('Health check failed: ' + error.message);
        return;
      }

      setHealthStatus(data);
      toast.success('Health check completed');
    } catch (error) {
      toast.error('Failed to connect to health endpoint');
    }
  };

  const testRoute = (route: string) => {
    navigate(route);
    toast.info(`Navigating to ${route}`);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const permissionChecks = checks.filter(c => c.type === 'permission');
  const routeChecks = checks.filter(c => c.type === 'route');
  const uiChecks = checks.filter(c => c.type === 'ui');

  const passedChecks = checks.filter(c => c.hasAccess).length;
  const totalChecks = checks.length;

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Role-Based Access Diagnostics"
        subtitle="Test permissions, routes, and UI visibility"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => performDiagnostics()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => navigate('/user-directory')} variant="default" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Button>
          </div>
        }
      />
      
      <div className="container mx-auto p-8 space-y-6">
        {/* Info Alert */}
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900">
          <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <div className="flex items-center justify-between">
              <span>
                This page shows <strong>your current permissions</strong>. To assign roles or manage users, use the User Management page.
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/user-directory')}
                className="ml-4 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300"
              >
                <SettingsIcon className="h-3 w-3 mr-1" />
                Go to User Management
              </Button>
            </div>
          </AlertDescription>
        </Alert>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Current User Information
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRoleInfo(!showRoleInfo)}
            >
              {showRoleInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <CardDescription>Your authentication and role details</CardDescription>
        </CardHeader>
        {showRoleInfo && (
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="font-mono text-xs">{user?.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Role</p>
                <Badge variant={userRole === 'super_admin' ? 'destructive' : 'default'}>
                  {userRole || 'No role assigned'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Checks Passed</p>
                <p className="font-medium">
                  {passedChecks} / {totalChecks}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Permission Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Checks</CardTitle>
          <CardDescription>What actions your role allows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {permissionChecks.map((check) => (
              <div
                key={check.name}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {check.hasAccess ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium">{check.name}</p>
                    <p className="text-sm text-muted-foreground">{check.description}</p>
                  </div>
                </div>
                <Badge variant={check.hasAccess ? 'default' : 'secondary'}>
                  {check.hasAccess ? 'Granted' : 'Denied'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Route Access Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Route Access Checks</CardTitle>
          <CardDescription>Which pages you can access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {routeChecks.map((check) => (
              <div
                key={check.name}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {check.hasAccess ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium">{check.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{check.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant={check.hasAccess ? 'default' : 'secondary'}>
                    {check.hasAccess ? 'Accessible' : 'Restricted'}
                  </Badge>
                  {check.hasAccess && check.route && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testRoute(check.route!)}
                    >
                      Test
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* UI Element Checks */}
      <Card>
        <CardHeader>
          <CardTitle>UI Visibility Checks</CardTitle>
          <CardDescription>What UI elements should be visible</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {uiChecks.map((check) => (
              <div
                key={check.name}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {check.hasAccess ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium">{check.name}</p>
                    <p className="text-sm text-muted-foreground">{check.description}</p>
                  </div>
                </div>
                <Badge variant={check.hasAccess ? 'default' : 'secondary'}>
                  {check.hasAccess ? 'Visible' : 'Hidden'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Health Check */}
      <Card>
        <CardHeader>
          <CardTitle>System Health Check</CardTitle>
          <CardDescription>Verify backend services are operational</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={checkHealthEndpoint} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Run Health Check
          </Button>

          {healthStatus && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">Overall Status:</span>
                <Badge
                  variant={
                    healthStatus.status === 'healthy'
                      ? 'default'
                      : healthStatus.status === 'degraded'
                      ? 'secondary'
                      : 'destructive'
                  }
                >
                  {healthStatus.status.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(healthStatus.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {healthStatus.checks.database.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">Database</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Response: {healthStatus.checks.database.responseTime}ms
                  </p>
                </div>

                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {healthStatus.checks.authentication.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">Authentication</span>
                  </div>
                  <p className="text-sm text-muted-foreground">System auth</p>
                </div>

                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {healthStatus.checks.sessions.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="font-medium">Sessions</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Active: {healthStatus.checks.sessions.activeSessions}
                  </p>
                </div>

                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {healthStatus.checks.storage.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">Storage</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Buckets accessible</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
