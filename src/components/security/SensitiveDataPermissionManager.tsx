import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Shield, Clock, User, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface SensitiveDataPermission {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  permission_type: string;
  granted_by: string;
  granted_at: string;
  expires_at: string | null;
  business_justification: string;
  is_active: boolean;
  access_count: number;
  last_accessed: string | null;
}

interface AccessLog {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  data_type: string;
  fields_accessed: string[];
  access_reason: string;
  created_at: string;
}

export function SensitiveDataPermissionManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<SensitiveDataPermission[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrantForm, setShowGrantForm] = useState(false);

  // Form state
  const [targetUserId, setTargetUserId] = useState("");
  const [adminUserId, setAdminUserId] = useState("");
  const [permissionType, setPermissionType] = useState("financial_data");
  const [justification, setJustification] = useState("");
  const [expiresHours, setExpiresHours] = useState<number | null>(null);

  useEffect(() => {
    fetchPermissions();
    fetchAccessLogs();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('sensitive_data_permissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch permissions",
        variant: "destructive",
      });
    }
  };

  const fetchAccessLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('sensitive_data_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAccessLogs(data || []);
    } catch (error) {
      console.error('Error fetching access logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch access logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const grantPermission = async () => {
    if (!adminUserId || !targetUserId || !justification.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('grant_sensitive_data_permission', {
        p_admin_user_id: adminUserId,
        p_target_user_id: targetUserId,
        p_permission_type: permissionType,
        p_business_justification: justification,
        p_expires_hours: expiresHours
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Permission granted successfully",
      });

      // Reset form
      setTargetUserId("");
      setAdminUserId("");
      setJustification("");
      setExpiresHours(null);
      setShowGrantForm(false);

      // Refresh data
      fetchPermissions();
    } catch (error: any) {
      console.error('Error granting permission:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to grant permission",
        variant: "destructive",
      });
    }
  };

  const revokePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase
        .from('sensitive_data_permissions')
        .update({ 
          is_active: false, 
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id
        })
        .eq('id', permissionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Permission revoked successfully",
      });

      fetchPermissions();
    } catch (error) {
      console.error('Error revoking permission:', error);
      toast({
        title: "Error",
        description: "Failed to revoke permission",
        variant: "destructive",
      });
    }
  };

  const getPermissionStatus = (permission: SensitiveDataPermission) => {
    if (!permission.is_active) return { status: "revoked", color: "destructive" };
    if (permission.expires_at && new Date(permission.expires_at) < new Date()) {
      return { status: "expired", color: "secondary" };
    }
    return { status: "active", color: "success" };
  };

  if (loading) {
    return <div className="p-6">Loading sensitive data permissions...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Sensitive Data Access Control
          </h2>
          <p className="text-muted-foreground">
            Manage administrator access to sensitive customer financial data
          </p>
        </div>
        <Button onClick={() => setShowGrantForm(!showGrantForm)}>
          {showGrantForm ? "Cancel" : "Grant New Permission"}
        </Button>
      </div>

      {/* Grant Permission Form */}
      {showGrantForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grant Sensitive Data Permission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="adminUserId">Administrator User ID</Label>
                <Input
                  id="adminUserId"
                  value={adminUserId}
                  onChange={(e) => setAdminUserId(e.target.value)}
                  placeholder="UUID of the administrator"
                />
              </div>
              <div>
                <Label htmlFor="targetUserId">Target User ID</Label>
                <Input
                  id="targetUserId"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="UUID of the user whose data to access"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="permissionType">Permission Type</Label>
                <Select value={permissionType} onValueChange={setPermissionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="financial_data">Financial Data</SelectItem>
                    <SelectItem value="credit_data">Credit Data</SelectItem>
                    <SelectItem value="income_data">Income Data</SelectItem>
                    <SelectItem value="loan_data">Loan Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="expiresHours">Expires in Hours (optional)</Label>
                <Input
                  id="expiresHours"
                  type="number"
                  value={expiresHours || ""}
                  onChange={(e) => setExpiresHours(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Leave empty for no expiration"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="justification">Business Justification *</Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain why this access is needed..."
                className="min-h-[100px]"
              />
            </div>

            <Button onClick={grantPermission} className="w-full">
              Grant Permission
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <p className="text-muted-foreground">No permissions granted yet.</p>
          ) : (
            <div className="space-y-4">
              {permissions.map((permission) => {
                const status = getPermissionStatus(permission);
                return (
                  <div key={permission.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">Admin: {permission.admin_user_id.slice(0, 8)}...</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">Target: {permission.target_user_id.slice(0, 8)}...</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant={status.color as any}>
                            {status.status}
                          </Badge>
                          <Badge variant="outline">
                            {permission.permission_type.replace('_', ' ')}
                          </Badge>
                          {permission.access_count > 0 && (
                            <Badge variant="secondary">
                              Used {permission.access_count} times
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground">
                          <strong>Justification:</strong> {permission.business_justification}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Granted: {format(new Date(permission.granted_at), 'PPp')}</span>
                          {permission.expires_at && (
                            <span>Expires: {format(new Date(permission.expires_at), 'PPp')}</span>
                          )}
                          {permission.last_accessed && (
                            <span>Last used: {format(new Date(permission.last_accessed), 'PPp')}</span>
                          )}
                        </div>
                      </div>

                      {permission.is_active && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => revokePermission(permission.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Access Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {accessLogs.length === 0 ? (
            <p className="text-muted-foreground">No access logs yet.</p>
          ) : (
            <div className="space-y-3">
              {accessLogs.map((log) => (
                <div key={log.id} className="border-l-4 border-l-orange-500 bg-orange-50 p-3 rounded-r">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <span className="font-medium">
                          Admin {log.admin_user_id.slice(0, 8)}... accessed {log.data_type}
                        </span>
                        <span className="text-muted-foreground">
                          for user {log.target_user_id.slice(0, 8)}...
                        </span>
                      </div>
                      
                      {log.fields_accessed && log.fields_accessed.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Fields: {log.fields_accessed.join(', ')}
                        </p>
                      )}
                      
                      {log.access_reason && (
                        <p className="text-xs text-muted-foreground">
                          Reason: {log.access_reason}
                        </p>
                      )}
                    </div>
                    
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'PPp')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}