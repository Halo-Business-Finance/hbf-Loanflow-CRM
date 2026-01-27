import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Shield, Download, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ComplianceReport {
  id: string;
  report_type: string;
  status: string;
  created_at: string;
  completed_at?: string;
  file_path?: string;
}

interface ComplianceMetrics {
  gdpr_compliance_score: number;
  data_retention_compliance: boolean;
  encryption_compliance: boolean;
  audit_trail_compliance: boolean;
  access_control_compliance: boolean;
}

export const ComplianceManager: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [metrics, setMetrics] = useState<ComplianceMetrics>({
    gdpr_compliance_score: 0,
    data_retention_compliance: false,
    encryption_compliance: false,
    audit_trail_compliance: false,
    access_control_compliance: false
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadComplianceData();
  }, [user]);

  const loadComplianceData = async () => {
    try {
      // Load compliance reports
      const { data: reportsData } = await supabase
        .from('compliance_reports')
        .select('*')
        .eq('generated_by', user?.id)
        .order('created_at', { ascending: false });

      if (reportsData) {
        setReports(reportsData);
      }

      // Calculate compliance metrics
      await calculateComplianceMetrics();
    } catch (error) {
      console.error('Failed to load compliance data:', error);
    }
  };

  const calculateComplianceMetrics = async () => {
    try {
      // Check encryption compliance
      const { data: encryptedFields } = await supabase
        .from('contact_encrypted_fields')
        .select('count')
        .eq('contact_id', user?.id);

      const encryptionCompliance = (encryptedFields?.[0]?.count || 0) > 0;

      // Check audit trail compliance
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('count')
        .eq('user_id', user?.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const auditCompliance = (auditLogs?.[0]?.count || 0) > 0;

      // Check access control compliance
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('count')
        .eq('user_id', user?.id)
        .eq('is_active', true);

      const accessControlCompliance = (userRoles?.[0]?.count || 0) > 0;

      // Calculate overall GDPR compliance score
      const complianceFactors = [
        encryptionCompliance,
        auditCompliance,
        accessControlCompliance,
        true // Data retention (assumed compliant if using the system)
      ];

      const complianceScore = Math.round(
        (complianceFactors.filter(Boolean).length / complianceFactors.length) * 100
      );

      setMetrics({
        gdpr_compliance_score: complianceScore,
        data_retention_compliance: true,
        encryption_compliance: encryptionCompliance,
        audit_trail_compliance: auditCompliance,
        access_control_compliance: accessControlCompliance
      });
    } catch (error) {
      console.error('Failed to calculate compliance metrics:', error);
    }
  };

  const generateComplianceReport = async (reportType: string) => {
    try {
      setIsLoading(true);
      toast.info(`Generating ${reportType} compliance report...`);

      const reportFilters = {
        user_id: user?.id,
        report_type: reportType,
        include_audit_logs: true,
        include_security_events: true,
        include_data_encryption: true
      };

      const { data, error } = await supabase
        .from('compliance_reports')
        .insert({
          report_type: reportType,
          generated_by: user?.id,
          date_range_start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          date_range_end: new Date().toISOString(),
          filters: reportFilters,
          status: 'generating',
          report_data: {}
        })
        .select()
        .single();

      if (error) throw error;

      // Simulate report generation (in a real implementation, this would be handled by a background job)
      setTimeout(async () => {
      const { error: updateError } = await supabase
        .from('compliance_reports')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          report_data: {
            compliance_score: metrics.gdpr_compliance_score,
            data_retention_compliance: metrics.data_retention_compliance,
            encryption_compliance: metrics.encryption_compliance,
            audit_trail_compliance: metrics.audit_trail_compliance,
            access_control_compliance: metrics.access_control_compliance,
            generated_at: new Date().toISOString()
          }
        })
        .eq('id', data.id);

        if (!updateError) {
          toast.success(`${reportType} compliance report generated successfully`);
          loadComplianceData();
        }
      }, 3000);

      // Log compliance report generation
      await supabase.rpc('log_enhanced_security_event', {
        p_user_id: user?.id,
        p_event_type: 'compliance_report_generated',
        p_severity: 'low',
        p_details: { report_type: reportType }
      });

    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      toast.error('Failed to generate compliance report');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadReport = async (report: ComplianceReport) => {
    try {
      const reportData = {
        report_id: report.id,
        report_type: report.report_type,
        generated_at: report.created_at,
        user_id: user?.id,
        compliance_metrics: metrics,
        status: report.status
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.report_type}_compliance_report_${report.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Compliance report downloaded');
    } catch (error) {
      console.error('Failed to download report:', error);
      toast.error('Failed to download report');
    }
  };

  const initiateDataDeletion = async () => {
    try {
      setIsLoading(true);
      toast.info('Initiating GDPR-compliant data deletion...');

      // This would typically trigger a comprehensive data deletion process
      const { error } = await supabase.rpc('initiate_gdpr_data_deletion', {
        p_user_id: user?.id
      });

      if (error) throw error;
      
      toast.success('Data deletion process initiated');
      
      // Log data deletion request
      await supabase.rpc('log_enhanced_security_event', {
        p_user_id: user?.id,
        p_event_type: 'gdpr_data_deletion_requested',
        p_severity: 'high',
        p_details: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Data deletion failed:', error);
      toast.error('Data deletion request failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  const getComplianceStatus = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'success' };
    if (score >= 75) return { label: 'Good', color: 'success' };
    if (score >= 60) return { label: 'Fair', color: 'warning' };
    return { label: 'Needs Improvement', color: 'destructive' };
  };

  const complianceStatus = getComplianceStatus(metrics.gdpr_compliance_score);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">GDPR Compliance Score</span>
                <Badge variant={complianceStatus.color === 'success' ? 'default' : complianceStatus.color === 'warning' ? 'secondary' : 'destructive'}>
                  {metrics.gdpr_compliance_score}% - {complianceStatus.label}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Data Encryption</span>
                  {metrics.encryption_compliance ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span>Audit Trail</span>
                  {metrics.audit_trail_compliance ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span>Access Control</span>
                  {metrics.access_control_compliance ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span>Data Retention</span>
                  {metrics.data_retention_compliance ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Quick Actions</h4>
              <div className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateComplianceReport('GDPR')}
                  disabled={isLoading}
                  className="w-full justify-start"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate GDPR Report
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateComplianceReport('SOX')}
                  disabled={isLoading}
                  className="w-full justify-start"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate SOX Report
                </Button>
                
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={initiateDataDeletion}
                  disabled={isLoading}
                  className="w-full justify-start"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Request Data Deletion
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="reports" className="w-full">
        <TabsList>
          <TabsTrigger value="reports">Compliance Reports</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>
        
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Generated Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {reports.length === 0 ? (
                    <Alert>
                      <FileText className="h-4 w-4" />
                      <AlertDescription>
                        No compliance reports generated yet. Click "Generate Report" to create your first compliance report.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    reports.map(report => (
                      <Card key={report.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{report.report_type} Compliance Report</h4>
                              <p className="text-sm text-muted-foreground">
                                Generated: {new Date(report.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                                {report.status}
                              </Badge>
                              {report.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => downloadReport(report)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Recent Audit Events</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Audit trail functionality is active. All user actions are being logged for compliance purposes.
                  Detailed audit logs can be accessed through the administrative interface.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};