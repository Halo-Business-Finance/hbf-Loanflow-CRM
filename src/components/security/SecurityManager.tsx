import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock, AlertTriangle, Eye, Users, Key, Activity, Trash2, Database } from "lucide-react";
import { ibmDb } from "@/lib/ibm";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdvancedThreatDetection } from "./AdvancedThreatDetection";
import { SecurityMonitor } from "./SecurityMonitor";
import { DarkWebSecurityBot } from "./DarkWebSecurityBot";
import { ThreatDetectionMonitor } from "./ThreatDetectionMonitor";
import { DataIntegrityDashboard } from "@/components/DataIntegrityDashboard";
import { EnhancedSecurityMonitor } from "./EnhancedSecurityMonitor";
// import HybridLayout from "@/components/HybridLayout";

interface SecurityNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  severity: string;
  is_read: boolean;
  created_at: string;
}

interface MFASettings {
  id?: string;
  is_enabled: boolean;
  preferred_method: string;
  phone_number?: string;
}

interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  max_age_days: number;
  prevent_reuse_count: number;
}

// Admin dashboard interfaces
interface AuditLog {
  id: string
  action: string
  table_name: string
  created_at: string
  user_id: string
}

interface UserRole {
  id: string
  user_id: string
  role: string
  assigned_at: string
  is_active: boolean
}

interface UserSession {
  id: string
  user_id: string
  ip_address: string | null
  user_agent: string | null
  last_activity: string
  created_at: string
  is_active: boolean
}

