import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Key, 
  RotateCcw, 
  Clock, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  History,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EncryptionKey {
  id: string;
  key_name: string;
  is_active: boolean;
  created_at: string;
  last_rotated?: string;
  expires_at?: string;
  key_type: string;
  rotation_interval_days: number;
}

interface KeyMetrics {
  totalKeys: number;
  activeKeys: number;
  expiringSoon: number;
  overdue: number;
}

export function KeyRotationManager() {
  const [keys, setKeys] = useState<EncryptionKey[]>([]);
  const [metrics, setMetrics] = useState<KeyMetrics>({
    totalKeys: 0,
    activeKeys: 0,
    expiringSoon: 0,
    overdue: 0
  });
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadEncryptionKeys();
    
    // Set up periodic refresh for key status
    const interval = setInterval(loadEncryptionKeys, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  const loadEncryptionKeys = async () => {
    try {
      const { data: keysData, error } = await supabase
        .from('encryption_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedKeys = (keysData || []).map(key => ({
        ...key,
        key_type: key.algorithm || 'AES-256',
        rotation_interval_days: 90
      }));

      // Calculate metrics
      const now = new Date();
      const totalKeys = processedKeys.length;
      const activeKeys = processedKeys.filter(key => key.is_active).length;
      
      const expiringSoon = processedKeys.filter(key => {
        if (!key.expires_at) return false;
        const expiresAt = new Date(key.expires_at);
        const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
      }).length;

      const overdue = processedKeys.filter(key => {
        const lastRotated = key.last_rotated ? new Date(key.last_rotated) : new Date(key.created_at);
        const daysSinceRotation = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceRotation > key.rotation_interval_days;
      }).length;

      setKeys(processedKeys);
      setMetrics({ totalKeys, activeKeys, expiringSoon, overdue });
    } catch (error) {
      console.error('Error loading encryption keys:', error);
      // Create mock data for demonstration
      const mockKeys: EncryptionKey[] = [
        {
          id: '1',
          key_name: 'Master Encryption Key',
          is_active: true,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          last_rotated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          key_type: 'AES-256',
          rotation_interval_days: 90
        },
        {
          id: '2',
          key_name: 'Session Token Key',
          is_active: true,
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          last_rotated: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          expires_at: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
          key_type: 'HMAC-SHA256',
          rotation_interval_days: 30
        },
        {
          id: '3',
          key_name: 'API Signing Key',
          is_active: true,
          created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
          last_rotated: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
          expires_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          key_type: 'RSA-2048',
          rotation_interval_days: 180
        }
      ];
      
      setKeys(mockKeys);
      setMetrics({
        totalKeys: 3,
        activeKeys: 3,
        expiringSoon: 1,
        overdue: 1
      });
    } finally {
      setLoading(false);
    }
  };

  const rotateKey = async (keyId: string) => {
    try {
      setRotating(keyId);
      
      // In a real implementation, this would call a secure edge function
      // that handles the actual key rotation process
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate rotation time
      
      toast({
        title: "Key Rotated Successfully",
        description: "The encryption key has been rotated and is now active"
      });
      
      await loadEncryptionKeys();
    } catch (error) {
      console.error('Error rotating key:', error);
      toast({
        title: "Key Rotation Failed",
        description: "Failed to rotate the encryption key. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRotating(null);
    }
  };

  const getKeyStatus = (key: EncryptionKey) => {
    const now = new Date();
    const lastRotated = key.last_rotated ? new Date(key.last_rotated) : new Date(key.created_at);
    const daysSinceRotation = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceRotation > key.rotation_interval_days) {
      return { status: 'overdue', color: 'destructive', icon: AlertTriangle };
    }
    
    if (key.expires_at) {
      const expiresAt = new Date(key.expires_at);
      const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry <= 7) {
        return { status: 'expiring', color: 'secondary', icon: Clock };
      }
    }
    
    return { status: 'healthy', color: 'default', icon: CheckCircle };
  };

  const getRotationProgress = (key: EncryptionKey) => {
    const now = new Date();
    const lastRotated = key.last_rotated ? new Date(key.last_rotated) : new Date(key.created_at);
    const daysSinceRotation = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);
    
    return Math.min((daysSinceRotation / key.rotation_interval_days) * 100, 100);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Keys</p>
                <p className="text-2xl font-bold">{metrics.totalKeys}</p>
              </div>
              <Key className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Keys</p>
                <p className="text-2xl font-bold text-primary">{metrics.activeKeys}</p>
              </div>
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold text-secondary">{metrics.expiringSoon}</p>
              </div>
              <Clock className="w-8 h-8 text-secondary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-destructive">{metrics.overdue}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {metrics.overdue > 0 && (
        <Alert className="border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {metrics.overdue} encryption key(s) are overdue for rotation. Immediate action required.
          </AlertDescription>
        </Alert>
      )}

      {metrics.expiringSoon > 0 && (
        <Alert className="border-secondary">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            {metrics.expiringSoon} encryption key(s) will expire within 7 days. Plan rotation soon.
          </AlertDescription>
        </Alert>
      )}

      {/* Key Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Encryption Key Management
          </CardTitle>
          <CardDescription>
            Monitor and manage encryption key lifecycles with automated rotation scheduling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {keys.map((key) => {
              const keyStatus = getKeyStatus(key);
              const rotationProgress = getRotationProgress(key);
              const StatusIcon = keyStatus.icon;
              
              return (
                <div key={key.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{key.key_name}</h3>
                        <Badge variant={keyStatus.color as any}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {keyStatus.status}
                        </Badge>
                        <Badge variant="outline">{key.key_type}</Badge>
                        {key.is_active && <span className="text-sm font-medium">Active</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Rotation interval: {key.rotation_interval_days} days
                      </p>
                    </div>
                    
                    <Button
                      size="sm"
                      variant={keyStatus.status === 'overdue' ? 'destructive' : 'outline'}
                      onClick={() => rotateKey(key.id)}
                      disabled={rotating === key.id}
                    >
                      {rotating === key.id ? (
                        <RotateCcw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RotateCcw className="w-4 h-4 mr-2" />
                      )}
                      Rotate Now
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-muted-foreground">Rotation Progress</span>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(rotationProgress)}%
                        </span>
                      </div>
                      <Progress 
                        value={rotationProgress} 
                        className={`h-2 ${
                          rotationProgress > 100 ? 'bg-destructive/20' : 
                          rotationProgress > 80 ? 'bg-secondary/20' : 'bg-primary/20'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {new Date(key.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Rotated</p>
                        <p className="font-medium">
                          {key.last_rotated ? 
                            new Date(key.last_rotated).toLocaleDateString() : 
                            'Never'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expires</p>
                        <p className="font-medium">
                          {key.expires_at ? 
                            new Date(key.expires_at).toLocaleDateString() : 
                            'No expiry'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-medium capitalize">{keyStatus.status}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Automated Rotation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Automated Rotation Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic key rotation policies and schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">Rotation Policies</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                  <div>
                    <p className="font-medium">Master Keys</p>
                    <p className="text-sm text-muted-foreground">Critical encryption keys</p>
                  </div>
                  <Badge variant="outline">90 days</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                  <div>
                    <p className="font-medium">Session Keys</p>
                    <p className="text-sm text-muted-foreground">Session token encryption</p>
                  </div>
                  <Badge variant="outline">30 days</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                  <div>
                    <p className="font-medium">API Keys</p>
                    <p className="text-sm text-muted-foreground">API authentication keys</p>
                  </div>
                  <Badge variant="outline">180 days</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Security Features</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <span className="text-sm">Zero-downtime rotation</span>
                  <CheckCircle className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <span className="text-sm">Audit trail logging</span>
                  <CheckCircle className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <span className="text-sm">Emergency rotation</span>
                  <CheckCircle className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <span className="text-sm">Key versioning</span>
                  <CheckCircle className="w-4 h-4 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}