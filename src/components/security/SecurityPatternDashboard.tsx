import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Shield, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useSecurityPatternDetection } from '@/hooks/useSecurityPatternDetection';
import { useAuth } from '@/components/auth/AuthProvider';

export const SecurityPatternDashboard: React.FC = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('super_admin');
  const { patterns, alerts, isScanning, detectPatterns, acknowledgeAlert, resolveAlert } =
    useSecurityPatternDetection();
  const [resolveNotes, setResolveNotes] = useState<string>('');
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Access denied. This dashboard is only available to administrators.
        </AlertDescription>
      </Alert>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getPatternIcon = (patternType: string) => {
    switch (patternType) {
      case 'brute_force_attempt':
        return <Shield className="h-4 w-4" />;
      case 'sql_injection_attempt':
        return <AlertTriangle className="h-4 w-4" />;
      case 'mass_data_access':
        return <Activity className="h-4 w-4" />;
      case 'privilege_escalation':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatPatternType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Security Pattern Detection</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of security events and audit logs for suspicious patterns
          </p>
        </div>
        <Button onClick={detectPatterns} disabled={isScanning}>
          {isScanning ? (
            <>
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Activity className="mr-2 h-4 w-4" />
              Scan Now
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patterns</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patterns.length}</div>
            <p className="text-xs text-muted-foreground">Detected patterns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {patterns.filter((p) => p.severity === 'critical').length}
            </div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unresolved Alerts</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">Need review</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="patterns">Detected Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          {alerts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground">No active security alerts</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            alerts.map((alert) => (
              <Card key={alert.id} className="border-l-4 border-l-destructive">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getPatternIcon(alert.pattern_type)}
                      <CardTitle className="text-lg">
                        {formatPatternType(alert.pattern_type)}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityColor(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      {alert.acknowledged && (
                        <Badge variant="outline">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Acknowledged
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription>{alert.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold">Detection Count:</span>{' '}
                        {alert.detection_count}
                      </div>
                      <div>
                        <span className="font-semibold">Detected:</span>{' '}
                        {new Date(alert.detected_at).toLocaleString()}
                      </div>
                      <div className="col-span-2">
                        <span className="font-semibold">Affected Users:</span>{' '}
                        {alert.affected_user_ids.length}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Acknowledge
                        </Button>
                      )}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            onClick={() => setSelectedAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Resolve Security Alert</DialogTitle>
                            <DialogDescription>
                              Add resolution notes for this security incident
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Textarea
                              placeholder="Enter resolution notes..."
                              value={resolveNotes}
                              onChange={(e) => setResolveNotes(e.target.value)}
                              rows={4}
                            />
                            <Button
                              onClick={() => {
                                if (selectedAlert) {
                                  resolveAlert(selectedAlert, resolveNotes);
                                  setResolveNotes('');
                                  setSelectedAlert(null);
                                }
                              }}
                            >
                              Mark as Resolved
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          {patterns.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No patterns detected</p>
                  <p className="text-xs text-muted-foreground">Click "Scan Now" to check</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            patterns.map((pattern, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getPatternIcon(pattern.pattern_type)}
                      <CardTitle className="text-lg">
                        {formatPatternType(pattern.pattern_type)}
                      </CardTitle>
                    </div>
                    <Badge variant={getSeverityColor(pattern.severity)}>
                      {pattern.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <CardDescription>{pattern.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Occurrences:</span> {pattern.count}
                    </div>
                    <div>
                      <span className="font-semibold">Affected Users:</span>{' '}
                      {pattern.affected_users.length}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};