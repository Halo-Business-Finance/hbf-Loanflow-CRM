import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileText,
  Mail,
  RefreshCw,
  Calendar,
  XCircle
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { toast } from 'sonner';

interface TrackedDocument {
  id: string;
  name: string;
  type: 'credit_report' | 'pay_stub' | 'bank_statement' | 'tax_return' | 'appraisal' | 'insurance' | 'title' | 'other';
  receivedDate: Date;
  expirationDate: Date;
  status: 'valid' | 'expiring_soon' | 'expired';
  borrowerName: string;
  loanId: string;
}

const documentExpirationRules: Record<string, number> = {
  credit_report: 120, // 4 months
  pay_stub: 30, // 1 month
  bank_statement: 60, // 2 months
  tax_return: 365, // 1 year
  appraisal: 180, // 6 months
  insurance: 365, // 1 year
  title: 90, // 3 months
  other: 90
};

const mockDocuments: TrackedDocument[] = [
  {
    id: '1',
    name: 'Credit Report - TransUnion',
    type: 'credit_report',
    receivedDate: addDays(new Date(), -100),
    expirationDate: addDays(new Date(), 20),
    status: 'expiring_soon',
    borrowerName: 'John Smith',
    loanId: 'LN-2024-001'
  },
  {
    id: '2',
    name: 'Pay Stub - November 2024',
    type: 'pay_stub',
    receivedDate: addDays(new Date(), -35),
    expirationDate: addDays(new Date(), -5),
    status: 'expired',
    borrowerName: 'Jane Doe',
    loanId: 'LN-2024-002'
  },
  {
    id: '3',
    name: 'Bank Statement - Chase',
    type: 'bank_statement',
    receivedDate: addDays(new Date(), -20),
    expirationDate: addDays(new Date(), 40),
    status: 'valid',
    borrowerName: 'Mike Johnson',
    loanId: 'LN-2024-003'
  },
  {
    id: '4',
    name: '2023 Tax Return',
    type: 'tax_return',
    receivedDate: addDays(new Date(), -200),
    expirationDate: addDays(new Date(), 165),
    status: 'valid',
    borrowerName: 'Sarah Williams',
    loanId: 'LN-2024-004'
  },
  {
    id: '5',
    name: 'Property Appraisal',
    type: 'appraisal',
    receivedDate: addDays(new Date(), -170),
    expirationDate: addDays(new Date(), 10),
    status: 'expiring_soon',
    borrowerName: 'John Smith',
    loanId: 'LN-2024-001'
  }
];

export function DocumentExpirationTracker() {
  const [documents, setDocuments] = useState<TrackedDocument[]>(mockDocuments);
  const [filter, setFilter] = useState<'all' | 'expired' | 'expiring_soon' | 'valid'>('all');

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      credit_report: 'Credit Report',
      pay_stub: 'Pay Stub',
      bank_statement: 'Bank Statement',
      tax_return: 'Tax Return',
      appraisal: 'Appraisal',
      insurance: 'Insurance',
      title: 'Title',
      other: 'Other'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return <Badge variant="default" className="bg-green-500">Valid</Badge>;
      case 'expiring_soon':
        return <Badge variant="secondary" className="bg-yellow-500 text-black">Expiring Soon</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'expiring_soon':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'expired':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getDaysUntilExpiration = (expirationDate: Date) => {
    return differenceInDays(expirationDate, new Date());
  };

  const filteredDocuments = documents.filter(doc => {
    if (filter === 'all') return true;
    return doc.status === filter;
  });

  const expiredCount = documents.filter(d => d.status === 'expired').length;
  const expiringSoonCount = documents.filter(d => d.status === 'expiring_soon').length;
  const validCount = documents.filter(d => d.status === 'valid').length;

  const sendRenewalReminder = (doc: TrackedDocument) => {
    toast.success(`Renewal reminder sent for ${doc.name}`, {
      description: `Email sent to ${doc.borrowerName} for loan ${doc.loanId}`
    });
  };

  const markAsRenewed = (docId: string) => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        const newExpirationDate = addDays(new Date(), documentExpirationRules[doc.type]);
        return {
          ...doc,
          receivedDate: new Date(),
          expirationDate: newExpirationDate,
          status: 'valid' as const
        };
      }
      return doc;
    }));
    toast.success('Document marked as renewed');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Document Expiration Tracker
            </CardTitle>
            <CardDescription>
              Monitor document validity and send renewal reminders
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card 
            className={`cursor-pointer transition-colors ${filter === 'expired' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setFilter(filter === 'expired' ? 'all' : 'expired')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-500">{expiredCount}</div>
                  <div className="text-xs text-muted-foreground">Expired</div>
                </div>
                <XCircle className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${filter === 'expiring_soon' ? 'ring-2 ring-yellow-500' : ''}`}
            onClick={() => setFilter(filter === 'expiring_soon' ? 'all' : 'expiring_soon')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-yellow-500">{expiringSoonCount}</div>
                  <div className="text-xs text-muted-foreground">Expiring Soon</div>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${filter === 'valid' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setFilter(filter === 'valid' ? 'all' : 'valid')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-500">{validCount}</div>
                  <div className="text-xs text-muted-foreground">Valid</div>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Document List */}
        <div className="space-y-3">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No documents match the selected filter</p>
            </div>
          ) : (
            filteredDocuments.map(doc => {
              const daysRemaining = getDaysUntilExpiration(doc.expirationDate);
              
              return (
                <div 
                  key={doc.id} 
                  className={`p-4 border rounded-lg ${
                    doc.status === 'expired' ? 'border-red-500/50 bg-red-500/5' :
                    doc.status === 'expiring_soon' ? 'border-yellow-500/50 bg-yellow-500/5' :
                    'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(doc.status)}
                      <div>
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {doc.borrowerName} • {doc.loanId}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Type: {getDocumentTypeLabel(doc.type)}</span>
                          <span>Received: {format(doc.receivedDate, 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(doc.status)}
                      <div className={`text-sm mt-2 ${
                        daysRemaining < 0 ? 'text-red-500' :
                        daysRemaining <= 30 ? 'text-yellow-500' :
                        'text-muted-foreground'
                      }`}>
                        {daysRemaining < 0 
                          ? `Expired ${Math.abs(daysRemaining)} days ago`
                          : `${daysRemaining} days remaining`
                        }
                      </div>
                    </div>
                  </div>
                  
                  {(doc.status === 'expired' || doc.status === 'expiring_soon') && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => sendRenewalReminder(doc)}
                      >
                        <Mail className="mr-2 h-3 w-3" />
                        Send Reminder
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => markAsRenewed(doc.id)}
                      >
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Mark Renewed
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