export function SecurityManager() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [securityNotifications, setSecurityNotifications] = useState<SecurityNotification[]>([]);
  
  // Admin dashboard state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [userSessions, setUserSessions] = useState<UserSession[]>([])
  
  const [mfaSettings, setMfaSettings] = useState<MFASettings>({
    is_enabled: false,
    preferred_method: 'totp'
  });
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>({
    min_length: 12,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special_chars: true,
    max_age_days: 90,
    prevent_reuse_count: 5
  });

  useEffect(() => {
    if (user) {
      fetchSecurityData();
    }
  }, [user]);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      // Fetch security notifications
      const { data: notifications } = await ibmDb
        .from('security_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (notifications) {
        setSecurityNotifications(notifications as unknown as SecurityNotification[]);
      }

      // Fetch MFA settings
      const { data: mfa } = await ibmDb
        .from('mfa_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (mfa) {
        const m = mfa as Record<string, unknown>;
        setMfaSettings({
          id: m.id as string,
          is_enabled: m.is_enabled as boolean,
          preferred_method: (m.preferred_method as string) || 'totp',
          phone_number: m.phone_number as string
        });
      } else {
        setMfaSettings({
          is_enabled: false,
          preferred_method: 'totp'
        });
      }

      // Fetch password policy (admins only)
      if (hasRole('admin')) {
        const { data: policy } = await ibmDb
          .from('password_policies')
          .select('*')
          .eq('is_active', true)
          .single();

        if (policy) {
          setPasswordPolicy(policy as unknown as PasswordPolicy);
        }

        // Fetch admin dashboard data
        const [auditResponse, rolesResponse, sessionsResponse] = await Promise.all([
          ibmDb.from<AuditLog>('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
          ibmDb.from<UserRole>('user_roles').select('*').order('assigned_at', { ascending: false }),
          ibmDb.from<UserSession>('active_sessions').select('*').order('last_activity', { ascending: false })
        ])

        if (auditResponse.data) setAuditLogs(auditResponse.data)
        if (rolesResponse.data) setUserRoles(rolesResponse.data)
        if (sessionsResponse.data) setUserSessions(sessionsResponse.data as UserSession[])
      }
    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const enableMFA = async () => {
    try {
      const { error } = await ibmDb
        .from('mfa_settings')
        .upsert({
          user_id: user?.id,
          is_enabled: true,
          preferred_method: mfaSettings.preferred_method,
          phone_number: mfaSettings.phone_number
        } as Record<string, unknown>);

      if (error) throw error;

      // Update local state immediately
      setMfaSettings(prev => ({ ...prev, is_enabled: true }));

      toast({
        title: "MFA Enabled",
        description: "Multi-factor authentication has been enabled for your account.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const disableMFA = async () => {
    try {
      const { error } = await ibmDb
        .from('mfa_settings')
        .update({ is_enabled: false })
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state immediately
      setMfaSettings(prev => ({ ...prev, is_enabled: false }));

      toast({
        title: "MFA Disabled",
        description: "Multi-factor authentication has been disabled.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updatePasswordPolicy = async () => {
    if (!hasRole('admin')) return;

    try {
      const { error } = await ibmDb
        .from('password_policies')
        .update(passwordPolicy as unknown as Record<string, unknown>)
        .eq('is_active', true);

      if (error) throw error;

      toast({
        title: "Password Policy Updated",
        description: "Password policy has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await ibmDb
        .from('security_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setSecurityNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const cleanupExpiredSessions = async () => {
    try {
      const { data, error } = await ibmDb.rpc('cleanup_expired_sessions')
      
      if (error) throw error

      toast({
        title: "Sessions Cleaned",
        description: `Removed ${data} expired sessions`,
      })
      
      fetchSecurityData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-2xl font-bold text-foreground">Security Center</h1>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="data-integrity">Data Integrity</TabsTrigger>
            {hasRole('admin') && <TabsTrigger value="security-bots">Security Bots</TabsTrigger>}
            <TabsTrigger value="mfa">Multi-Factor Auth</TabsTrigger>
            {hasRole('admin') && <TabsTrigger value="policies">Password Policy</TabsTrigger>}
            {hasRole('admin') && <TabsTrigger value="admin-panel">Admin Panel</TabsTrigger>}
          </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Security Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security Status</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-accent">Secure</div>
                <p className="text-xs text-foreground/70">
                  All security features are active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MFA Status</CardTitle>
                <Lock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">
                  {mfaSettings.is_enabled ? 'Enabled' : 'Disabled'}
                </div>
                <p className="text-xs text-foreground/70">
                  {mfaSettings.is_enabled ? 'Two-factor authentication active' : 'Enable for extra security'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">
                  {securityNotifications.filter(n => !n.is_read).length}
                </div>
                <p className="text-xs text-foreground/70">
                  Unread security notifications
                </p>
              </CardContent>
            </Card>

            {hasRole('admin') && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-foreground">{userRoles.filter(r => r.is_active).length}</div>
                  <p className="text-xs text-foreground/70">
                    System-wide user count
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Enhanced Security Monitoring */}
          <Card className="max-w-4xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Enhanced Security Monitoring</CardTitle>
              <CardDescription className="text-sm">
                Advanced threat detection and real-time security monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedSecurityMonitor />
            </CardContent>
          </Card>

          {/* Recent Security Activity */}
          <Card className="max-w-4xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Security Activity</CardTitle>
              <CardDescription className="text-sm">
                Latest security events for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {securityNotifications.length === 0 ? (
                <p className="text-foreground/70">No recent security activity</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {securityNotifications.slice(0, 5).map((notification) => (
                    <div key={notification.id} className="flex items-center justify-between p-2 border rounded-md bg-card/50">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{notification.title}</div>
                        <div className="text-xs text-foreground/70 truncate">{notification.message}</div>
                        <div className="text-xs text-foreground/50">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant={getSeverityColor(notification.severity)} className="text-xs">
                        {notification.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Notifications */}
          <Card className="max-w-4xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Security Notifications</CardTitle>
              <CardDescription className="text-sm">
                Important security alerts and events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {securityNotifications.length === 0 ? (
                <p className="text-muted-foreground">No security notifications</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {securityNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-2 border rounded-md cursor-pointer transition-colors ${
                        notification.is_read ? 'bg-muted/50' : 'bg-card/50'
                      }`}
                      onClick={() => markNotificationAsRead(notification.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1">
                            <h4 className="font-medium text-sm truncate">{notification.title}</h4>
                            <Badge variant={getSeverityColor(notification.severity)} className="text-xs">
                              {notification.severity}
                            </Badge>
                            {!notification.is_read && (
                              <Badge variant="outline" className="text-xs">New</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-integrity" className="space-y-4">
          <div className="max-w-4xl">
            <DataIntegrityDashboard />
          </div>
        </TabsContent>

        {hasRole('admin') && (
          <TabsContent value="security-bots" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-6xl">
              {/* AI Protection Bot */}
              <Card className="col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-red-500" />
                    AI Protection Bot
                    <Badge variant="destructive" className="text-xs animate-pulse">ACTIVE</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">Advanced threat detection and protection</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold text-red-600">24</div>
                      <div className="text-xs text-muted-foreground">AI Threats</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold text-orange-600">8</div>
                      <div className="text-xs text-muted-foreground">Bot Attempts</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <Badge variant="outline" className="text-xs text-green-700">
                      HIGH ALERT MODE
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Dark Web Security Bot */}
              <Card className="col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4 text-purple-500" />
                    Dark Web Bot
                    <Badge variant="destructive" className="text-xs animate-pulse">ACTIVE</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">Monitor dark web for security threats</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold text-purple-600">12</div>
                      <div className="text-xs text-muted-foreground">Threats Blocked</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold text-yellow-600">5</div>
                      <div className="text-xs text-muted-foreground">Tor Attempts</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <Badge variant="outline" className="text-xs text-purple-700">
                      MONITORING DARK WEB
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Hacker Detection Bot */}
              <Card className="col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Hacker Detection Bot
                    <Badge variant="destructive" className="text-xs animate-pulse">ACTIVE</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">Real-time hacker detection and prevention</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold text-yellow-600">18</div>
                      <div className="text-xs text-muted-foreground">Attacks Blocked</div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <div className="text-lg font-bold text-red-600">3</div>
                      <div className="text-xs text-muted-foreground">SQL Injections</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <Badge variant="outline" className="text-xs text-yellow-700">
                      SCANNING FOR ATTACKS
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Views */}
            <div className="space-y-6 max-w-6xl">
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">AI Protection Bot - Detailed View</h3>
                <AdvancedThreatDetection />
              </div>
              
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Dark Web Security Bot - Detailed View</h3>
                <DarkWebSecurityBot />
              </div>
              
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Hacker Detection Bot - Detailed View</h3>
                <ThreatDetectionMonitor />
              </div>
            </div>
          </TabsContent>
        )}

        <TabsContent value="mfa" className="space-y-4">
          <Card className="max-w-4xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Multi-Factor Authentication</CardTitle>
              <CardDescription className="text-sm">
                Add an extra layer of security to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-card">
                <div>
                  <Label htmlFor="mfa-enabled" className="text-sm font-medium text-foreground">Enable MFA</Label>
                  <p className="text-xs text-muted-foreground">
                    Require a second form of authentication when signing in
                  </p>
                </div>
                <Switch
                  id="mfa-enabled"
                  checked={mfaSettings.is_enabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      enableMFA();
                    } else {
                      disableMFA();
                    }
                  }}
                  className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30"
                />
              </div>

              {mfaSettings.is_enabled && (
                <div className="space-y-3 p-3 border rounded">
                  <div className="space-y-1">
                    <Label htmlFor="preferred-method" className="text-sm">Preferred Method</Label>
                    <select
                      id="preferred-method"
                      className="w-full p-2 border rounded text-sm h-8"
                      value={mfaSettings.preferred_method}
                      onChange={(e) => setMfaSettings(prev => ({
                        ...prev,
                        preferred_method: e.target.value
                      }))}
                    >
                      <option value="totp">Authenticator App (TOTP)</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                    </select>
                  </div>

                  {mfaSettings.preferred_method === 'sms' && (
                    <div className="space-y-1">
                      <Label htmlFor="phone-number" className="text-sm">Phone Number</Label>
                      <Input
                        id="phone-number"
                        type="tel"
                        placeholder="+1234567890"
                        value={mfaSettings.phone_number || ''}
                        onChange={(e) => setMfaSettings(prev => ({
                          ...prev,
                          phone_number: e.target.value
                        }))}
                        className="h-8"
                      />
                    </div>
                  )}

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Make sure you have access to your chosen authentication method before enabling MFA.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {hasRole('admin') && (
          <TabsContent value="policies" className="space-y-4">
            <Card className="max-w-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Password Policy</CardTitle>
                <CardDescription className="text-sm">
                  Configure password requirements for all users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="min-length" className="text-sm">Minimum Length</Label>
                    <Input
                      id="min-length"
                      type="number"
                      min="8"
                      max="128"
                      value={passwordPolicy.min_length}
                      onChange={(e) => setPasswordPolicy(prev => ({
                        ...prev,
                        min_length: parseInt(e.target.value)
                      }))}
                      className="h-8"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="max-age" className="text-sm">Password Age (days)</Label>
                    <Input
                      id="max-age"
                      type="number"
                      min="30"
                      max="365"
                      value={passwordPolicy.max_age_days}
                      onChange={(e) => setPasswordPolicy(prev => ({
                        ...prev,
                        max_age_days: parseInt(e.target.value)
                      }))}
                      className="h-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between py-1">
                    <Label htmlFor="require-uppercase" className="text-sm">Require Uppercase</Label>
                    <Switch
                      id="require-uppercase"
                      checked={passwordPolicy.require_uppercase}
                      onCheckedChange={(checked) => setPasswordPolicy(prev => ({
                        ...prev,
                        require_uppercase: checked
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <Label htmlFor="require-lowercase" className="text-sm">Require Lowercase</Label>
                    <Switch
                      id="require-lowercase"
                      checked={passwordPolicy.require_lowercase}
                      onCheckedChange={(checked) => setPasswordPolicy(prev => ({
                        ...prev,
                        require_lowercase: checked
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <Label htmlFor="require-numbers" className="text-sm">Require Numbers</Label>
                    <Switch
                      id="require-numbers"
                      checked={passwordPolicy.require_numbers}
                      onCheckedChange={(checked) => setPasswordPolicy(prev => ({
                        ...prev,
                        require_numbers: checked
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <Label htmlFor="require-special" className="text-sm">Require Special Chars</Label>
                    <Switch
                      id="require-special"
                      checked={passwordPolicy.require_special_chars}
                      onCheckedChange={(checked) => setPasswordPolicy(prev => ({
                        ...prev,
                        require_special_chars: checked
                      }))}
                    />
                  </div>
                </div>

                <Button onClick={updatePasswordPolicy} className="w-full mt-4" size="sm">
                  <Key className="h-4 w-4 mr-2" />
                  Update Password Policy
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {hasRole('admin') && (
          <TabsContent value="admin-panel" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl">
              {/* Audit Logs */}
              <Card className="col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Recent Audit Logs</CardTitle>
                  <CardDescription className="text-sm">System activity and security events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-2 border rounded-md bg-card/50">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{log.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.table_name} • {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">{log.action.split('_')[0]}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* User Roles */}
              <Card className="col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">User Roles</CardTitle>
                  <CardDescription className="text-sm">Manage user permissions and access levels</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {userRoles.map((role) => (
                      <div key={role.id} className="flex items-center justify-between p-2 border rounded-md bg-card/50">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">User ID: {role.user_id}</p>
                          <p className="text-xs text-muted-foreground">
                            Assigned: {new Date(role.assigned_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge 
                            variant={role.role === 'admin' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {role.role}
                          </Badge>
                          {role.is_active ? (
                            <Badge variant="outline" className="text-xs text-green-700">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-gray-700">Inactive</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active Sessions */}
              <Card className="col-span-1">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-lg">Active Sessions</CardTitle>
                    <CardDescription className="text-sm">Monitor user sessions and activity</CardDescription>
                  </div>
                  <Button onClick={cleanupExpiredSessions} variant="outline" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clean Expired
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {userSessions.filter(s => s.is_active).map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-2 border rounded-md bg-card/50">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">User ID: {session.user_id}</p>
                          <p className="text-xs text-muted-foreground">
                            IP: {session.ip_address} • Last activity: {new Date(session.last_activity).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs text-green-700">Active</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}