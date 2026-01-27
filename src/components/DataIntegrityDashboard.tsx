import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, AlertTriangle, X, RefreshCw, Database, FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { DataFieldValidator } from "@/lib/data-validator";
import { DataIntegrityFixer } from "@/lib/data-integrity-fixer";
import { CSVImporter } from "@/components/CSVImporter";

interface FieldIssue {
  fieldName: string;
  issueType: "missing" | "type_mismatch" | "format_error" | "consistency_error";
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  recordId: string;
  recordType: "lead" | "client" | "pipeline";
}

export function DataIntegrityDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [auditResults, setAuditResults] = useState<any>(null);
  const [fieldIssues, setFieldIssues] = useState<FieldIssue[]>([]);
  const [autoFixResults, setAutoFixResults] = useState<any>(null);

  const runDataAudit = async () => {
    setLoading(true);
    // Clear previous results first
    setFieldIssues([]);
    setAuditResults(null);
    
    try {
      const validator = new DataFieldValidator();
      const results = await validator.performDataAudit();
      
      // Safety check for results
      if (!results) {
        throw new Error('No results returned from audit');
      }
      
      setAuditResults(results);
      
      // Convert audit results to field issues format with null safety
      const issues: FieldIssue[] = [];
      
      // Process lead issues with null safety
      if (results.leadIssues && Array.isArray(results.leadIssues)) {
        results.leadIssues.forEach((issue: any) => {
          if (issue && issue.validation && issue.validation.errors && Array.isArray(issue.validation.errors)) {
            issue.validation.errors.forEach((error: string) => {
              issues.push({
                fieldName: extractFieldName(error),
                issueType: getIssueType(error),
                description: error,
                severity: "high",
                recordId: issue.id || 'unknown',
                recordType: "lead"
              });
            });
          }
          
          if (issue && issue.validation && issue.validation.warnings && Array.isArray(issue.validation.warnings)) {
            issue.validation.warnings.forEach((warning: string) => {
              issues.push({
                fieldName: extractFieldName(warning),
                issueType: getIssueType(warning),
                description: warning,
                severity: "medium",
                recordId: issue.id || 'unknown',
                recordType: "lead"
              });
            });
          }
        });
      }
      
      // Process client issues with null safety
      if (results.clientIssues && Array.isArray(results.clientIssues)) {
        results.clientIssues.forEach((issue: any) => {
          if (issue && issue.validation && issue.validation.errors && Array.isArray(issue.validation.errors)) {
            issue.validation.errors.forEach((error: string) => {
              issues.push({
                fieldName: extractFieldName(error),
                issueType: getIssueType(error),
                description: error,
                severity: "high",
                recordId: issue.id || 'unknown',
                recordType: "client"
              });
            });
          }
          
          if (issue && issue.validation && issue.validation.warnings && Array.isArray(issue.validation.warnings)) {
            issue.validation.warnings.forEach((warning: string) => {
              issues.push({
                fieldName: extractFieldName(warning),
                issueType: getIssueType(warning),
                description: warning,
                severity: "medium",
                recordId: issue.id || 'unknown',
                recordType: "client"
              });
            });
          }
        });
      }
      
      // Process pipeline issues with null safety
      if (results.pipelineIssues && Array.isArray(results.pipelineIssues)) {
        results.pipelineIssues.forEach((issue: any) => {
          if (issue && issue.validation && issue.validation.errors && Array.isArray(issue.validation.errors)) {
            issue.validation.errors.forEach((error: string) => {
              issues.push({
                fieldName: extractFieldName(error),
                issueType: getIssueType(error),
                description: error,
                severity: "high",
                recordId: issue.id || 'unknown',
                recordType: "pipeline"
              });
            });
          }
          
          if (issue && issue.validation && issue.validation.warnings && Array.isArray(issue.validation.warnings)) {
            issue.validation.warnings.forEach((warning: string) => {
              issues.push({
                fieldName: extractFieldName(warning),
                issueType: getIssueType(warning),
                description: warning,
                severity: "medium",
                recordId: issue.id || 'unknown',
                recordType: "pipeline"
              });
            });
          }
        });
      }
      
      setFieldIssues(issues);
      
      const totalIssues = results.summary?.totalIssues || 0;
      
      toast({
        title: "Data Audit Complete",
        description: `Found ${issues.length} field issues across ${totalIssues} records.`
      });
    } catch (error) {
      console.error('Data audit error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Audit Failed",
        description: `Failed to complete data audit: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const runAutoFix = async () => {
    console.log('🔧 AUTO-FIX BUTTON CLICKED - STARTING PROCESS');
    alert('Auto-fix button clicked! Check console for logs.');
    setLoading(true);
    try {
      console.log('🔧 Creating DataIntegrityFixer...');
      const fixer = new DataIntegrityFixer();
      
      console.log('🔧 Checking authentication...');
      const authCheck = await fixer.checkAuthAndPermissions();
      console.log('🔐 AUTHENTICATION STATUS:', authCheck);
      alert(`Auth check result: ${JSON.stringify(authCheck)}`);
      
      if (!authCheck.authenticated) {
        console.log('❌ USER NOT AUTHENTICATED');
        alert('User not authenticated!');
        toast({
          title: "Authentication Required",
          description: "Please log in to use the auto-fix feature.",
          variant: "destructive"
        });
        setAutoFixResults({ fixed: 0, errors: ['User not authenticated'] });
        return;
      }
      
      console.log('✅ USER AUTHENTICATED, PROCEEDING WITH AUTO-FIX...');
      alert('User authenticated, starting fix...');
      const results = await fixer.fixCurrentUserContactIssues();
      console.log('✅ AUTO-FIX RESULTS:', results);
      alert(`Fix results: ${JSON.stringify(results)}`);
      setAutoFixResults(results);
      
      toast({
        title: results.fixed > 0 ? "Auto-fix Successful!" : "Auto-fix Complete",
        description: results.fixed > 0 
          ? `Fixed ${results.fixed} issues. Running fresh audit...`
          : results.errors.length > 0 
            ? results.errors[0]
            : "No issues found to fix.",
        variant: results.fixed > 0 ? "default" : results.errors.some(e => e.includes('resolved')) ? "default" : "destructive"
      });
      
      // Always re-run audit after auto-fix to show current state
      console.log('🔄 Re-running audit after auto-fix...');
      await runDataAudit();
    } catch (error) {
      console.error('❌ Auto-fix error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Auto-Fix Failed",
        description: `Failed to auto-fix data issues: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getIssueTypeIcon = (type: string) => {
    switch (type) {
      case 'missing': return <X className="h-4 w-4" />;
      case 'type_mismatch': return <AlertTriangle className="h-4 w-4" />;
      case 'format_error': return <FileText className="h-4 w-4" />;
      case 'consistency_error': return <Database className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <StandardPageLayout>
      <IBMPageHeader
        title="Data Integrity Dashboard"
        subtitle="Audit and fix data quality issues across your database"
        actions={
          <>
            <Button 
              onClick={() => {
                console.log('Run Data Audit button clicked!');
                console.log('Loading state:', loading);
                runDataAudit();
              }} 
              disabled={loading}
              size="sm" 
              className="h-8 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Run Data Audit
            </Button>
            
            <Button 
              onClick={() => {
                console.log('Auto-fix button clicked!');
                console.log('Loading state:', loading);
                console.log('Audit results exist:', !!auditResults);
                runAutoFix();
              }} 
              disabled={loading || !auditResults}
              size="sm"
              variant="outline"
              className="h-8 text-xs font-medium border-2 border-[#0A1628] hover:bg-[#0A1628] hover:text-white"
            >
              <Check className="h-3 w-3 mr-2" />
              Auto-Fix Issues
            </Button>
          </>
        }
      />
      
      <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-fade-in">

        {/* Summary Alert */}
        {auditResults && (
          <Alert>
            <AlertDescription>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2">
                <div>
                  <span className="font-medium">Field Issues:</span> {fieldIssues.length}
                </div>
                <div>
                  <span className="font-medium">Critical:</span> {auditResults.summary?.criticalIssues || 0}
                </div>
                <div>
                  <span className="font-medium">Warnings:</span> {auditResults.summary?.warningIssues || 0}
                </div>
                <div>
                  <span className="font-medium">Duplicate Leads:</span> {auditResults.summary?.duplicateLeadsCount || 0}
                </div>
                <div>
                  <span className="font-medium">Duplicate Loans:</span> {auditResults.summary?.duplicateLoansCount || 0}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Content Area */}
        <div className="space-y-6">
          <Tabs defaultValue="import" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 bg-[#0A1628] p-1 gap-2">
              <TabsTrigger 
                value="import" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Import CSV</span>
              </TabsTrigger>
              <TabsTrigger 
                value="issues" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Field Issues</span>
              </TabsTrigger>
              <TabsTrigger 
                value="duplicates" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>Duplicates</span>
              </TabsTrigger>
              <TabsTrigger 
                value="summary" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                <span>Summary</span>
              </TabsTrigger>
              <TabsTrigger 
                value="autofix" 
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Auto-Fix</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-4">
              <CSVImporter onImportComplete={runDataAudit} />
            </TabsContent>

            <TabsContent value="issues" className="space-y-4">
                <div className="space-y-2">
                  {fieldIssues.map((issue) => (
                    <Card key={`${issue.recordId}-${issue.fieldName}-${issue.issueType}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                             <div className="flex items-center gap-2">
                               {getIssueTypeIcon(issue.issueType)}
                               <span className="font-medium text-xs">
                                 {issue.severity.toUpperCase()}
                               </span>
                               <span className="font-medium">{issue.fieldName}</span>
                               <span className="text-xs">
                                 {issue.recordType}
                               </span>
                             </div>
                            <p className="text-sm text-muted-foreground">{issue.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Record ID: {issue.recordId} | Type: {issue.issueType}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {fieldIssues.length === 0 && auditResults && (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">No Field Issues Found</h3>
                        <p className="text-muted-foreground">All data fields are correctly named and consistent.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="duplicates" className="space-y-4">
                {!auditResults ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No Audit Data</h3>
                      <p className="text-muted-foreground">Run a data audit to check for duplicates.</p>
                    </CardContent>
                  </Card>
                ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Duplicate Leads</h3>
                    {auditResults?.duplicateLeads && auditResults.duplicateLeads.length > 0 ? (
                      <div className="space-y-2">
                        {auditResults.duplicateLeads.map((dup: any) => (
                          <Card key={dup.id}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <X className="h-4 w-4 text-red-600" />
                                    <span className="font-medium">{dup.name}</span>
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                      {dup.matchType}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Duplicate of lead: {dup.duplicateOf}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="p-8 text-center">
                          <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
                          <h3 className="text-lg font-medium">No Duplicate Leads Found</h3>
                          <p className="text-muted-foreground">All leads are unique.</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Duplicate Loans</h3>
                    {auditResults?.duplicateLoans && auditResults.duplicateLoans.length > 0 ? (
                      <div className="space-y-2">
                        {auditResults.duplicateLoans.map((dup: any) => (
                          <Card key={dup.id}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <X className="h-4 w-4 text-orange-600" />
                                    <span className="font-medium">{dup.leadName}</span>
                                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                      Loan Duplicate
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Match details: {dup.matchDetails}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Duplicate of: {dup.duplicateOf}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="p-8 text-center">
                          <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
                          <h3 className="text-lg font-medium">No Duplicate Loans Found</h3>
                          <p className="text-muted-foreground">All loan applications are unique.</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
                )}
              </TabsContent>

              <TabsContent value="summary" className="space-y-4">
                {!auditResults ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium">No Audit Data</h3>
                      <p className="text-muted-foreground">Run a data audit to see the summary.</p>
                    </CardContent>
                  </Card>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Lead Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{auditResults?.leadIssues?.length || 0}</div>
                      <p className="text-sm text-muted-foreground">Records with issues</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Client Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{auditResults?.clientIssues?.length || 0}</div>
                      <p className="text-sm text-muted-foreground">Records with issues</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Pipeline Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{auditResults?.pipelineIssues?.length || 0}</div>
                      <p className="text-sm text-muted-foreground">Records with issues</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Duplicate Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{auditResults?.summary?.duplicateLeadsCount || 0}</div>
                      <p className="text-sm text-muted-foreground">Potential duplicates</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Duplicate Loans</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">{auditResults?.summary?.duplicateLoansCount || 0}</div>
                      <p className="text-sm text-muted-foreground">Potential duplicates</p>
                    </CardContent>
                  </Card>
                </div>
                )}
              </TabsContent>

              <TabsContent value="autofix" className="space-y-4">
                {autoFixResults ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Auto-Fix Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium">Issues Fixed:</span> {autoFixResults.fixed || 0}
                        </div>
                        <div>
                          <span className="font-medium">Errors:</span> {autoFixResults.errors?.length || 0}
                        </div>
                      </div>
                      
                      {autoFixResults.errors && autoFixResults.errors.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Errors:</h4>
                          {autoFixResults.errors.map((error: string) => (
                            <Alert key={error} variant="destructive">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>{error}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">No auto-fix results yet. Run auto-fix to see results.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
      </div>
    </StandardPageLayout>
  );
}

// Helper functions
function extractFieldName(message: string): string {
  const match = message.match(/'([^']+)'/);
  return match ? match[1] : 'unknown_field';
}

function getIssueType(message: string): "missing" | "type_mismatch" | "format_error" | "consistency_error" {
  if (message.includes('missing') || message.includes('required')) return 'missing';
  if (message.includes('should be') || message.includes('type')) return 'type_mismatch';
  if (message.includes('format') || message.includes('invalid')) return 'format_error';
  if (message.includes('consistency') || message.includes('greater than')) return 'consistency_error';
  return 'format_error';
}