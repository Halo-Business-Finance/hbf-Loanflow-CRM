import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Monitor, Clock, MapPin, Smartphone } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SessionData {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  last_activity: string;
  created_at: string;
  is_active: boolean;
  expires_at: string;
}

export const SessionSecurityManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's active sessions
  const fetchSessions = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (error) {
        setError(error.message);
        return;
      }

      setSessions((data || []) as SessionData[]);
    } catch (err) {
      setError('Failed to load sessions');
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Terminate a specific session
  const terminateSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('active_sessions')
        .update({ is_active: false })
        .eq('id', sessionId)
        .eq('user_id', user?.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to terminate session.",
        });
        return;
      }

      toast({
        title: "Session Terminated",
        description: "The session has been successfully terminated.",
      });

      // Refresh sessions list
      await fetchSessions();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to terminate session.",
      });
      console.error('Error terminating session:', err);
    }
  };

  // Terminate all other sessions
  const terminateAllOtherSessions = async () => {
    try {
      // Get current session to avoid terminating it
      const { data: { session } } = await supabase.auth.getSession();
      const currentSessionToken = session?.access_token;

      const { error } = await supabase
        .from('active_sessions')
        .update({ is_active: false })
        .eq('user_id', user?.id)
        .neq('session_token', currentSessionToken || '');

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to terminate sessions.",
        });
        return;
      }

      toast({
        title: "Sessions Terminated",
        description: "All other sessions have been terminated.",
      });

      // Refresh sessions list
      await fetchSessions();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to terminate sessions.",
      });
      console.error('Error terminating sessions:', err);
    }
  };

  // Get device type from user agent (with null check)
  const getDeviceType = (userAgent: string | null): string => {
    if (!userAgent) return 'Unknown';
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      return 'Mobile';
    }
    if (/Tablet|iPad/i.test(userAgent)) {
      return 'Tablet';
    }
    return 'Desktop';
  };

  // Get browser from user agent (with null check)
  const getBrowser = (userAgent: string | null): string => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  };

  // Format last activity time
  const formatLastActivity = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  useEffect(() => {
    fetchSessions();
  }, [user?.id]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Session Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading sessions...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Session Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Session Security Management
        </CardTitle>
        <CardDescription>
          Monitor and manage your active sessions for enhanced security
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Session Count and Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {sessions.length} Active Session{sessions.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={terminateAllOtherSessions}
              className="text-destructive hover:text-destructive"
            >
              Terminate All Others
            </Button>
          )}
        </div>

        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Sessions are automatically secured with device fingerprinting, IP monitoring, and suspicious activity detection.
            Terminate any sessions you don't recognize immediately.
          </AlertDescription>
        </Alert>

        {/* Sessions List */}
        <div className="space-y-4">
          {sessions.map((session) => (
            <Card key={session.id} className="border-l-4 border-l-primary/20">
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {/* Device and Browser Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {getDeviceType(session.user_agent) === 'Mobile' ? (
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">
                          {getBrowser(session.user_agent)} on {getDeviceType(session.user_agent)}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => terminateSession(session.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Terminate
                    </Button>
                  </div>

                  {/* Session Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>IP: {session.ip_address || 'Unknown'}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Last: {formatLastActivity(session.last_activity)}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      <span>Device: {session.device_fingerprint?.substring(0, 8) || 'Unknown'}...</span>
                    </div>
                  </div>

                  {/* Session Expiry */}
                  <div className="text-xs text-muted-foreground">
                    Expires: {new Date(session.expires_at).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sessions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No active sessions found.
          </div>
        )}

        {/* Refresh Button */}
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={fetchSessions}>
            Refresh Sessions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};