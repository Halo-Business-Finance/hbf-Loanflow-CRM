import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Archive, 
  Clock, 
  Trash2, 
  AlertTriangle,
  Shield,
  FileText,
  Calendar,
  Settings,
  Play,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface RetentionPolicy {
  id: string;
  name: string;
  documentType: string;
  retentionYears: number;
  archiveAfterDays: number;
  autoDelete: boolean;
  legalHoldOverride: boolean;
  isActive: boolean;
}

interface DocumentAtRisk {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  daysUntilAction: number;
  action: 'archive' | 'delete';
  loanId: string;
}

const DEFAULT_POLICIES: RetentionPolicy[] = [
  { id: '1', name: 'SBA Loan Documents', documentType: 'sba_forms', retentionYears: 7, archiveAfterDays: 365, autoDelete: false, legalHoldOverride: true, isActive: true },
  { id: '2', name: 'Tax Returns', documentType: 'tax_returns', retentionYears: 7, archiveAfterDays: 365, autoDelete: false, legalHoldOverride: true, isActive: true },
  { id: '3', name: 'Bank Statements', documentType: 'bank_statements', retentionYears: 5, archiveAfterDays: 180, autoDelete: true, legalHoldOverride: true, isActive: true },
  { id: '4', name: 'ID Documents', documentType: 'identification', retentionYears: 5, archiveAfterDays: 90, autoDelete: true, legalHoldOverride: true, isActive: true },
  { id: '5', name: 'General Correspondence', documentType: 'correspondence', retentionYears: 3, archiveAfterDays: 90, autoDelete: true, legalHoldOverride: false, isActive: true },
];

const SAMPLE_AT_RISK: DocumentAtRisk[] = [
  { id: 'd1', name: 'Bank_Statement_Jan_2020.pdf', type: 'bank_statements', createdAt: '2020-01-15', daysUntilAction: 30, action: 'archive', loanId: 'L-001' },
  { id: 'd2', name: 'ID_Scan_Borrower.jpg', type: 'identification', createdAt: '2019-06-20', daysUntilAction: 15, action: 'delete', loanId: 'L-002' },
  { id: 'd3', name: 'Email_Thread_Approval.pdf', type: 'correspondence', createdAt: '2021-03-10', daysUntilAction: 45, action: 'archive', loanId: 'L-003' },
];

export function DocumentRetentionManager() {
  const [policies, setPolicies] = useState<RetentionPolicy[]>(DEFAULT_POLICIES);
  const [documentsAtRisk, setDocumentsAtRisk] = useState<DocumentAtRisk[]>(SAMPLE_AT_RISK);
  const [selectedPolicy, setSelectedPolicy] = useState<RetentionPolicy | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const runRetentionScan = async () => {
    setIsScanning(true);
    setScanProgress(0);

    // Simulate scanning
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 200));
      setScanProgress(i);
    }

    setIsScanning(false);
    toast.success('Retention scan complete. 3 documents flagged for action.');
  };

  const togglePolicy = (policyId: string) => {
    setPolicies(prev => prev.map(p => 
      p.id === policyId ? { ...p, isActive: !p.isActive } : p
    ));
    toast.success('Policy status updated');
  };

  const updatePolicy = (policyId: string, field: keyof RetentionPolicy, value: any) => {
    setPolicies(prev => prev.map(p => 
      p.id === policyId ? { ...p, [field]: value } : p
    ));
  };

  const archiveDocument = (docId: string) => {
    setDocumentsAtRisk(prev => prev.filter(d => d.id !== docId));
    toast.success('Document archived');
  };

  const extendRetention = (docId: string) => {
    setDocumentsAtRisk(prev => prev.map(d => 
      d.id === docId ? { ...d, daysUntilAction: d.daysUntilAction + 365 } : d
    ));
    toast.success('Retention extended by 1 year');
  };

  const archivingCount = documentsAtRisk.filter(d => d.action === 'archive').length;
  const deletionCount = documentsAtRisk.filter(d => d.action === 'delete').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            <CardTitle>Document Retention Manager</CardTitle>
          </div>
          <Button onClick={runRetentionScan} disabled={isScanning}>
            {isScanning ? (
              <>Scanning... {scanProgress}%</>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Retention Scan
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          Automated document lifecycle management for regulatory compliance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isScanning && (
          <div className="mb-4">
            <Progress value={scanProgress} className="h-2" />
          </div>
        )}

        {/* Summary Alert */}
        {documentsAtRisk.length > 0 && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{documentsAtRisk.length} documents</strong> require attention: 
              {archivingCount > 0 && ` ${archivingCount} pending archive`}
              {deletionCount > 0 && ` ${deletionCount} pending deletion`}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Retention Policies */}
          <div>
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Retention Policies
            </h4>
            <ScrollArea className="h-[350px]">
              <div className="space-y-3">
                {policies.map(policy => (
                  <div
                    key={policy.id}
                    className={`p-3 border rounded-lg ${policy.isActive ? 'bg-card' : 'bg-muted/50'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{policy.name}</span>
                        <Badge variant={policy.isActive ? 'default' : 'secondary'}>
                          {policy.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <Switch
                        checked={policy.isActive}
                        onCheckedChange={() => togglePolicy(policy.id)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Retain: {policy.retentionYears} years
                      </div>
                      <div className="flex items-center gap-1">
                        <Archive className="h-3 w-3" />
                        Archive: {policy.archiveAfterDays} days
                      </div>
                      <div className="flex items-center gap-1">
                        {policy.autoDelete ? (
                          <Trash2 className="h-3 w-3 text-destructive" />
                        ) : (
                          <Shield className="h-3 w-3 text-green-600" />
                        )}
                        {policy.autoDelete ? 'Auto-delete' : 'Manual review'}
                      </div>
                      <div className="flex items-center gap-1">
                        {policy.legalHoldOverride && (
                          <>
                            <Shield className="h-3 w-3 text-amber-600" />
                            Legal hold supported
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Documents At Risk */}
          <div>
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Documents Requiring Action
            </h4>
            <ScrollArea className="h-[350px]">
              {documentsAtRisk.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-600 opacity-50" />
                  <p>All documents are within retention policy</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documentsAtRisk.map(doc => (
                    <div key={doc.id} className="p-3 border rounded-lg bg-card">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{doc.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Loan: {doc.loanId} | Created: {doc.createdAt}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge 
                              variant={doc.action === 'delete' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {doc.action === 'delete' ? 'Pending Deletion' : 'Pending Archive'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {doc.daysUntilAction} days remaining
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => extendRetention(doc.id)}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Extend
                        </Button>
                        <Button
                          size="sm"
                          variant={doc.action === 'delete' ? 'destructive' : 'default'}
                          onClick={() => archiveDocument(doc.id)}
                        >
                          {doc.action === 'delete' ? (
                            <>
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete Now
                            </>
                          ) : (
                            <>
                              <Archive className="h-3 w-3 mr-1" />
                              Archive Now
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
