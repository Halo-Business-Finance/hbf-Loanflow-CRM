import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Monitor, 
  Smartphone, 
  Clock, 
  MapPin, 
  AlertTriangle,
  Shield,
  UserX,
  RefreshCw
} from "lucide-react";
import { ibmDb } from "@/lib/ibm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SessionData {
  id: string;
  user_id: string;
  device_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  screen_resolution?: string;
  timezone?: string;
  language?: string;
  last_activity: string;
  session_start?: string;
  expires_at: string;
  concurrent_session_count?: number;
  is_active: boolean;
}

interface RoleConfig {
  role: string;
  timeout_minutes: number;
  max_concurrent_sessions: number;
  require_2fa: boolean;
}

interface ValidationResult {
  valid: boolean;
  reason: string;
  requires_2fa?: boolean;
}

export function AdvancedSessionManager() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSessionData();
    
    // Set up real-time subscription for session changes
    const sessionsSubscription = supabase
      .channel('sessions_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'active_sessions' },
        () => {
          loadSessionData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsSubscription);
    };
  }, []);

  const loadSessionData = async () => {
    try {
      // Load active sessions
      const { data: sessionsData, error: sessionsError } = await ibmDb
        .from('active_sessions')
        .select('*')
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Mock role configurations since table may not be ready yet
      const mockRoleConfigs = [
        { role: 'super_admin', timeout_minutes: 120, max_concurrent_sessions: 2, require_2fa: true },
        { role: 'admin', timeout_minutes: 240, max_concurrent_sessions: 3, require_2fa: true },
        { role: 'manager', timeout_minutes: 360, max_concurrent_sessions: 5, require_2fa: false },
        { role: 'loan_originator', timeout_minutes: 480, max_concurrent_sessions: 3, require_2fa: false }
      ];

      setSessions((sessionsData || []).map(session => ({
        ...session,
        ip_address: session.ip_address as string,
        session_start: session.last_activity,
        concurrent_session_count: 1
      })));
      setRoleConfigs(mockRoleConfigs);
    } catch (error) {
      console.error('Error loading session data:', error);
      toast({
        title: "Error",
        description: "Failed to load session data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      const { error } = await ibmDb
        .from('active_sessions')
        .update({ 
          is_active: false,
          expires_at: new Date().toISOString()
        } as Record<string, unknown>)
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session terminated successfully"
      });

      loadSessionData();
    } catch (error) {
      console.error('Error terminating session:', error);
      toast({
        title: "Error",
        description: "Failed to terminate session",
        variant: "destructive"
      });
    }
  };

  const validateSessionSecurity = async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const deviceFingerprint = {
        screen_resolution: session.screen_resolution,
        timezone: session.timezone,
        language: session.language
      };

      const { data, error } = await supabase.rpc('validate_enhanced_session', {
        p_user_id: session.user_id,
        p_session_token: sessionId, // Using session ID as token for demo
        p_device_fingerprint: deviceFingerprint,
        p_ip_address: session.ip_address
      });

      if (error) throw error;

      const result = data as unknown as ValidationResult;
      toast({
        title: result.valid ? "Session Valid" : "Session Invalid", 
        description: result.reason,
        variant: result.valid ? "default" : "destructive"
      });

      if (result.requires_2fa) {
        toast({
          title: "2FA Required",
          description: "This session requires two-factor authentication"
        });
      }

    } catch (error) {
      console.error('Error validating session:', error);
      toast({
        title: "Error",
        description: "Failed to validate session security",
        variant: "destructive"
      });
    }
  };

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return <Monitor className="w-4 h-4" />;
    
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const getSessionRisk = (session: SessionData) => {
    const now = new Date();
    const lastActivity = new Date(session.last_activity);
    const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
    
    let riskLevel = 'low';
    let riskScore = 0;

    // Check for long inactivity
    if (hoursSinceActivity > 4) {
      riskScore += 20;
    }

    // Check for high concurrent sessions
    if (session.concurrent_session_count > 3) {
      riskScore += 30;
    }

    // Check for missing device info
    if (!session.device_fingerprint || !session.screen_resolution) {
      riskScore += 15;
    }

    if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 25) riskLevel = 'medium';

    return { level: riskLevel, score: riskScore };
  };

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Configurations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Role-Based Session Configuration
          </CardTitle>
          <CardDescription>
            Session timeout and security settings by user role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {roleConfigs.map((config) => (
              <div key={config.role} className="p-4 border rounded-lg">
                <h4 className="font-medium capitalize mb-2">{config.role.replace('_', ' ')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timeout:</span>
                    <span>{Math.floor(config.timeout_minutes / 60)}h {config.timeout_minutes % 60}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Sessions:</span>
                    <span>{config.max_concurrent_sessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">2FA Required:</span>
                    <Badge variant={config.require_2fa ? "default" : "outline"}>
                      {config.require_2fa ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Active Sessions ({sessions.length})
          </CardTitle>
          <CardDescription>
            Real-time monitoring of all active user sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Concurrent</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const risk = getSessionRisk(session);
                return (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(session.user_agent)}
                        <div>
                          <p className="font-medium">{session.user_agent?.split(' ')[0] || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.screen_resolution || 'Unknown resolution'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">
                          {session.ip_address ? 
                            `${session.ip_address} (${session.timezone || 'Unknown TZ'})` : 
                            'Unknown'
                          }
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(session.last_activity).toLocaleString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRiskBadgeVariant(risk.level)}>
                        {risk.level} ({risk.score}%)
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {session.concurrent_session_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => validateSessionSecurity(session.id)}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => terminateSession(session.id)}
                        >
                          <UserX className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {sessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="w-12 h-12 mx-auto mb-4" />
              <p>No active sessions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}