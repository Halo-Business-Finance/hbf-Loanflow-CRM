import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  FileCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  FileText,
  DollarSign,
  Shield,
  Building,
  User,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  category: 'documents' | 'financial' | 'legal' | 'parties';
  required: boolean;
  completed: boolean;
  notes?: string;
}

interface LoanChecklist {
  loanId: string;
  borrowerName: string;
  businessName?: string;
  loanAmount: number;
  loanType?: string;
  items: ChecklistItem[];
  completionPercentage: number;
  status: 'pending' | 'in-progress' | 'ready' | 'blocked';
}

const defaultChecklistItems: Omit<ChecklistItem, 'id' | 'completed'>[] = [
  // Documents
  { label: 'Final Loan Agreement Signed', category: 'documents', required: true },
  { label: 'Promissory Note Executed', category: 'documents', required: true },
  { label: 'Security Agreement Signed', category: 'documents', required: true },
  { label: 'UCC Financing Statement Filed', category: 'documents', required: true },
  { label: 'Title Insurance Received', category: 'documents', required: true },
  { label: 'Insurance Certificate on File', category: 'documents', required: true },
  { label: 'Personal Guarantee Signed', category: 'documents', required: false },
  
  // Financial
  { label: 'Final Funding Amount Confirmed', category: 'financial', required: true },
  { label: 'Wire Instructions Verified', category: 'financial', required: true },
  { label: 'Origination Fee Calculated', category: 'financial', required: true },
  { label: 'Closing Costs Disclosed', category: 'financial', required: true },
  { label: 'First Payment Date Set', category: 'financial', required: true },
  
  // Legal
  { label: 'Legal Review Complete', category: 'legal', required: true },
  { label: 'Compliance Check Passed', category: 'legal', required: true },
  { label: 'OFAC/AML Screening Clear', category: 'legal', required: true },
  { label: 'Flood Determination Received', category: 'legal', required: false },
  
  // Parties
  { label: 'Title Company Confirmed', category: 'parties', required: true },
  { label: 'Escrow Agent Assigned', category: 'parties', required: true },
  { label: 'Notary Scheduled', category: 'parties', required: true },
  { label: 'Closing Date/Time Confirmed', category: 'parties', required: true },
];

const categoryIcons = {
  documents: FileText,
  financial: DollarSign,
  legal: Shield,
  parties: Building,
};

const categoryLabels = {
  documents: 'Document Requirements',
  financial: 'Financial Verification',
  legal: 'Legal & Compliance',
  parties: 'Closing Parties',
};

