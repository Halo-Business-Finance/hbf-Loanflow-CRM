import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StandardPageLayout } from '@/components/StandardPageLayout';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Search, DollarSign, Calendar, TrendingUp, User } from "lucide-react";
import { useAuth } from '@/components/auth/AuthProvider';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';
import { useRoleBasedAccess } from '@/hooks/useRoleBasedAccess';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface LoanRecord {
  id: string;
  client_id: string;
  borrower_name: string;
  business_name: string | null;
  loan_type: string | null;
  loan_amount: number | null;
  interest_rate: number | null;
  stage: string | null;
  created_at: string;
  updated_at: string;
  maturity_date: string | null;
}

export default function LoanHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasRole } = useRoleBasedAccess();
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [loanTypeFilter, setLoanTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user) {
      fetchLoanHistory();
    }
  }, [user]);

  // Real-time subscriptions for live updates
  useRealtimeSubscription({
    table: 'clients',
    event: '*',
    onChange: () => {
      console.log('Clients changed, refreshing loan history...');
      fetchLoanHistory();
    }
  });

  useRealtimeSubscription({
    table: 'contact_entities',
    event: '*',
    onChange: () => {
      console.log('Contact entities changed, refreshing loan history...');
      fetchLoanHistory();
    }
  });

  const fetchLoanHistory = async () => {
    try {
      setLoading(true);
      
      // Managers and admins can see all clients, others see only their own
      const isManagerOrAdmin = hasRole('manager') || hasRole('admin') || hasRole('super_admin');
      
      // Try embedded join first
      let query = ibmDb
        .from('clients')
        .select(`
          id,
          user_id,
          contact_entity_id,
          contact_entity:contact_entities!clients_contact_entity_id_fkey(
            name,
            business_name,
            loan_type,
            loan_amount,
            interest_rate,
            stage,
            maturity_date
          ),
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });
      
      if (!isManagerOrAdmin) {
        query = query.eq('user_id', user?.id);
      }
      
      const respAny = await (query as any);
      let data = (respAny?.data as any[]) || null;
      let error = respAny?.error as any;
      
      // Fallback: If join fails, fetch separately
      if (error) {
        console.warn('[LoanHistory] Embedded join failed, using fallback:', error);
        
        let clientsQuery = ibmDb
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!isManagerOrAdmin) {
          clientsQuery = clientsQuery.eq('user_id', user?.id);
        }
        
        const { data: clients, error: clientsError } = await clientsQuery;
        
        if (clientsError) throw clientsError;
        
        // Fetch contact entities
        const contactIds = (clients || [])
          .map((c: any) => c.contact_entity_id)
          .filter(Boolean);
        
        let contactsData: any[] = [];
        if (contactIds.length > 0) {
          const { data: contacts, error: contactsError } = await ibmDb
            .from('contact_entities')
            .select('*')
            .in('id', contactIds as string[]);
          
          if (contactsError) {
            console.warn('[LoanHistory] Contact entities fetch failed:', contactsError);
          } else {
            contactsData = contacts || [];
          }
        }
        
        // Map contacts by id
        const contactsMap = new Map(contactsData.map((c: any) => [c.id, c]));
        
        // Combine data
        data = (clients || []).map((client: any) => ({
          ...client,
          contact_entity: contactsMap.get(client.contact_entity_id) || null
        }));
        
        error = null;
      }
      
      if (error) {
        console.error('Error fetching loan history:', error);
        throw error;
      }
      
      // Transform the data
      const transformedLoans: LoanRecord[] = (data || []).map((client: any) => {
        const contact = client.contact_entity || {};
        return {
          id: client.id,
          client_id: client.id,
          borrower_name: contact.name || 'Unknown',
          business_name: contact.business_name,
          loan_type: contact.loan_type,
          loan_amount: contact.loan_amount,
          interest_rate: contact.interest_rate,
          stage: contact.stage,
          created_at: client.created_at,
          updated_at: client.updated_at,
          maturity_date: contact.maturity_date
        };
      });
      
      setLoans(transformedLoans);
    } catch (error) {
      console.error('Error fetching loan history:', error);
      toast({
        title: "Error",
        description: "Failed to load loan history. Please try refreshing the page.",
        variant: "destructive"
      });
      setLoans([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      'Loan Funded': { variant: 'default', label: 'Funded' },
      'Closed Won': { variant: 'default', label: 'Closed Won' },
      'Closing': { variant: 'secondary', label: 'Closing' },
      'Loan Approved': { variant: 'secondary', label: 'Approved' },
      'Term Sheet Signed': { variant: 'secondary', label: 'Term Sheet' },
      'Pre-approval': { variant: 'outline', label: 'Pre-Approved' },
      'Closed Lost': { variant: 'destructive', label: 'Lost' },
      'Archive': { variant: 'outline', label: 'Archived' }
    };
    
    const statusInfo = statusMap[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = searchTerm === '' || 
      loan.borrower_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (loan.business_name && loan.business_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      loan.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = loanTypeFilter === 'all' || loan.loan_type === loanTypeFilter;
    const matchesStatus = statusFilter === 'all' || loan.stage === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  // Get unique loan types and stages for filters
  const loanTypes = Array.from(new Set(loans.map(l => l.loan_type).filter(Boolean)));
  const stages = Array.from(new Set(loans.map(l => l.stage).filter(Boolean)));

  return (
    <StandardPageLayout>
      <IBMPageHeader
        title="Loan History"
        subtitle="Complete history of all loans and their current status"
      />
      
      <div className="space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search & Filter
            </CardTitle>
            <CardDescription>
              Find specific loans using filters and search
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by borrower name, business name, or loan ID..."
                  className="w-full border-[#0A1628]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={loanTypeFilter} onValueChange={setLoanTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Loan Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {loanTypes.map(type => (
                    <SelectItem key={type} value={type!}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {stages.map(stage => (
                    <SelectItem key={stage} value={stage!}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={fetchLoanHistory} 
                variant="outline"
                disabled={loading || !user}
              >
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loan Records */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Records</CardTitle>
            <CardDescription>
              {filteredLoans.length} loan record{filteredLoans.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse border border-border rounded-lg p-4">
                    <div className="h-6 bg-muted rounded w-1/3 mb-3"></div>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="h-4 bg-muted rounded"></div>
                      <div className="h-4 bg-muted rounded"></div>
                      <div className="h-4 bg-muted rounded"></div>
                      <div className="h-4 bg-muted rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLoans.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No loan records found</p>
                <p className="text-muted-foreground">
                  {searchTerm || loanTypeFilter !== 'all' || statusFilter !== 'all' 
                    ? 'Try adjusting your filters or search terms'
                    : 'Loan records will appear here once clients are added'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLoans.map((loan) => (
                  <div 
                    key={loan.id} 
                    className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/existing-borrowers/${loan.client_id}`)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-lg">{loan.borrower_name}</div>
                        {loan.business_name && (
                          <div className="text-sm text-muted-foreground">{loan.business_name}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">ID: {loan.id.slice(0, 8)}</div>
                      </div>
                      {getStatusBadge(loan.stage)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground flex items-center gap-1 mb-1">
                          <FileText className="h-3 w-3" />
                          Loan Type
                        </div>
                        <div className="font-medium">{loan.loan_type || 'Not specified'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground flex items-center gap-1 mb-1">
                          <DollarSign className="h-3 w-3" />
                          Amount
                        </div>
                        <div className="font-medium">{formatCurrency(loan.loan_amount)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground flex items-center gap-1 mb-1">
                          <TrendingUp className="h-3 w-3" />
                          Interest Rate
                        </div>
                        <div className="font-medium">
                          {loan.interest_rate ? `${loan.interest_rate}%` : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground flex items-center gap-1 mb-1">
                          <Calendar className="h-3 w-3" />
                          Maturity Date
                        </div>
                        <div className="font-medium">{formatDate(loan.maturity_date)}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-3 pt-3 border-t">
                      <div className="text-sm text-muted-foreground">
                        Created: {formatDate(loan.created_at)}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/existing-borrowers/${loan.client_id}`);
                          }}
                        >
                          <User className="h-4 w-4 mr-1" />
                          View Client
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/documents/loan/${loan.client_id}`);
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Documents
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </StandardPageLayout>
  );
}
