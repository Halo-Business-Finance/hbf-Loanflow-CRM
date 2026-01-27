import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Layers, 
  GripVertical, 
  FileText, 
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StackedDocument {
  id: string;
  name: string;
  type: string;
  category: string;
  order: number;
  status: 'present' | 'missing';
  filePath?: string;
}

// Standard SBA/Commercial loan stacking order
const STACKING_ORDER = [
  { category: 'Cover Sheet', items: ['Loan Submission Cover Sheet', 'Table of Contents'] },
  { category: 'Borrower Information', items: ['SBA Form 1919', 'Personal Financial Statement', 'Resume/Bio'] },
  { category: 'Business Information', items: ['Business License', 'Articles of Incorporation', 'Operating Agreement', 'Organizational Chart'] },
  { category: 'Financial Documents', items: ['Tax Returns (3 years)', 'Bank Statements (3 months)', 'P&L Statement', 'Balance Sheet', 'Debt Schedule'] },
  { category: 'Loan Request', items: ['Loan Application', 'Use of Proceeds', 'Business Plan/Projections'] },
  { category: 'Collateral', items: ['Collateral List', 'Appraisal', 'Title Report', 'Insurance Declarations'] },
  { category: 'Compliance', items: ['Credit Report', 'OFAC Check', 'UCC Search Results', 'Environmental Report'] },
  { category: 'Additional', items: ['Other Supporting Documents', 'Correspondence'] }
];

interface StackingOrderAutomationProps {
  applicationId?: string | null;
}

export function StackingOrderAutomation({ applicationId }: StackingOrderAutomationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<StackedDocument[]>([]);
  const [applicantName, setApplicantName] = useState<string>('');

  useEffect(() => {
    if (applicationId) {
      generateStackingOrder();
    }
  }, [applicationId]);

  const generateStackingOrder = async () => {
    if (!applicationId) return;

    setLoading(true);
    try {
      // Fetch application info
      const { data: contact } = await supabase
        .from('contact_entities')
        .select('name, business_name')
        .eq('id', applicationId)
        .single();

      setApplicantName(contact?.business_name || contact?.name || 'Unknown');

      // Fetch uploaded documents
      const { data: uploadedDocs } = await supabase
        .from('lead_documents')
        .select('id, document_name, document_type, file_path')
        .eq('contact_entity_id', applicationId);

      // Build stacking order with status
      const stackedDocs: StackedDocument[] = [];
      let order = 1;

      STACKING_ORDER.forEach(section => {
        section.items.forEach(item => {
          const matchingDoc = (uploadedDocs || []).find(d => 
            (d.document_type || d.document_name || '').toLowerCase().includes(item.toLowerCase().split(' ')[0].toLowerCase())
          );

          stackedDocs.push({
            id: matchingDoc?.id || `placeholder-${order}`,
            name: item,
            type: matchingDoc?.document_type || item,
            category: section.category,
            order,
            status: matchingDoc ? 'present' : 'missing',
            filePath: matchingDoc?.file_path
          });
          order++;
        });
      });

      setDocuments(stackedDocs);
    } catch (error) {
      console.error('Error generating stacking order:', error);
      toast({
        title: "Error",
        description: "Failed to generate stacking order",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const moveDocument = (index: number, direction: 'up' | 'down') => {
    const newDocs = [...documents];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newDocs.length) return;

    [newDocs[index], newDocs[targetIndex]] = [newDocs[targetIndex], newDocs[index]];
    
    // Update order numbers
    newDocs.forEach((doc, i) => doc.order = i + 1);
    setDocuments(newDocs);
  };

  const exportStackingOrder = () => {
    const content = documents
      .map((doc, i) => `${i + 1}. [${doc.status === 'present' ? '✓' : '✗'}] ${doc.name} (${doc.category})`)
      .join('\n');

    const blob = new Blob([`Stacking Order for ${applicantName}\n${'='.repeat(50)}\n\n${content}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stacking-order-${applicantName.replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "Stacking order exported successfully"
    });
  };

  const presentCount = documents.filter(d => d.status === 'present').length;
  const missingCount = documents.filter(d => d.status === 'missing').length;

  const groupedDocs = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, StackedDocument[]>);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Stacking Order</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={generateStackingOrder} disabled={loading || !applicationId}>
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportStackingOrder} disabled={documents.length === 0}>
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {applicantName && (
          <p className="text-sm text-muted-foreground">{applicantName}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!applicationId ? (
          <div className="text-center py-8">
            <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Select an application to generate stacking order</p>
          </div>
        ) : loading ? (
          <div className="py-8 text-center text-muted-foreground">Generating stacking order...</div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex gap-3">
              <div className="flex-1 p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-lg font-bold text-green-400">{presentCount}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
              <div className="flex-1 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-lg font-bold text-red-400">{missingCount}</p>
                <p className="text-xs text-muted-foreground">Missing</p>
              </div>
            </div>

            {/* Document List */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {Object.entries(groupedDocs).map(([category, docs]) => (
                  <div key={category}>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{category}</p>
                    <div className="space-y-1">
                      {docs.map((doc, index) => {
                        const globalIndex = documents.findIndex(d => d.id === doc.id);
                        return (
                          <div 
                            key={doc.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                              doc.status === 'present' 
                                ? 'bg-green-500/5 border-green-500/20' 
                                : 'bg-muted/30 border-border'
                            }`}
                          >
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0"
                                onClick={() => moveDocument(globalIndex, 'up')}
                                disabled={globalIndex === 0}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0"
                                onClick={() => moveDocument(globalIndex, 'down')}
                                disabled={globalIndex === documents.length - 1}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="text-xs text-muted-foreground w-6">{doc.order}.</span>
                            {doc.status === 'present' ? (
                              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                            )}
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className={`text-sm flex-1 ${doc.status === 'missing' ? 'text-muted-foreground' : ''}`}>
                              {doc.name}
                            </span>
                            <Badge variant="outline" className={`text-xs ${
                              doc.status === 'present' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {doc.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