export function PreClosingChecklist() {
  const [checklists, setChecklists] = useState<LoanChecklist[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchClosingLoans();
  }, []);

  const fetchClosingLoans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_entities')
        .select('id, name, business_name, loan_amount, loan_type, stage')
        .eq('stage', 'Closing')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const loanChecklists: LoanChecklist[] = (data || []).map(loan => {
        // Generate checklist items with random completion for demo
        const items: ChecklistItem[] = defaultChecklistItems.map((item, index) => ({
          ...item,
          id: `${loan.id}-${index}`,
          completed: Math.random() > 0.4, // Random completion for demo
        }));

        const completedCount = items.filter(i => i.completed).length;
        const requiredItems = items.filter(i => i.required);
        const requiredCompleted = requiredItems.filter(i => i.completed).length;
        const completionPercentage = Math.round((completedCount / items.length) * 100);
        
        let status: LoanChecklist['status'] = 'pending';
        if (requiredCompleted === requiredItems.length) {
          status = 'ready';
        } else if (completedCount > 0) {
          status = 'in-progress';
        }
        if (requiredItems.some(i => !i.completed && i.category === 'legal')) {
          status = 'blocked';
        }

        return {
          loanId: loan.id,
          borrowerName: loan.name || 'Unknown',
          businessName: loan.business_name,
          loanAmount: loan.loan_amount || 0,
          loanType: loan.loan_type,
          items,
          completionPercentage,
          status,
        };
      });

      setChecklists(loanChecklists);
      if (loanChecklists.length > 0 && !selectedLoan) {
        setSelectedLoan(loanChecklists[0].loanId);
      }
    } catch (error) {
      console.error('Error fetching closing loans:', error);
      toast({
        title: 'Error',
        description: 'Failed to load closing loans',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = (loanId: string, itemId: string) => {
    setChecklists(prev => prev.map(checklist => {
      if (checklist.loanId !== loanId) return checklist;
      
      const updatedItems = checklist.items.map(item => 
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );
      
      const completedCount = updatedItems.filter(i => i.completed).length;
      const requiredItems = updatedItems.filter(i => i.required);
      const requiredCompleted = requiredItems.filter(i => i.completed).length;
      const completionPercentage = Math.round((completedCount / updatedItems.length) * 100);
      
      let status: LoanChecklist['status'] = 'pending';
      if (requiredCompleted === requiredItems.length) {
        status = 'ready';
      } else if (completedCount > 0) {
        status = 'in-progress';
      }

      return {
        ...checklist,
        items: updatedItems,
        completionPercentage,
        status,
      };
    }));

    toast({
      title: 'Checklist Updated',
      description: 'Item status has been updated',
    });
  };

  const getStatusBadge = (status: LoanChecklist['status']) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-600 hover:bg-green-700">Ready to Close</Badge>;
      case 'in-progress':
        return <Badge variant="default">In Progress</Badge>;
      case 'blocked':
        return <Badge variant="destructive">Blocked</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const selectedChecklist = checklists.find(c => c.loanId === selectedLoan);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading checklists...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Loan List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Closing Queue
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchClosingLoans}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {checklists.length} loans pending closing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {checklists.map(checklist => (
                <div
                  key={checklist.loanId}
                  onClick={() => setSelectedLoan(checklist.loanId)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedLoan === checklist.loanId
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">
                        {checklist.businessName || checklist.borrowerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(checklist.loanAmount)}
                      </p>
                    </div>
                    {getStatusBadge(checklist.status)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Completion</span>
                      <span>{checklist.completionPercentage}%</span>
                    </div>
                    <Progress value={checklist.completionPercentage} className="h-1.5" />
                  </div>
                </div>
              ))}
              {checklists.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <p className="text-sm text-muted-foreground">No loans pending closing</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Checklist Details */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {selectedChecklist?.businessName || selectedChecklist?.borrowerName || 'Select a Loan'}
              </CardTitle>
              {selectedChecklist && (
                <CardDescription className="flex items-center gap-4 mt-1">
                  <span>{formatCurrency(selectedChecklist.loanAmount)}</span>
                  <span>•</span>
                  <span>{selectedChecklist.loanType || 'Commercial Loan'}</span>
                </CardDescription>
              )}
            </div>
            {selectedChecklist && (
              <div className="text-right">
                {getStatusBadge(selectedChecklist.status)}
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedChecklist.completionPercentage}% complete
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {selectedChecklist ? (
            <ScrollArea className="h-[500px]">
              <div className="space-y-6">
                {(['documents', 'financial', 'legal', 'parties'] as const).map(category => {
                  const Icon = categoryIcons[category];
                  const categoryItems = selectedChecklist.items.filter(i => i.category === category);
                  const completedInCategory = categoryItems.filter(i => i.completed).length;

                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-medium">{categoryLabels[category]}</h3>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {completedInCategory}/{categoryItems.length}
                        </Badge>
                      </div>
                      <div className="space-y-2 ml-6">
                        {categoryItems.map(item => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              checked={item.completed}
                              onCheckedChange={() => toggleChecklistItem(selectedChecklist.loanId, item.id)}
                            />
                            <div className="flex-1">
                              <span className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                                {item.label}
                              </span>
                              {item.required && !item.completed && (
                                <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
                              )}
                            </div>
                            {item.completed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : item.required ? (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-center">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Select a loan to view its closing checklist</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}