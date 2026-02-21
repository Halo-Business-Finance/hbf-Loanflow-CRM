import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  FileSearch, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Send,
  RefreshCw,
  FileX,
  FileCheck
} from 'lucide-react';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';

interface DocumentStatus {
  id: string;
  applicationId: string;
  applicantName: string;
  businessName?: string;
  requiredDocs: string[];
  uploadedDocs: string[];
  missingDocs: string[];
  expiredDocs: string[];
  completionRate: number;
  lastReminder?: string;
  daysWaiting: number;
}

const REQUIRED_DOCUMENTS = [
  'Government ID',
  'Bank Statements (3 months)',
  'Tax Returns (2 years)',
  'Business License',
  'Proof of Address',
  'Financial Statements',
  'Business Plan',
  'Collateral Documentation'
];

export function SmartDocumentTracker() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<DocumentStatus[]>([]);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  useEffect(() => {
    fetchDocumentStatus();
  }, []);

  const fetchDocumentStatus = async () => {
    setLoading(true);
    try {
      // Fetch applications in documentation stage
      const { data: contacts, error } = await ibmDb
        .from('contact_entities')
        .select('id, name, business_name, email, created_at, stage')
        .in('stage', ['Documentation', 'Pre-approval', 'Application']);

      if (error) throw error;

      // Fetch uploaded documents for each application
      const statuses: DocumentStatus[] = await Promise.all(
        ((contacts as any[]) || []).map(async (contact) => {
          const { data: docs } = await ibmDb
            .from('lead_documents')
            .select('document_name, document_type, created_at')
            .eq('contact_entity_id', contact.id);

          const uploadedDocs = ((docs as any[]) || []).map(d => d.document_type || d.document_name);
          const missingDocs = REQUIRED_DOCUMENTS.filter(
            req => !uploadedDocs.some(up => up.toLowerCase().includes(req.toLowerCase().split(' ')[0]))
          );
          
          // Simulate expired docs (docs older than 90 days)
          const expiredDocs = ((docs as any[]) || [])
            .filter(d => {
              const uploadDate = new Date(d.created_at);
              const daysSince = (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);
              return daysSince > 90;
            })
            .map(d => d.document_type || d.document_name);

          const daysWaiting = Math.floor(
            (Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            id: contact.id,
            applicationId: contact.id,
            applicantName: contact.name,
            businessName: contact.business_name,
            requiredDocs: REQUIRED_DOCUMENTS,
            uploadedDocs,
            missingDocs,
            expiredDocs,
            completionRate: Math.round(((REQUIRED_DOCUMENTS.length - missingDocs.length) / REQUIRED_DOCUMENTS.length) * 100),
            daysWaiting
          };
        })
      );

      // Sort by completion rate (lowest first) then by days waiting
      statuses.sort((a, b) => {
        if (a.completionRate !== b.completionRate) return a.completionRate - b.completionRate;
        return b.daysWaiting - a.daysWaiting;
      });

      setApplications(statuses);
    } catch (error) {
      console.error('Error fetching document status:', error);
      toast({
        title: "Error",
        description: "Failed to load document status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (app: DocumentStatus) => {
    setSendingReminder(app.id);
    try {
      // Simulate sending reminder (in production, this would call an edge function)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Reminder Sent",
        description: `Document reminder sent to ${app.applicantName} for ${app.missingDocs.length} missing documents.`
      });

      // Update last reminder timestamp
      setApplications(prev => prev.map(a => 
        a.id === app.id ? { ...a, lastReminder: new Date().toISOString() } : a
      ));
    } catch (error) {
      toast({
        title: "Failed to Send",
        description: "Could not send reminder email",
        variant: "destructive"
      });
    } finally {
      setSendingReminder(null);
    }
  };

  const getStatusBadge = (app: DocumentStatus) => {
    if (app.completionRate === 100) {
      return <Badge className="bg-green-500/20 text-green-400">Complete</Badge>;
    }
    if (app.expiredDocs.length > 0) {
      return <Badge className="bg-red-500/20 text-red-400">Has Expired</Badge>;
    }
    if (app.daysWaiting > 7) {
      return <Badge className="bg-orange-500/20 text-orange-400">Overdue</Badge>;
    }
    return <Badge className="bg-yellow-500/20 text-yellow-400">In Progress</Badge>;
  };

  const needsAttention = applications.filter(a => a.completionRate < 100 || a.expiredDocs.length > 0);
  const totalMissing = applications.reduce((sum, a) => sum + a.missingDocs.length, 0);
  const totalExpired = applications.reduce((sum, a) => sum + a.expiredDocs.length, 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Smart Document Tracker</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDocumentStatus} className="gap-1">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
            <p className="text-2xl font-bold text-primary">{needsAttention.length}</p>
            <p className="text-xs text-muted-foreground">Need Attention</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
            <p className="text-2xl font-bold text-yellow-400">{totalMissing}</p>
            <p className="text-xs text-muted-foreground">Missing Docs</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
            <p className="text-2xl font-bold text-red-400">{totalExpired}</p>
            <p className="text-xs text-muted-foreground">Expired Docs</p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading document status...</div>
        ) : applications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No applications in documentation stage</div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{app.businessName || app.applicantName}</p>
                      <p className="text-sm text-muted-foreground">{app.applicantName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(app)}
                      <Badge variant="outline" className="text-xs">
                        {app.daysWaiting}d
                      </Badge>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Document Completion</span>
                      <span>{app.completionRate}%</span>
                    </div>
                    <Progress value={app.completionRate} className="h-2" />
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {app.missingDocs.slice(0, 3).map((doc, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                        <FileX className="h-3 w-3 mr-1" />
                        {doc.split(' ')[0]}
                      </Badge>
                    ))}
                    {app.missingDocs.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{app.missingDocs.length - 3} more</Badge>
                    )}
                    {app.expiredDocs.map((doc, i) => (
                      <Badge key={`exp-${i}`} variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
                        <Clock className="h-3 w-3 mr-1" />
                        Expired
                      </Badge>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 gap-1"
                      onClick={() => sendReminder(app)}
                      disabled={sendingReminder === app.id || app.completionRate === 100}
                    >
                      <Send className="h-3 w-3" />
                      {sendingReminder === app.id ? 'Sending...' : 'Send Reminder'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
