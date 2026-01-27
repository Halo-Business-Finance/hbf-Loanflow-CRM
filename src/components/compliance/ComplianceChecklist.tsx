import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ClipboardCheck, 
  FileText, 
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

interface ChecklistItem {
  id: string;
  category: string;
  item: string;
  description: string;
  required: boolean;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

interface LoanTypeChecklist {
  type: string;
  name: string;
  description: string;
  items: ChecklistItem[];
}

const COMPLIANCE_CHECKLISTS: LoanTypeChecklist[] = [
  {
    type: 'sba_7a',
    name: 'SBA 7(a)',
    description: 'Standard SBA 7(a) loan compliance requirements',
    items: [
      { id: '7a-1', category: 'Eligibility', item: 'Business Size Verification', description: 'Confirm business meets SBA size standards', required: true, completed: false },
      { id: '7a-2', category: 'Eligibility', item: 'For-Profit Status Confirmed', description: 'Verify business operates for profit', required: true, completed: false },
      { id: '7a-3', category: 'Eligibility', item: 'US Location Verified', description: 'Business operates in the United States', required: true, completed: false },
      { id: '7a-4', category: 'Documentation', item: 'SBA Form 1919', description: 'Borrower Information Form completed', required: true, completed: false },
      { id: '7a-5', category: 'Documentation', item: 'SBA Form 1920', description: 'Lender\'s Application for Guaranty', required: true, completed: false },
      { id: '7a-6', category: 'Documentation', item: 'Personal Financial Statement', description: 'SBA Form 413 for all 20%+ owners', required: true, completed: false },
      { id: '7a-7', category: 'Documentation', item: 'Business Financial Statements', description: '3 years of business tax returns', required: true, completed: false },
      { id: '7a-8', category: 'Documentation', item: 'Personal Tax Returns', description: '3 years for all 20%+ owners', required: true, completed: false },
      { id: '7a-9', category: 'Credit', item: 'Credit Report Pulled', description: 'Credit reports for all 20%+ owners', required: true, completed: false },
      { id: '7a-10', category: 'Credit', item: 'Credit Memo Prepared', description: 'Detailed credit analysis documented', required: true, completed: false },
      { id: '7a-11', category: 'Collateral', item: 'Collateral Analysis', description: 'Full collateral evaluation completed', required: true, completed: false },
      { id: '7a-12', category: 'Legal', item: 'Articles of Organization', description: 'Business formation documents verified', required: true, completed: false },
      { id: '7a-13', category: 'Legal', item: 'Operating Agreement', description: 'Current operating agreement on file', required: false, completed: false },
      { id: '7a-14', category: 'Insurance', item: 'Hazard Insurance', description: 'Adequate insurance coverage verified', required: true, completed: false },
      { id: '7a-15', category: 'Insurance', item: 'Life Insurance', description: 'Key person life insurance if required', required: false, completed: false },
    ]
  },
  {
    type: 'sba_504',
    name: 'SBA 504',
    description: 'CDC/504 loan program compliance requirements',
    items: [
      { id: '504-1', category: 'Eligibility', item: 'Net Worth Test', description: 'Tangible net worth under $15M', required: true, completed: false },
      { id: '504-2', category: 'Eligibility', item: 'Average Net Income Test', description: 'Avg net income under $5M (2 years)', required: true, completed: false },
      { id: '504-3', category: 'Project', item: 'Job Creation Plan', description: 'One job per $75,000 of debenture', required: true, completed: false },
      { id: '504-4', category: 'Project', item: 'Fixed Asset Purpose', description: 'Funds used for fixed assets only', required: true, completed: false },
      { id: '504-5', category: 'Documentation', item: 'Environmental Review', description: 'Phase I environmental assessment', required: true, completed: false },
      { id: '504-6', category: 'Documentation', item: 'Appraisal Report', description: 'Independent MAI appraisal', required: true, completed: false },
      { id: '504-7', category: 'Documentation', item: 'CDC Authorization', description: 'CDC approval documentation', required: true, completed: false },
      { id: '504-8', category: 'Legal', item: 'Title Insurance', description: 'Title insurance commitment', required: true, completed: false },
      { id: '504-9', category: 'Legal', item: 'Survey', description: 'Current property survey', required: true, completed: false },
      { id: '504-10', category: 'Closing', item: 'Note and Deed of Trust', description: 'Executed loan documents', required: true, completed: false },
    ]
  },
  {
    type: 'conventional',
    name: 'Conventional Commercial',
    description: 'Standard commercial loan compliance',
    items: [
      { id: 'conv-1', category: 'Documentation', item: 'Loan Application', description: 'Completed commercial loan application', required: true, completed: false },
      { id: 'conv-2', category: 'Documentation', item: 'Business Plan', description: 'Current business plan or summary', required: false, completed: false },
      { id: 'conv-3', category: 'Financial', item: 'Business Tax Returns', description: '3 years of business tax returns', required: true, completed: false },
      { id: 'conv-4', category: 'Financial', item: 'Personal Tax Returns', description: 'Personal returns for guarantors', required: true, completed: false },
      { id: 'conv-5', category: 'Financial', item: 'Financial Statements', description: 'YTD financial statements', required: true, completed: false },
      { id: 'conv-6', category: 'Credit', item: 'Credit Analysis', description: 'Full credit underwriting', required: true, completed: false },
      { id: 'conv-7', category: 'Collateral', item: 'Collateral Valuation', description: 'Appraisal or valuation report', required: true, completed: false },
      { id: 'conv-8', category: 'Legal', item: 'Entity Documents', description: 'Formation and authorization docs', required: true, completed: false },
    ]
  }
];

export function ComplianceChecklist() {
  const [selectedLoanType, setSelectedLoanType] = useState('sba_7a');
  const [checklists, setChecklists] = useState(COMPLIANCE_CHECKLISTS);

  const currentChecklist = checklists.find(c => c.type === selectedLoanType);
  const items = currentChecklist?.items || [];

  const completedCount = items.filter(i => i.completed).length;
  const requiredCount = items.filter(i => i.required).length;
  const requiredCompleted = items.filter(i => i.required && i.completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const toggleItem = (itemId: string) => {
    setChecklists(prev => prev.map(checklist => ({
      ...checklist,
      items: checklist.items.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              completed: !item.completed,
              completedAt: !item.completed ? new Date().toISOString() : undefined,
              completedBy: !item.completed ? 'Current User' : undefined
            } 
          : item
      )
    })));
  };

