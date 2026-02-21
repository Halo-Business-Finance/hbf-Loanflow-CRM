import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw, Database, Eye, Lock, User } from 'lucide-react';
import { ibmDb } from '@/lib/ibm';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';

interface PolicyEvaluation {
  table: string;
  policy_name: string;
  operation: string;
  status: 'allowed' | 'denied' | 'not_applicable';
  reason?: string;
}

interface DiagnosticResult {
  user_id: string;
  email: string;
  roles: string[];
  timestamp: string;
  leads_count: number;
  contact_entities_count: number;
  rpc_accessible_leads: number;
  direct_table_access: boolean;
  policies: PolicyEvaluation[];
  raw_query_results: any;
}

export default function LeadAccessDiagnostics() {
  const { user, userRoles, userRole } = useAuth();
  const { toast } = useToast();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawLogs, setRawLogs] = useState<string[]>([]);

  const runDiagnostics = async () => {
    if (!user) return;
    setLoading(true);
    const logs: string[] = [];
    
    try {
      logs.push(`[${new Date().toISOString()}] Starting diagnostics for user: ${user.id}`);
      
      logs.push('Checking user roles...');
      const { data: roleDataRaw, error: roleError } = await ibmDb
        .from('user_roles').select('role, is_active').eq('user_id', user.id);
      const roleData = roleDataRaw as any[] | null;
      logs.push(`User roles query: ${roleError ? 'ERROR - ' + JSON.stringify(roleError) : 'SUCCESS'}`);
      logs.push(`Roles found: ${JSON.stringify(roleData || [])}`);

      logs.push('Attempting direct leads table access...');
      const { data: leadsDataRaw, error: leadsError, count: leadsCount } = await ibmDb
        .from('leads').select('id, lead_number, user_id').limit(5);
      const leadsData = leadsDataRaw as any[] | null;
      logs.push(`Direct leads access: ${leadsError ? 'DENIED - ' + JSON.stringify(leadsError) : 'ALLOWED'}`);
      logs.push(`Leads returned: ${leadsData?.length || 0}, Total count: ${leadsCount || 0}`);

      logs.push('Attempting RPC get_accessible_leads...');
      const { data: rpcLeadsRaw, error: rpcError } = await ibmDb.rpc('get_accessible_leads');
      const rpcLeads = rpcLeadsRaw as any[] | null;
      logs.push(`RPC access: ${rpcError ? 'ERROR - ' + JSON.stringify(rpcError) : 'SUCCESS'}`);
      logs.push(`RPC leads returned: ${rpcLeads?.length || 0}`);

      logs.push('Checking contact_entities access...');
      const { data: contactDataRaw, error: contactError, count: contactCount } = await ibmDb
        .from('contact_entities').select('id, name, email').limit(5);
      const contactData = contactDataRaw as any[] | null;
      logs.push(`Contact entities access: ${contactError ? 'DENIED - ' + JSON.stringify(contactError) : 'ALLOWED'}`);
      logs.push(`Contact entities returned: ${contactData?.length || 0}, Total count: ${contactCount || 0}`);

      logs.push('Testing ensure_default_viewer_role RPC...');
      const { error: roleRpcError } = await ibmDb.rpc('ensure_default_viewer_role');
      logs.push(`ensure_default_viewer_role: ${roleRpcError ? 'ERROR - ' + JSON.stringify(roleRpcError) : 'SUCCESS'}`);

      logs.push('RLS policies evaluated through direct access tests');

      const policies: PolicyEvaluation[] = [
        { table: 'leads', policy_name: 'Direct table access', operation: 'SELECT', status: leadsError ? 'denied' : 'allowed', reason: leadsError ? leadsError.message : `Returned ${leadsData?.length || 0} rows` },
        { table: 'leads', policy_name: 'RPC get_accessible_leads', operation: 'EXECUTE', status: rpcError ? 'denied' : 'allowed', reason: rpcError ? rpcError.message : `Returned ${rpcLeads?.length || 0} rows` },
        { table: 'contact_entities', policy_name: 'Direct table access', operation: 'SELECT', status: contactError ? 'denied' : 'allowed', reason: contactError ? contactError.message : `Returned ${contactData?.length || 0} rows` }
      ];

      const result: DiagnosticResult = {
        user_id: user.id, email: user.email || 'Unknown',
        roles: roleData?.map(r => r.role) || [], timestamp: new Date().toISOString(),
        leads_count: leadsCount || 0, contact_entities_count: contactCount || 0,
        rpc_accessible_leads: rpcLeads?.length || 0, direct_table_access: !leadsError,
        policies, raw_query_results: { roles: roleData, leads: leadsData, rpcLeads, contacts: contactData }
      };

      setDiagnostics(result);
      setRawLogs(logs);
      toast({ title: 'Diagnostics Complete', description: `Found ${result.rpc_accessible_leads} accessible leads` });
    } catch (err: any) {
      logs.push(`[ERROR] ${err.message}`);
      setRawLogs(logs);
      toast({ title: 'Diagnostics Failed', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user) runDiagnostics(); }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'allowed': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'denied': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'allowed': return <Badge className="bg-green-500">Allowed</Badge>;
      case 'denied': return <Badge variant="destructive">Denied</Badge>;
      default: return <Badge variant="secondary">N/A</Badge>;
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Alert><User className="h-4 w-4" /><AlertDescription>Please sign in to access Lead Access Diagnostics.</AlertDescription></Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <IBMPageHeader 
        title="Lead Access Diagnostics"
        subtitle="RLS Policy evaluation and access control testing"
        actions={<Button onClick={runDiagnostics} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Run Diagnostics</Button>}
      />

      {diagnostics && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Current Role</p><p className="text-2xl font-bold">{userRole || 'None'}</p></div><User className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Leads</p><p className="text-2xl font-bold">{diagnostics.leads_count}</p></div><Database className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Accessible Leads</p><p className="text-2xl font-bold">{diagnostics.rpc_accessible_leads}</p></div><Eye className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Direct Access</p><p className="text-2xl font-bold">{diagnostics.direct_table_access ? 'Yes' : 'No'}</p></div><Lock className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        </div>
      )}

      {diagnostics && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="policies">Policy Evaluation</TabsTrigger>
            <TabsTrigger value="roles">User Roles</TabsTrigger>
            <TabsTrigger value="logs">Raw Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Access Summary</CardTitle><CardDescription>Last diagnostic run: {new Date(diagnostics.timestamp).toLocaleString()}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm font-medium text-muted-foreground">User ID</p><p className="text-sm font-mono">{diagnostics.user_id}</p></div>
                  <div><p className="text-sm font-medium text-muted-foreground">Email</p><p className="text-sm">{diagnostics.email}</p></div>
                  <div><p className="text-sm font-medium text-muted-foreground">Active Roles</p><div className="flex gap-2 mt-1">{diagnostics.roles.map(role => (<Badge key={role} variant="outline">{role}</Badge>))}</div></div>
                  <div><p className="text-sm font-medium text-muted-foreground">Total Contacts</p><p className="text-sm">{diagnostics.contact_entities_count}</p></div>
                </div>
                {diagnostics.rpc_accessible_leads === 0 && diagnostics.leads_count > 0 && (
                  <Alert className="border-destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription><strong>Access Issue Detected:</strong> Database contains {diagnostics.leads_count} leads, but RPC returns 0 accessible leads.</AlertDescription></Alert>
                )}
                {!diagnostics.roles.includes('viewer') && (
                  <Alert className="border-yellow-500"><AlertTriangle className="h-4 w-4" /><AlertDescription><strong>Missing Viewer Role:</strong> User does not have 'viewer' role.</AlertDescription></Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>RLS Policy Evaluation Results</CardTitle><CardDescription>Detailed results of Row-Level Security policy checks</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {diagnostics.policies.map((policy, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                      {getStatusIcon(policy.status)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div><p className="font-medium">{policy.table}.{policy.policy_name}</p><p className="text-sm text-muted-foreground">Operation: {policy.operation}</p></div>
                          {getStatusBadge(policy.status)}
                        </div>
                        {policy.reason && <p className="text-sm text-muted-foreground mt-2">{policy.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>User Roles Configuration</CardTitle><CardDescription>Current roles assigned to your account</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {diagnostics.raw_query_results.roles?.map((role: any) => (
                    <div key={role.role} className="flex items-center justify-between p-3 border rounded-lg">
                      <div><p className="font-medium">{role.role}</p><p className="text-sm text-muted-foreground">Status: {role.is_active ? 'Active' : 'Inactive'}</p></div>
                      {role.is_active ? <Badge className="bg-green-500">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </div>
                  )) || (<Alert><AlertDescription>No roles found for this user</AlertDescription></Alert>)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Diagnostic Logs</CardTitle><CardDescription>Detailed execution logs from diagnostic run</CardDescription></CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
                  {rawLogs.map((log, idx) => (
                    <div key={idx} className={log.includes('ERROR') ? 'text-red-500' : log.includes('SUCCESS') ? 'text-green-500' : log.includes('DENIED') ? 'text-orange-500' : 'text-foreground'}>{log}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
