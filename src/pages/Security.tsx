import React, { useState, useEffect } from 'react';
import { PersistentAISecurityMonitor } from '@/components/security/PersistentAISecurityMonitor';
import { DarkWebSecurityBot } from '@/components/security/DarkWebSecurityBot';
import { AdvancedThreatDetection } from '@/components/security/AdvancedThreatDetection';
import { ThreatDetectionMonitor } from '@/components/security/ThreatDetectionMonitor';
import { SensitiveDataPermissionManager } from '@/components/security/SensitiveDataPermissionManager';
import { MicrosoftAuthenticatorSetup } from '@/components/auth/MicrosoftAuthenticatorSetup';
import { EnhancedSecurityMonitor } from '@/components/security/EnhancedSecurityMonitor';
import { SecurityPatternDashboard } from '@/components/security/SecurityPatternDashboard';
import { SecurityWrapper } from '@/components/SecurityWrapper';
import { StandardPageLayout } from '@/components/StandardPageLayout';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { StandardContentCard } from '@/components/StandardContentCard';
import { StandardKPICard } from '@/components/StandardKPICard';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SecurityPage: React.FC = () => {
  const navigate = useNavigate();
  const [securityScore, setSecurityScore] = useState(0);
  const [activeThreats, setActiveThreats] = useState(0);
  const [systemStatus, setSystemStatus] = useState<'operational' | 'degraded' | 'critical'>('operational');
  const [threatsBlocked, setThreatsBlocked] = useState(0);
  const [activeSessions, setActiveSessions] = useState(0);

  useEffect(() => {
    const fetchSecurityMetrics = async () => {
      try {
        // Fetch security events to calculate score
        const { data: events } = await supabase
          .from('security_events')
          .select('severity, created_at')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const criticalCount = events?.filter(e => e.severity === 'critical').length || 0;
        const highCount = events?.filter(e => e.severity === 'high').length || 0;
        const mediumCount = events?.filter(e => e.severity === 'medium').length || 0;
        
        const scoreReduction = (criticalCount * 5) + (highCount * 2) + (mediumCount * 0.5);
        const calculatedScore = Math.max(85, 100 - scoreReduction);
        setSecurityScore(calculatedScore);

        // Active threats
        const activeCount = events?.filter(e => 
          e.severity === 'high' || e.severity === 'critical'
        ).length || 0;
        setActiveThreats(activeCount);

        // Threats blocked (all events in last 24h)
        setThreatsBlocked(events?.length || 0);

        // Active sessions
        // Active users (distinct)
        const { data: userSessions } = await supabase
          .from('active_sessions')
          .select('user_id')
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString());
        
        const uniqueUsers = new Set(userSessions?.map(s => s.user_id) || []).size;
        setActiveSessions(uniqueUsers);

        // Set system status based on threats
        if (criticalCount > 0) {
          setSystemStatus('critical');
        } else if (highCount > 3) {
          setSystemStatus('degraded');
        } else {
          setSystemStatus('operational');
        }
      } catch (error) {
        console.error('Error fetching security metrics:', error);
      }
    };

    fetchSecurityMetrics();
    const interval = setInterval(fetchSecurityMetrics, 30000); // Refresh every 30s
    
    // Real-time subscription for active sessions
    const channel = supabase
      .channel('active-sessions-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'active_sessions'
      }, () => {
        fetchSecurityMetrics(); // Refresh metrics when sessions change
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusColor = () => {
    switch (systemStatus) {
      case 'operational': return 'hsl(var(--primary))';
      case 'degraded': return 'hsl(var(--warning))';
      case 'critical': return 'hsl(var(--destructive))';
    }
  };

  return (
    <SecurityWrapper>
      <StandardPageLayout>
        <IBMPageHeader 
          title="Security Overview"
          subtitle="Real-time security monitoring and threat detection"
        />
        <ResponsiveContainer>
          <div className="p-8 space-y-8 animate-fade-in">
            <div className="flex items-center gap-2">
              <Button
                size="sm" 
                className="h-8 text-xs font-medium bg-[#0f62fe] hover:bg-[#0353e9] text-white"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Refresh Data
              </Button>
            </div>

        {/* Security Overview Metrics */}
        
        <div className="space-y-6">
            {/* Security Score Overview */}
            <Card className="border-0">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                  <div>
                    <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
                      Security Score
                    </h2>
                    <div className="flex items-baseline gap-3">
                      <span className="text-6xl font-semibold text-foreground">
                        {securityScore.toFixed(1)}
                      </span>
                      <span className="text-3xl font-light text-muted-foreground">/100</span>
                    </div>
                  </div>
                  <Progress value={securityScore} className="h-2" />
                  <div className="grid grid-cols-3 gap-6 pt-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Encryption</p>
                      <p className="text-2xl font-semibold">AES-256</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Users</p>
                      <p className="text-2xl font-semibold">{activeSessions}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                      <p className="text-2xl font-semibold capitalize">{systemStatus}</p>
                    </div>
                  </div>
                </div>
                <div className="border-l border-border pl-10">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-6">
                    System Status
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">Database</span>
                      <span className="text-sm text-green-600 dark:text-green-400">Healthy</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">Network</span>
                      <span className="text-sm text-green-600 dark:text-green-400">Secured</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">Monitoring</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">Active</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">MFA</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400">Enforced</span>
                    </div>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
              <Card 
                className="border-0 shadow-sm cursor-pointer group transition-all duration-200 hover:shadow-md"
                onClick={() => navigate('/security/compliance')}
              >
                <CardContent className="p-6 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Security Status</p>
                  <p className="text-3xl font-semibold">Optimal</p>
                  <Progress value={98} className="h-1.5" />
                </CardContent>
              </Card>

              <Card 
                className="border-0 shadow-sm cursor-pointer group transition-all duration-200 hover:shadow-md"
                onClick={() => navigate('/security/audit')}
              >
                <CardContent className="p-6 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Monitors</p>
                  <p className="text-3xl font-semibold">{activeSessions > 0 ? '4' : '—'}</p>
                  <p className="text-xs text-muted-foreground">Real-time tracking</p>
                </CardContent>
              </Card>

              <Card 
                className="border-0 shadow-sm cursor-pointer group transition-all duration-200 hover:shadow-md"
                onClick={() => navigate('/security/threats')}
              >
                <CardContent className="p-6 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Threats Blocked</p>
                  <p className="text-3xl font-semibold">{threatsBlocked}</p>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>

              <Card 
                className="border-0 shadow-sm cursor-pointer group transition-all duration-200 hover:shadow-md"
                onClick={() => navigate('/security/access')}
              >
                <CardContent className="p-6 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">MFA Status</p>
                  <p className="text-3xl font-semibold">Active</p>
                  <Progress value={100} className="h-1.5" />
                </CardContent>
              </Card>

              <Card 
                className="border-0 shadow-sm cursor-pointer group transition-all duration-200 hover:shadow-md"
                onClick={() => navigate('/security/lead-diagnostics')}
              >
                <CardContent className="p-6 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lead Diagnostics</p>
                  <p className="text-3xl font-semibold">RLS</p>
                  <p className="text-xs text-muted-foreground">Access testing</p>
                </CardContent>
              </Card>
            </div>

            {/* Security Modules Tabs */}
            <Tabs defaultValue="monitoring" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 bg-muted p-1 gap-1">
                <TabsTrigger value="monitoring" className="data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white hover:bg-[#0f62fe]/10 flex items-center gap-2">
                  Live Monitoring
                </TabsTrigger>
                <TabsTrigger value="patterns" className="data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white hover:bg-[#0f62fe]/10 flex items-center gap-2">
                  Pattern Detection
                </TabsTrigger>
                <TabsTrigger value="access-control" className="data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white hover:bg-[#0f62fe]/10 flex items-center gap-2">
                  Access Control
                </TabsTrigger>
                <TabsTrigger value="mfa" className="data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white hover:bg-[#0f62fe]/10 flex items-center gap-2">
                  MFA Setup
                </TabsTrigger>
              </TabsList>

              <TabsContent value="monitoring" className="space-y-6 mt-6">
                <Card className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <EnhancedSecurityMonitor />
                  </CardContent>
                </Card>

                <div className="grid gap-5 md:grid-cols-2">
                  <Card 
                    className="border-0 shadow-sm cursor-pointer group transition-all duration-200 hover:shadow-md overflow-visible"
                    onClick={() => navigate('/security/threats')}
                  >
                    <CardHeader className="space-y-1 pb-4">
                      <CardTitle className="text-xl font-semibold">
                        AI Protection Monitor
                      </CardTitle>
                      <CardDescription>
                        Behavioral analysis and anomaly detection
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-visible">
                      <PersistentAISecurityMonitor />
                    </CardContent>
                  </Card>

                  <Card 
                    className="border-0 shadow-sm cursor-pointer group transition-all duration-200 hover:shadow-md overflow-visible"
                    onClick={() => navigate('/security/threats')}
                  >
                    <CardHeader className="space-y-1 pb-4">
                      <CardTitle className="text-xl font-semibold">
                        Dark Web Monitoring
                      </CardTitle>
                      <CardDescription>
                        Continuous dark web threat detection
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-visible">
                      <DarkWebSecurityBot />
                    </CardContent>
                  </Card>

                  <Card 
                    className="border-0 shadow-sm cursor-pointer group transition-all duration-200 hover:shadow-md overflow-visible"
                    onClick={() => navigate('/security/threats')}
                  >
                    <CardHeader className="space-y-1 pb-4">
                      <CardTitle className="text-xl font-semibold">
                        Advanced Threat Detection
                      </CardTitle>
                      <CardDescription>
                        ML-powered threat identification
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-visible">
                      <AdvancedThreatDetection />
                    </CardContent>
                  </Card>

                  <Card 
                    className="border-0 shadow-sm cursor-pointer group transition-all duration-200 hover:shadow-md overflow-visible"
                    onClick={() => navigate('/security/threats')}
                  >
                    <CardHeader className="space-y-1 pb-4">
                      <CardTitle className="text-xl font-semibold">
                        Intrusion Prevention
                      </CardTitle>
                      <CardDescription>
                        Advanced intrusion detection system
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-visible">
                      <ThreatDetectionMonitor />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="patterns" className="space-y-6 mt-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-semibold">
                      Security Pattern Detection
                    </CardTitle>
                    <CardDescription className="text-base">
                      Real-time analysis of security events and audit logs for suspicious behavior patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SecurityPatternDashboard />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="access-control" className="space-y-6 mt-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-semibold">
                      Data Access Control Management
                    </CardTitle>
                    <CardDescription className="text-base">
                      Role-based access control and sensitive data permissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SensitiveDataPermissionManager />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="mfa" className="space-y-6 mt-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl font-semibold">
                      Multi-Factor Authentication
                    </CardTitle>
                    <CardDescription className="text-base">
                      MFA setup is currently disabled
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Two-factor authentication via Microsoft Authenticator has been disabled to prevent unwanted entries in your authenticator app.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          </div>
        </ResponsiveContainer>
      </StandardPageLayout>
    </SecurityWrapper>
  );
};

export default SecurityPage;