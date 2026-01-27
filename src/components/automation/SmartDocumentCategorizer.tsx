import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Brain, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FolderOpen,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  color: string;
}

interface CategorizedDocument {
  id: string;
  name: string;
  originalCategory?: string;
  suggestedCategory: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
}

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'financial_statements',
    name: 'Financial Statements',
    description: 'P&L, Balance Sheets, Cash Flow',
    keywords: ['profit', 'loss', 'balance', 'income', 'revenue', 'expense', 'cash flow'],
    color: 'bg-blue-500'
  },
  {
    id: 'tax_returns',
    name: 'Tax Returns',
    description: 'Personal & Business Tax Documents',
    keywords: ['1040', '1120', 'schedule', 'tax', 'irs', 'return'],
    color: 'bg-green-500'
  },
  {
    id: 'bank_statements',
    name: 'Bank Statements',
    description: 'Checking, Savings, Business Accounts',
    keywords: ['bank', 'statement', 'account', 'deposit', 'withdrawal', 'checking'],
    color: 'bg-purple-500'
  },
  {
    id: 'legal_documents',
    name: 'Legal Documents',
    description: 'Articles, Operating Agreements, Licenses',
    keywords: ['articles', 'incorporation', 'agreement', 'license', 'certificate', 'legal'],
    color: 'bg-orange-500'
  },
  {
    id: 'collateral',
    name: 'Collateral Documents',
    description: 'Appraisals, Titles, Insurance',
    keywords: ['appraisal', 'title', 'deed', 'insurance', 'property', 'collateral'],
    color: 'bg-red-500'
  },
  {
    id: 'personal_identification',
    name: 'Personal ID',
    description: 'Drivers License, Passport, SSN',
    keywords: ['license', 'passport', 'id', 'identification', 'ssn', 'social security'],
    color: 'bg-yellow-500'
  },
  {
    id: 'loan_application',
    name: 'Loan Application',
    description: 'SBA Forms, Applications',
    keywords: ['sba', 'form', 'application', '1919', '1920', '912', 'borrower'],
    color: 'bg-indigo-500'
  },
  {
    id: 'other',
    name: 'Other Documents',
    description: 'Miscellaneous documents',
    keywords: [],
    color: 'bg-gray-500'
  }
];

// Simulated document categorization - in production, this would use AI/ML
const categorizeDocument = (fileName: string): { category: string; confidence: number } => {
  const lowerName = fileName.toLowerCase();
  
  for (const category of DOCUMENT_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (lowerName.includes(keyword)) {
        const confidence = 0.75 + Math.random() * 0.2; // 75-95% confidence
        return { category: category.id, confidence };
      }
    }
  }
  
  return { category: 'other', confidence: 0.5 };
};

export function SmartDocumentCategorizer() {
  const [documents, setDocuments] = useState<CategorizedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Simulated uncategorized documents
  const sampleDocuments = [
    'John_Smith_2023_Tax_Return.pdf',
    'Business_Bank_Statement_Oct2024.pdf',
    'Property_Appraisal_Report.pdf',
    'SBA_Form_1919_Completed.pdf',
    'Drivers_License_Front.jpg',
    'Q3_Profit_Loss_Statement.xlsx',
    'Articles_of_Incorporation.pdf',
    'Insurance_Certificate.pdf'
  ];

  const runAutoCategorization = async () => {
    setIsProcessing(true);
    setProgress(0);
    setDocuments([]);

    for (let i = 0; i < sampleDocuments.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const doc = sampleDocuments[i];
      const { category, confidence } = categorizeDocument(doc);
      
      setDocuments(prev => [...prev, {
        id: `doc-${i}`,
        name: doc,
        suggestedCategory: category,
        confidence,
        status: 'pending'
      }]);
      
      setProgress(((i + 1) / sampleDocuments.length) * 100);
    }

    setIsProcessing(false);
    toast({
      title: "Categorization Complete",
      description: `${sampleDocuments.length} documents analyzed and categorized`,
    });
  };

  const approveDocument = (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, status: 'approved' } : doc
    ));
  };

  const rejectDocument = (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, status: 'rejected' } : doc
    ));
  };

  const approveAll = () => {
    setDocuments(prev => prev.map(doc => ({ ...doc, status: 'approved' })));
    toast({
      title: "All Approved",
      description: "All document categorizations have been approved",
    });
  };

  const getCategoryInfo = (categoryId: string) => {
    return DOCUMENT_CATEGORIES.find(c => c.id === categoryId) || DOCUMENT_CATEGORIES[DOCUMENT_CATEGORIES.length - 1];
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const pendingCount = documents.filter(d => d.status === 'pending').length;
  const approvedCount = documents.filter(d => d.status === 'approved').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Smart Document Categorizer
            </CardTitle>
            <CardDescription>
              AI-powered automatic document classification
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {documents.length > 0 && pendingCount > 0 && (
              <Button variant="outline" size="sm" onClick={approveAll}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve All
              </Button>
            )}
            <Button 
              onClick={runAutoCategorization} 
              disabled={isProcessing}
              size="sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Auto-Categorize
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isProcessing && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Analyzing documents...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {documents.length === 0 && !isProcessing ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Click "Auto-Categorize" to analyze and categorize uncategorized documents</p>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-4">
              <Badge variant="outline" className="px-3 py-1">
                <FileText className="h-3 w-3 mr-1" />
                {documents.length} Total
              </Badge>
              <Badge variant="outline" className="px-3 py-1 text-yellow-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                {pendingCount} Pending
              </Badge>
              <Badge variant="outline" className="px-3 py-1 text-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {approvedCount} Approved
              </Badge>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {documents.map((doc) => {
                  const category = getCategoryInfo(doc.suggestedCategory);
                  return (
                    <div 
                      key={doc.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        doc.status === 'approved' ? 'bg-green-50 dark:bg-green-900/10 border-green-200' :
                        doc.status === 'rejected' ? 'bg-red-50 dark:bg-red-900/10 border-red-200' :
                        'bg-muted/30 border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doc.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <Badge 
                                variant="secondary" 
                                className={`${category.color} text-white text-xs`}
                              >
                                {category.name}
                              </Badge>
                              <span className={`text-xs ${getConfidenceColor(doc.confidence)}`}>
                                {Math.round(doc.confidence * 100)}% confident
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {doc.status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                              onClick={() => approveDocument(doc.id)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                              onClick={() => rejectDocument(doc.id)}
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant={doc.status === 'approved' ? 'default' : 'destructive'}>
                            {doc.status === 'approved' ? 'Approved' : 'Rejected'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
