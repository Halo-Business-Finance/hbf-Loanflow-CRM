import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  ClipboardCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Rocket,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChecklistItem {
  id: string;
  category: string;
  item: string;
  status: 'pass' | 'fail' | 'warning' | 'unchecked';
  details?: string;
  autoChecked: boolean;
}

interface PreFlightResult {
  applicationId: string;
  applicantName: string;
  businessName?: string;
  loanAmount: number;
  items: ChecklistItem[];
  overallStatus: 'ready' | 'issues' | 'blocked';
  readyToSubmit: boolean;
}

const CHECKLIST_CATEGORIES = {
  'Borrower Information': [
    'Full legal name verified',
    'SSN/TIN validated',
    'Date of birth confirmed',
    'Current address verified',
    'Contact information complete'
  ],
  'Business Information': [
    'Business name matches documents',
    'EIN verified',
    'Business address confirmed',
    'Years in business documented',
    'Industry/NAICS code assigned'
  ],
  'Financial Documentation': [
    'Bank statements (3 months)',
    'Tax returns (2 years)',
    'P&L statement current',
    'Balance sheet available',
    'Debt schedule complete'
  ],
  'Loan Details': [
    'Loan amount within program limits',
    'Loan purpose documented',
    'Use of proceeds itemized',
    'Collateral identified',
    'Interest rate confirmed'
  ],
  'Compliance': [
    'OFAC check completed',
    'Credit report pulled',
    'UCC search completed',
    'Flood zone determination',
    'Environmental review (if applicable)'
  ]
};

interface PreFlightChecklistProps {
  applicationId?: string | null;
}

