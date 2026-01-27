import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Eye, 
  Users, 
  Network,
  CheckCircle,
  AlertTriangle,
  Activity,
  Lock,
  Unlock,
  UserCheck,
  Fingerprint,
  Globe,
  Target,
  Radar,
  Settings,
  Zap
} from "lucide-react";

interface ZeroTrustMetrics {
  overallScore: number;
  identityVerification: {
    score: number;
    multiFactorAuth: boolean;
    biometricAuth: boolean;
    certificateAuth: boolean;
    adaptiveAuth: boolean;
  };
  deviceTrust: {
    score: number;
    managedDevices: number;
    unverifiedDevices: number;
    complianceRate: number;
  };
  networkSecurity: {
    score: number;
    microsegmentation: boolean;
    inspectedTraffic: number;
    blockedConnections: number;
  };
  dataProtection: {
    score: number;
    encryptedAtRest: number;
    encryptedInTransit: number;
    dataClassification: boolean;
  };
  applicationSecurity: {
    score: number;
    verifiedApps: number;
    riskAssessments: number;
    vulnerabilities: number;
  };
}

interface AccessRequest {
  id: string;
  user: string;
  resource: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'REVIEWING';
  timestamp: Date;
  factors: string[];
}

export function ZeroTrustArchitecture() {
  const [metrics, setMetrics] = useState<ZeroTrustMetrics>({
    overallScore: 96.4,
    identityVerification: {
      score: 98.2,
      multiFactorAuth: true,
      biometricAuth: true,
      certificateAuth: true,
      adaptiveAuth: true
    },
    deviceTrust: {
      score: 94.8,
      managedDevices: 147,
      unverifiedDevices: 3,
      complianceRate: 96.7
    },
    networkSecurity: {
      score: 97.1,
      microsegmentation: true,
      inspectedTraffic: 99.8,
      blockedConnections: 23
    },
    dataProtection: {
      score: 95.6,
      encryptedAtRest: 100,
      encryptedInTransit: 100,
      dataClassification: true
    },
    applicationSecurity: {
      score: 93.9,
      verifiedApps: 34,
      riskAssessments: 89,
      vulnerabilities: 2
    }
  });

  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([
    {
      id: 'ZT-001',
      user: 'john.doe@company.com',
      resource: 'Financial Database',
      risk: 'LOW',
      status: 'APPROVED',
      timestamp: new Date(Date.now() - 300000),
      factors: ['MFA', 'Device Trust', 'Location', 'Behavior']
    },
    {
      id: 'ZT-002',
      user: 'jane.smith@company.com',
      resource: 'Customer PII Access',
      risk: 'MEDIUM',
      status: 'REVIEWING',
      timestamp: new Date(Date.now() - 600000),
      factors: ['MFA', 'New Device', 'VPN']
    },
    {
      id: 'ZT-003',
      user: 'unknown.user@external.com',
      resource: 'Admin Panel',
      risk: 'CRITICAL',
      status: 'DENIED',
      timestamp: new Date(Date.now() - 900000),
      factors: ['Failed MFA', 'Suspicious Location', 'Anomalous Behavior']
    }
  ]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'default';
      case 'MEDIUM': return 'secondary';
      case 'HIGH': return 'destructive';
      case 'CRITICAL': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'default';
      case 'PENDING': return 'secondary';
      case 'REVIEWING': return 'secondary';
      case 'DENIED': return 'destructive';
      default: return 'outline';
    }
  };

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        overallScore: prev.overallScore + (Math.random() - 0.5) * 0.2,
        networkSecurity: {
          ...prev.networkSecurity,
          blockedConnections: prev.networkSecurity.blockedConnections + Math.floor(Math.random() * 3)
        }
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Target className="h-6 w-6 text-green-500" />
        <h1 className="text-3xl font-bold">Zero Trust Architecture</h1>
        <Badge variant="outline" className="ml-auto">
          NEVER TRUST, ALWAYS VERIFY
        </Badge>
      </div>

      {/* Zero Trust Score Overview */}
      <Card className="border-green-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Zero Trust Security Score
          </CardTitle>
          <CardDescription>
            Comprehensive security posture based on identity, device, network, data, and application verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-8 border-green-500/20 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{metrics.overallScore.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">Overall Score</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <UserCheck className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-blue-600">{metrics.identityVerification.score.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Identity</p>
            </div>
            <div className="text-center">
              <Fingerprint className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-purple-600">{metrics.deviceTrust.score.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Device</p>
            </div>
            <div className="text-center">
              <Network className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-orange-600">{metrics.networkSecurity.score.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Network</p>
            </div>
            <div className="text-center">
              <Lock className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-red-600">{metrics.dataProtection.score.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Data</p>
            </div>
            <div className="text-center">
              <Settings className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-green-600">{metrics.applicationSecurity.score.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Apps</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="device">Device</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Identity Verification & Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Multi-Factor Authentication</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="font-medium">ACTIVE</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Biometric Authentication</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <Badge variant="default">ENABLED</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Certificate-Based Auth</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <Badge variant="default">PKI INTEGRATED</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Adaptive Authentication</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <Badge variant="default">AI-POWERED</Badge>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <Alert className="border-green-500/20 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Identity verification score: {metrics.identityVerification.score.toFixed(1)}% - Excellent
                    </AlertDescription>
                  </Alert>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Active Authentication Methods</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• Hardware Security Keys (FIDO2)</li>
                      <li>• Biometric Fingerprint Scanning</li>
                      <li>• Time-based One-Time Passwords</li>
                      <li>• Push Notifications</li>
                      <li>• Risk-based Authentication</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="device" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                Device Trust & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{metrics.deviceTrust.managedDevices}</p>
                  <p className="text-sm text-muted-foreground">Managed Devices</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-600">{metrics.deviceTrust.unverifiedDevices}</p>
                  <p className="text-sm text-muted-foreground">Unverified Devices</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Activity className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{metrics.deviceTrust.complianceRate.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Compliance Rate</p>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="font-semibold mb-4">Device Security Policies</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm">Endpoint Protection Required</span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm">Full Disk Encryption</span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm">OS Security Updates</span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm">Mobile Device Management</span>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Network Microsegmentation & Inspection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">Microsegmentation Status</h4>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-700">ACTIVE - All traffic segmented</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Traffic Inspection</span>
                      <span className="text-sm font-bold">{metrics.networkSecurity.inspectedTraffic}%</span>
                    </div>
                    <Progress value={metrics.networkSecurity.inspectedTraffic} />
                  </div>
                  
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2">Blocked Connections (24h)</h4>
                    <p className="text-2xl font-bold text-red-600">{metrics.networkSecurity.blockedConnections}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Alert className="border-blue-500/20 bg-blue-500/10">
                    <Globe className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Network segmentation prevents lateral movement of threats
                    </AlertDescription>
                  </Alert>
                  
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Active Security Policies</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• Application-aware firewalls</li>
                      <li>• Intrusion detection systems</li>
                      <li>• DNS security filtering</li>
                      <li>• TLS/SSL inspection</li>
                      <li>• Behavioral traffic analysis</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Data Protection & Encryption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Data Encrypted at Rest</span>
                      <span className="text-sm font-bold text-green-600">{metrics.dataProtection.encryptedAtRest}%</span>
                    </div>
                    <Progress value={metrics.dataProtection.encryptedAtRest} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Data Encrypted in Transit</span>
                      <span className="text-sm font-bold text-green-600">{metrics.dataProtection.encryptedInTransit}%</span>
                    </div>
                    <Progress value={metrics.dataProtection.encryptedInTransit} />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium">Data Classification</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <Badge variant="default">IMPLEMENTED</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Alert className="border-green-500/20 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      All sensitive data is properly classified and encrypted
                    </AlertDescription>
                  </Alert>
                  
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Encryption Standards</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• AES-256-GCM for data at rest</li>
                      <li>• TLS 1.3 for data in transit</li>
                      <li>• Perfect Forward Secrecy</li>
                      <li>• Key rotation every 24 hours</li>
                      <li>• Hardware security modules</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Real-time Access Control & Monitoring
              </CardTitle>
              <CardDescription>
                Continuous verification of access requests based on multiple trust factors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {accessRequests.map((request) => (
                  <div key={request.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{request.user}</span>
                        <Badge variant={getRiskColor(request.risk)}>
                          {request.risk} RISK
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Requesting access to: {request.resource}
                      </p>
                      <div className="flex gap-1 mt-2">
                        {request.factors.map((factor, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {request.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-4 mt-6">
                <Button className="flex-1">
                  <Radar className="w-4 h-4 mr-2" />
                  Monitor All Access
                </Button>
                <Button variant="outline" className="flex-1">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Policies
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}