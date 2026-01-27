import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PROCESSOR_STAGES } from '@/lib/loan-stages';

interface DocumentStatus {
  applicationId: string;
  applicantName: string;
  businessName?: string;
  requiredDocs: number;
  uploadedDocs: number;
  missingDocs: string[];
  completionPercentage: number;
}

export function DocumentChecklistWidget() {
  const [statuses, setStatuses] = useState<DocumentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocumentStatus();
  }, []);

  const fetchDocumentStatus = async () => {
    try {
      // Fetch applications in documentation stage
      const { data: applications, error: appError } = await supabase
        .from('contact_entities')
        .select('id, name, business_name, loan_type')
        .in('stage', PROCESSOR_STAGES)
        .limit(10);

      if (appError) throw appError;

      // Standard required documents (will be replaced by document_requirements table query when types are generated)
      const standardRequiredDocs = [
        'Business Tax Returns (3 years)',
        'Personal Tax Returns (3 years)',
        'Financial Statements',
        'Bank Statements (3 months)',
        'Business License',
        'Articles of Organization',
        'Personal Financial Statement',
        'Debt Schedule',
      ];

      // Fetch document counts for each application
      const statusPromises = (applications || []).map(async (app) => {
        // Get uploaded documents for this application's lead
        const { data: leadData } = await supabase
          .from('leads')
          .select('id')
          .eq('contact_entity_id', app.id)
          .single();

        let uploadedCount = 0;
        let uploadedDocNames: string[] = [];
        
        if (leadData) {
          const { data: docs, count } = await supabase
            .from('lead_documents')
            .select('document_name', { count: 'exact' })
            .eq('lead_id', leadData.id);
          
          uploadedCount = count || 0;
          uploadedDocNames = (docs || []).map(d => d.document_name);
        }

        const requiredDocs = standardRequiredDocs.length;
        const completion = requiredDocs > 0 ? (uploadedCount / requiredDocs) * 100 : 0;

        // Find missing required documents
        const missingDocs = standardRequiredDocs.filter(reqDoc => 
          !uploadedDocNames.some(uploaded => 
            uploaded.toLowerCase().includes(reqDoc.toLowerCase().split(' ')[0])
          )
        );

        return {
          applicationId: app.id,
          applicantName: app.name,
          businessName: app.business_name,
          requiredDocs,
          uploadedDocs: uploadedCount,
          missingDocs,
          completionPercentage: Math.min(completion, 100),
        };
      });

      const statuses = await Promise.all(statusPromises);
      statuses.sort((a, b) => a.completionPercentage - b.completionPercentage);
      
      setStatuses(statuses);
    } catch (error) {
      console.error('Error fetching document status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#161616]" />
            <CardTitle className="text-base font-normal text-[#161616]">
              Document Checklist
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {statuses.filter(s => s.completionPercentage < 100).length} Incomplete
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-[#525252]">Loading document status...</p>
          </div>
        ) : statuses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <FileText className="h-8 w-8 text-[#525252] mb-2" />
            <p className="text-sm text-[#525252]">No applications requiring documents</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {statuses.map((status) => (
                <div
                  key={status.applicationId}
                  className="p-3 border border-[#e0e0e0] rounded-lg hover:bg-[#f4f4f4] transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-[#161616]">
                        {status.businessName || status.applicantName}
                      </p>
                      <p className="text-xs text-[#525252]">{status.applicantName}</p>
                    </div>
                    {status.completionPercentage === 100 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : status.completionPercentage > 50 ? (
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#525252]">
                        {status.uploadedDocs} of {status.requiredDocs} documents
                      </span>
                      <span className="text-xs font-medium text-[#161616]">
                        {status.completionPercentage.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={status.completionPercentage} className="h-2" />
                  </div>

                  {status.missingDocs.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#e0e0e0]">
                      <p className="text-xs text-[#525252] mb-1">Missing Documents:</p>
                      <div className="flex flex-wrap gap-1">
                        {status.missingDocs.slice(0, 3).map((doc, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {doc}
                          </Badge>
                        ))}
                        {status.missingDocs.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{status.missingDocs.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