export function PreFlightChecklist({ applicationId }: PreFlightChecklistProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreFlightResult | null>(null);
  const [manualChecks, setManualChecks] = useState<Set<string>>(new Set());

  const runPreFlightCheck = async () => {
    if (!applicationId) {
      toast({
        title: "No Application Selected",
        description: "Please select an application to run pre-flight checks.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch application data
      const { data: contact, error } = await supabase
        .from('contact_entities')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (error) throw error;

      // Fetch documents
      const { data: docs } = await supabase
        .from('lead_documents')
        .select('document_name, document_type')
        .eq('contact_entity_id', applicationId);

      const uploadedDocs = (docs || []).map(d => (d.document_type || d.document_name).toLowerCase());

      // Build checklist with automated checks
      const items: ChecklistItem[] = [];
      let itemId = 0;

      Object.entries(CHECKLIST_CATEGORIES).forEach(([category, checkItems]) => {
        checkItems.forEach(item => {
          const id = `check-${itemId++}`;
          let status: ChecklistItem['status'] = 'unchecked';
          let details: string | undefined;
          let autoChecked = false;

          // Auto-check based on available data
          if (category === 'Borrower Information') {
            if (item.includes('name') && contact.name) { status = 'pass'; autoChecked = true; }
            if (item.includes('address') && contact.home_address) { status = 'pass'; autoChecked = true; }
            if (item.includes('Contact') && (contact.email || contact.phone)) { status = 'pass'; autoChecked = true; }
          }
          
          if (category === 'Business Information') {
            if (item.includes('Business name') && contact.business_name) { status = 'pass'; autoChecked = true; }
            if (item.includes('address') && contact.business_address) { status = 'pass'; autoChecked = true; }
            if (item.includes('Years') && contact.years_in_business) { status = 'pass'; autoChecked = true; }
            if (item.includes('NAICS') && contact.naics_code) { status = 'pass'; autoChecked = true; }
          }

          if (category === 'Financial Documentation') {
            if (item.includes('Bank statements') && uploadedDocs.some(d => d.includes('bank'))) { 
              status = 'pass'; autoChecked = true; 
            }
            if (item.includes('Tax returns') && uploadedDocs.some(d => d.includes('tax'))) { 
              status = 'pass'; autoChecked = true; 
            }
          }

          if (category === 'Loan Details') {
            if (item.includes('Loan amount') && contact.loan_amount) { status = 'pass'; autoChecked = true; }
            if (item.includes('purpose') && contact.purpose_of_loan) { status = 'pass'; autoChecked = true; }
            if (item.includes('Collateral') && contact.collateral_value) { status = 'pass'; autoChecked = true; }
          }

          if (category === 'Compliance') {
            if (item.includes('Credit report') && contact.credit_score) { status = 'pass'; autoChecked = true; }
          }

          // Check manual overrides
          if (manualChecks.has(id)) {
            status = 'pass';
          }

          items.push({ id, category, item, status, details, autoChecked });
        });
      });

      const passCount = items.filter(i => i.status === 'pass').length;
      const failCount = items.filter(i => i.status === 'fail').length;
      const uncheckedCount = items.filter(i => i.status === 'unchecked').length;

      let overallStatus: PreFlightResult['overallStatus'] = 'ready';
      if (failCount > 0) overallStatus = 'blocked';
      else if (uncheckedCount > 5) overallStatus = 'issues';

      setResult({
        applicationId: contact.id,
        applicantName: contact.name,
        businessName: contact.business_name,
        loanAmount: contact.loan_amount || 0,
        items,
        overallStatus,
        readyToSubmit: overallStatus === 'ready'
      });

      toast({
        title: "Pre-Flight Check Complete",
        description: `${passCount}/${items.length} items verified`
      });
    } catch (error) {
      console.error('Error running pre-flight check:', error);
      toast({
        title: "Check Failed",
        description: "Could not complete pre-flight verification",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleManualCheck = (id: string) => {
    const newChecks = new Set(manualChecks);
    if (newChecks.has(id)) {
      newChecks.delete(id);
    } else {
      newChecks.add(id);
    }
    setManualChecks(newChecks);

    // Update result if exists
    if (result) {
      setResult({
        ...result,
        items: result.items.map(item => 
          item.id === id ? { ...item, status: newChecks.has(id) ? 'pass' : 'unchecked' } : item
        )
      });
    }
  };

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      default: return <div className="h-4 w-4 rounded border-2 border-muted-foreground/30" />;
    }
  };

  const completionRate = result 
    ? Math.round((result.items.filter(i => i.status === 'pass').length / result.items.length) * 100)
    : 0;

  const groupedItems = result?.items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>) || {};

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Pre-Flight Checklist</CardTitle>
          </div>
          {result && (
            <Badge className={
              result.overallStatus === 'ready' ? 'bg-green-500/20 text-green-400' :
              result.overallStatus === 'issues' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }>
              {result.overallStatus === 'ready' ? 'Ready' : result.overallStatus === 'issues' ? 'Issues Found' : 'Blocked'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <div className="text-center py-8">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              {applicationId 
                ? "Run pre-flight checks to verify the application is ready for underwriting submission."
                : "Select an application to run pre-flight verification."}
            </p>
            <Button onClick={runPreFlightCheck} disabled={loading || !applicationId} className="gap-2">
              <Rocket className="h-4 w-4" />
              {loading ? 'Running Checks...' : 'Run Pre-Flight Check'}
            </Button>
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex justify-between text-sm mb-2">
                <span>Verification Progress</span>
                <span>{completionRate}% Complete</span>
              </div>
              <Progress value={completionRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {result.items.filter(i => i.status === 'pass').length} of {result.items.length} items verified
              </p>
            </div>

            {/* Checklist */}
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-4">
                {Object.entries(groupedItems).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-sm font-medium text-muted-foreground mb-2">{category}</p>
                    <div className="space-y-1">
                      {items.map((item) => (
                        <div 
                          key={item.id}
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${
                            item.status === 'pass' ? 'bg-green-500/5' : ''
                          }`}
                          onClick={() => !item.autoChecked && toggleManualCheck(item.id)}
                        >
                          {item.autoChecked ? (
                            getStatusIcon(item.status)
                          ) : (
                            <Checkbox 
                              checked={item.status === 'pass'}
                              onCheckedChange={() => toggleManualCheck(item.id)}
                            />
                          )}
                          <span className={`text-sm flex-1 ${item.status === 'pass' ? 'text-muted-foreground' : ''}`}>
                            {item.item}
                          </span>
                          {item.autoChecked && (
                            <Badge variant="outline" className="text-xs">Auto</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={runPreFlightCheck} disabled={loading} className="gap-1">
                <RefreshCw className="h-3 w-3" />
                Re-check
              </Button>
              <Button 
                className="flex-1 gap-2" 
                disabled={!result.readyToSubmit}
              >
                <Rocket className="h-4 w-4" />
                Submit to Underwriting
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
