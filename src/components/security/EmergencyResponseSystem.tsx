import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Zap, 
  Shield, 
  Phone,
  CheckCircle,
  X,
  Power,
  Lock,
  Unlock,
  Timer,
  Radio,
  Satellite,
  Command,
  Target,
  AlertCircle,
  Activity,
  Siren
} from "lucide-react";

interface EmergencyProtocol {
  id: string;
  name: string;
  level: 'DEFCON-1' | 'DEFCON-2' | 'DEFCON-3' | 'DEFCON-4' | 'DEFCON-5';
  status: 'ACTIVE' | 'STANDBY' | 'TRIGGERED' | 'DISABLED';
  responseTime: string;
  automaticActions: string[];
  manualActions: string[];
  lastTriggered?: Date;
}

interface SecurityIncident {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  timestamp: Date;
  status: 'ACTIVE' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED';
  responseProtocol?: string;
  autoResponse: boolean;
}

export function EmergencyResponseSystem() {
  const [emergencyProtocols] = useState<EmergencyProtocol[]>([
    {
      id: 'ERP-001',
      name: 'Full System Lockdown',
      level: 'DEFCON-1',
      status: 'STANDBY',
      responseTime: '< 50ms',
      automaticActions: [
        'Terminate all active sessions',
        'Disable new logins',
        'Activate emergency contacts',
        'Enable maximum encryption',
        'Block all external connections'
      ],
      manualActions: [
        'Contact law enforcement',
        'Notify stakeholders',
        'Initiate backup systems',
        'Document incident'
      ]
    },
    {
      id: 'ERP-002',
      name: 'Data Breach Response',
      level: 'DEFCON-2',
      status: 'STANDBY',
      responseTime: '< 100ms',
      automaticActions: [
        'Isolate affected systems',
        'Enable advanced monitoring',
        'Rotate encryption keys',
        'Backup critical data'
      ],
      manualActions: [
        'Assess breach scope',
        'Notify affected users',
        'Contact authorities',
        'Prepare public statement'
      ]
    },
    {
      id: 'ERP-003',
      name: 'Insider Threat Detection',
      level: 'DEFCON-3',
      status: 'ACTIVE',
      responseTime: '< 200ms',
      automaticActions: [
        'Enhanced user monitoring',
        'Restrict elevated privileges',
        'Audit access logs',
        'Flag suspicious activities'
      ],
      manualActions: [
        'Interview relevant personnel',
        'Review access patterns',
        'Coordinate with HR',
        'Document findings'
      ]
    }
  ]);

  const [activeIncidents, setActiveIncidents] = useState<SecurityIncident[]>([
    {
      id: 'INC-001',
      type: 'Unauthorized Access Attempt',
      severity: 'HIGH',
      description: 'Multiple failed login attempts from foreign IP addresses',
      timestamp: new Date(Date.now() - 300000),
      status: 'CONTAINED',
      responseProtocol: 'ERP-003',
      autoResponse: true
    },
    {
      id: 'INC-002',
      type: 'Abnormal Data Transfer',
      severity: 'MEDIUM',
      description: 'Large data transfer detected outside normal business hours',
      timestamp: new Date(Date.now() - 600000),
      status: 'INVESTIGATING',
      responseProtocol: 'ERP-002',
      autoResponse: true
    }
  ]);

  const [systemStatus, setSystemStatus] = useState({
    emergencyMode: false,
    responseTime: 47,
    activatedProtocols: 0,
    lastDrillDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    nextDrillDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000)
  });

  const [countdown, setCountdown] = useState(0);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'DEFCON-1': return 'destructive';
      case 'DEFCON-2': return 'destructive';
      case 'DEFCON-3': return 'secondary';
      case 'DEFCON-4': return 'default';
      case 'DEFCON-5': return 'default';
      default: return 'outline';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      case 'LOW': return 'default';
      default: return 'outline';
    }
  };

  const initiateEmergencyLockdown = () => {
    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setSystemStatus(prev => ({
            ...prev,
            emergencyMode: true,
            activatedProtocols: emergencyProtocols.length
          }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelEmergencyLockdown = () => {
    setCountdown(0);
    setSystemStatus(prev => ({
      ...prev,
      emergencyMode: false,
      activatedProtocols: 0
    }));
  };

  useEffect(() => {
    // Simulate real-time incident monitoring
    const interval = setInterval(() => {
      // Randomly generate new incidents for demo
      if (Math.random() < 0.1) {
        const newIncident: SecurityIncident = {
          id: `INC-${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
          type: 'Automated Threat Detection',
          severity: 'LOW',
          description: 'Routine security scan detected minor anomaly',
          timestamp: new Date(),
          status: 'INVESTIGATING',
          autoResponse: true
        };
        setActiveIncidents(prev => [newIncident, ...prev.slice(0, 4)]);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Siren className="h-6 w-6 text-red-500" />
        <h1 className="text-3xl font-bold">Emergency Response System</h1>
        <Badge variant={systemStatus.emergencyMode ? "destructive" : "default"} className="ml-auto">
          {systemStatus.emergencyMode ? "EMERGENCY MODE ACTIVE" : "NORMAL OPERATIONS"}
        </Badge>
      </div>

      {/* Emergency Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className={`border-l-4 ${systemStatus.emergencyMode ? 'border-l-red-500 bg-red-50' : 'border-l-green-500 bg-green-50'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {systemStatus.emergencyMode ? (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  <p className="text-lg font-bold">
                    {systemStatus.emergencyMode ? 'EMERGENCY' : 'NORMAL'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Response Time</p>
                <p className="text-2xl font-bold text-blue-600">{systemStatus.responseTime}ms</p>
              </div>
              <Timer className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Protocols</p>
                <p className="text-2xl font-bold text-purple-600">{systemStatus.activatedProtocols}</p>
              </div>
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Incidents</p>
                <p className="text-2xl font-bold text-orange-600">{activeIncidents.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Lockdown Controls */}
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Power className="h-5 w-5" />
            EMERGENCY LOCKDOWN CONTROLS
          </CardTitle>
          <CardDescription>
            Immediate system-wide security lockdown with automatic threat response
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {countdown > 0 && (
            <Alert className="border-red-500 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="flex items-center justify-between">
                  <span>EMERGENCY LOCKDOWN INITIATING IN {countdown} SECONDS</span>
                  <Button onClick={cancelEmergencyLockdown} variant="outline" size="sm">
                    <X className="w-4 h-4 mr-2" />
                    CANCEL
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={initiateEmergencyLockdown} 
              variant="destructive" 
              size="lg"
              className="h-16 text-lg"
              disabled={countdown > 0 || systemStatus.emergencyMode}
            >
              <AlertTriangle className="w-6 h-6 mr-2" />
              INITIATE EMERGENCY LOCKDOWN
            </Button>
            <Button 
              onClick={cancelEmergencyLockdown}
              variant="outline" 
              size="lg"
              className="h-16 text-lg"
              disabled={!systemStatus.emergencyMode}
            >
              <Unlock className="w-6 h-6 mr-2" />
              DEACTIVATE EMERGENCY MODE
            </Button>
          </div>

          <Alert className="border-yellow-500/20 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Emergency lockdown will terminate all sessions, disable logins, and activate automatic countermeasures. 
              This action cannot be reversed without administrator intervention.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs defaultValue="protocols" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="protocols">Response Protocols</TabsTrigger>
          <TabsTrigger value="incidents">Active Incidents</TabsTrigger>
          <TabsTrigger value="drills">Emergency Drills</TabsTrigger>
        </TabsList>

        <TabsContent value="protocols" className="space-y-6">
          <div className="grid gap-6">
            {emergencyProtocols.map((protocol) => (
              <Card key={protocol.id} className="border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Command className="h-5 w-5" />
                      {protocol.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={getLevelColor(protocol.level)}>
                        {protocol.level}
                      </Badge>
                      <Badge variant={protocol.status === 'ACTIVE' ? 'default' : 'outline'}>
                        {protocol.status}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Response time: {protocol.responseTime}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Automatic Actions
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {protocol.automaticActions.map((action, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Manual Actions Required
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {protocol.manualActions.map((action, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <AlertCircle className="w-3 h-3 text-orange-500" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {protocol.lastTriggered && (
                    <div className="mt-4 p-2 bg-slate-50 rounded">
                      <p className="text-xs text-muted-foreground">
                        Last triggered: {protocol.lastTriggered.toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Real-time Security Incidents
              </CardTitle>
              <CardDescription>
                Active incidents and automated response status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeIncidents.map((incident) => (
                <div key={incident.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{incident.type}</span>
                      <Badge variant={getSeverityColor(incident.severity)}>
                        {incident.severity}
                      </Badge>
                      {incident.autoResponse && (
                        <Badge variant="outline">AUTO-RESPONSE</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {incident.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>ID: {incident.id}</span>
                      <span>{incident.timestamp.toLocaleString()}</span>
                      {incident.responseProtocol && (
                        <span>Protocol: {incident.responseProtocol}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={incident.status === 'RESOLVED' ? 'default' : 'secondary'}>
                      {incident.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drills" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Emergency Response Drills
              </CardTitle>
              <CardDescription>
                Regular testing and validation of emergency procedures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Last Emergency Drill</h4>
                  <p className="text-lg font-bold text-blue-600">
                    {systemStatus.lastDrillDate.toLocaleDateString()}
                  </p>
                  <p className="text-sm text-blue-700">
                    Full system lockdown simulation completed successfully
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Next Scheduled Drill</h4>
                  <p className="text-lg font-bold text-green-600">
                    {systemStatus.nextDrillDate.toLocaleDateString()}
                  </p>
                  <p className="text-sm text-green-700">
                    Automated quarterly security assessment
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Drill Performance Metrics</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Response Time</span>
                      <span className="text-sm font-bold">98%</span>
                    </div>
                    <Progress value={98} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Protocol Compliance</span>
                      <span className="text-sm font-bold">95%</span>
                    </div>
                    <Progress value={95} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Staff Readiness</span>
                      <span className="text-sm font-bold">92%</span>
                    </div>
                    <Progress value={92} />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button className="flex-1">
                  <Radio className="w-4 h-4 mr-2" />
                  Schedule Emergency Drill
                </Button>
                <Button variant="outline" className="flex-1 border-2 border-[#001f3f] hover:bg-[#001f3f] hover:text-white">
                  <Satellite className="w-4 h-4 mr-2" />
                  Test Communication Systems
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}