  const exportChecklist = () => {
    const data = items.map(item => ({
      Category: item.category,
      Item: item.item,
      Description: item.description,
      Required: item.required ? 'Yes' : 'No',
      Status: item.completed ? 'Complete' : 'Pending',
      CompletedBy: item.completedBy || '',
      CompletedAt: item.completedAt || ''
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedLoanType}_compliance_checklist.csv`;
    a.click();
    toast.success('Checklist exported');
  };

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle>Compliance Checklist</CardTitle>
          </div>
          <div className="flex gap-2">
            <Select value={selectedLoanType} onValueChange={setSelectedLoanType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPLIANCE_CHECKLISTS.map(c => (
                  <SelectItem key={c.type} value={c.type}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={exportChecklist}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>{currentChecklist?.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Progress Section */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Progress</span>
            <span>{completedCount}/{items.length} items</span>
          </div>
          <Progress value={progress} className="h-2 mb-4" />
          <div className="flex gap-4">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              {requiredCompleted}/{requiredCount} Required
            </Badge>
            {requiredCompleted < requiredCount && (
              <Badge variant="outline" className="gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {requiredCount - requiredCompleted} Required Pending
              </Badge>
            )}
          </div>
        </div>

        {/* Checklist by Category */}
        <Tabs defaultValue={categories[0]} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat} className="text-xs">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map(cat => (
            <TabsContent key={cat} value={cat}>
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {items.filter(i => i.category === cat).map(item => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        item.completed ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' : 'bg-card hover:bg-muted/50'
                      }`}
                      onClick={() => toggleItem(item.id)}
                    >
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => toggleItem(item.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.item}
                          </span>
                          {item.required && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">
                              Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                        {item.completed && item.completedBy && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Completed by {item.completedBy}
                          </p>
                        )}
                      </div>
                      {item.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
