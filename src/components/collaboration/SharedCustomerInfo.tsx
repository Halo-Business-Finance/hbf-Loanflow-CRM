import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MapPin,
  Phone,
  Mail,
  Building,
  Calendar,
  DollarSign,
  FileText,
  History,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Clock,
  Target,
  Edit,
  Share2,
  Eye
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

interface CustomerInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  business_name: string;
  business_address: string;
  industry?: string;
  stage: string;
  loan_amount: number;
  business_description?: string;
  ssn?: string;
  ein?: string;
  years_in_business?: number;
  annual_revenue?: number;
  credit_score?: number;
  existing_loans?: any[];
  interaction_history?: Interaction[];
  documents?: Document[];
}

interface Interaction {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'stage_change';
  description: string;
  user_name: string;
  department: string;
  timestamp: string;
  outcome: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  uploaded_by: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
  department: string;
}

interface SharedCustomerInfoProps {
  customerId: string;
  onClose?: () => void;
}

export function SharedCustomerInfo({ customerId, onClose }: SharedCustomerInfoProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sharedNotes, setSharedNotes] = useState<string[]>([]);
  const [sharedDocuments, setSharedDocuments] = useState<Document[]>([]);

  useEffect(() => {
    if (customerId) {
      fetchCustomerInfo();
    }
  }, [customerId]);

  const fetchCustomerInfo = async () => {
    try {
      // Fetch customer basic info
      const { data: contactData, error: contactError } = await supabase
        .from('contact_entities')
        .select('*')
        .eq('id', customerId)
        .single();

      if (contactError) throw contactError;

      // Fetch loan/client additional data
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('contact_entity_id', customerId);

      if (clientError) {
        console.error('Client data error:', clientError);
      }

      // Fetch interaction history from audit logs
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('record_id', customerId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!auditError && auditLogs) {
        const realInteractions: Interaction[] = auditLogs.map(log => ({
          id: log.id,
          type: log.action.includes('email') ? 'email' : 
                log.action.includes('call') ? 'call' : 
                log.action.includes('meeting') ? 'meeting' : 'stage_change',
          description: `${log.action}: ${JSON.stringify(log.new_values || {})}`,
          user_name: log.user_id || 'System',
          department: 'System',
          timestamp: log.created_at,
          outcome: 'Completed'
        }))
        setInteractions(realInteractions)
        setSharedNotes(realInteractions.map(i => i.description))
      } else {
        setInteractions([])
        setSharedNotes([])
      }

      // Fetch real documents from lead_documents table
      const { data: documentsData, error: docError } = await supabase
        .from('lead_documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (!docError && documentsData) {
        const realDocuments: Document[] = documentsData.map(doc => ({
          id: doc.id,
          name: doc.document_name,
          type: doc.document_type || 'Other',
          uploaded_by: doc.user_id || 'Unknown',
          uploaded_at: doc.created_at,
          status: 'approved',
          department: 'Processing'
        }))
        setDocuments(realDocuments)
        setSharedDocuments(realDocuments)
      } else {
        setDocuments([])
        setSharedDocuments([])
      }

      const transformedCustomer: CustomerInfo = {
        ...contactData,
        existing_loans: [],
        interaction_history: interactions,
        documents: documents
      };

      setCustomer(transformedCustomer);
    } catch (error) {
      console.error('Error fetching customer info:', error);
      toast({
        title: "Error",
        description: "Failed to load customer information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Customer Not Found</h3>
          <p className="text-muted-foreground">
            The customer information could not be loaded.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1 flex-1">
          <CardTitle className="text-2xl font-bold">
            {customer.first_name} {customer.last_name}
          </CardTitle>
          <CardDescription className="text-base">
            {customer.business_name} • {customer.industry}
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={
            customer.stage === 'Funded' ? 'default' :
            customer.stage === 'Closing' ? 'secondary' :
            customer.stage === 'Underwriting' ? 'outline' : 'destructive'
          }>
            {customer.stage}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
            <Edit className="h-4 w-4 mr-2" />
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              <Share2 className="h-4 w-4 mr-2" />
              Close
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.phone || 'No phone provided'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{customer.email}</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Building className="h-4 w-4 text-muted-foreground mt-1" />
                    <span>{customer.business_address || 'No address provided'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Business Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building className="h-5 w-5 mr-2" />
                    Business Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="font-medium">Industry:</span>
                    <span className="ml-2">{customer.industry}</span>
                  </div>
                  <div>
                    <span className="font-medium">Years in Business:</span>
                    <span className="ml-2">{customer.years_in_business || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="font-medium">Annual Revenue:</span>
                    <span className="ml-2">
                      {customer.annual_revenue ? formatCurrency(customer.annual_revenue) : 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Description:</span>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {customer.business_description || 'No description provided'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Loan Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Current Loan Application
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="font-medium">Requested Amount:</span>
                    <span className="ml-2 text-lg font-bold text-green-600">
                      {formatCurrency(customer.loan_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Credit Score:</span>
                    <span className="ml-2">{customer.credit_score || 'Not available'}</span>
                  </div>
                  <div>
                    <span className="font-medium">Stage:</span>
                    <Badge className="ml-2" variant={
                      customer.stage === 'Funded' ? 'default' :
                      customer.stage === 'Closing' ? 'secondary' : 'outline'
                    }>
                      {customer.stage}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Existing Loans */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Existing Loans
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customer.existing_loans && customer.existing_loans.length > 0 ? (
                    <div className="space-y-2">
                      {customer.existing_loans.map((loan: any, index: number) => (
                        <div key={index} className="p-3 border rounded">
                          <div className="font-medium">{formatCurrency(loan.amount)}</div>
                          <div className="text-sm text-muted-foreground">{loan.type}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No existing loans</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Documents ({sharedDocuments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sharedDocuments.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {sharedDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex-1">
                            <div className="font-medium">{doc.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {doc.type} • Uploaded by {doc.uploaded_by} • {formatDistanceToNow(new Date(doc.uploaded_at))} ago
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={
                              doc.status === 'approved' ? 'default' :
                              doc.status === 'pending' ? 'secondary' : 'destructive'
                            }>
                              {doc.status}
                            </Badge>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground">No documents available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Interaction History ({interactions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {interactions.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {interactions.map((interaction) => (
                        <div key={interaction.id} className="flex space-x-3 p-3 border rounded">
                          <div className="flex-shrink-0">
                            {interaction.type === 'email' && <Mail className="h-5 w-5 text-blue-500" />}
                            {interaction.type === 'call' && <Phone className="h-5 w-5 text-green-500" />}
                            {interaction.type === 'meeting' && <Calendar className="h-5 w-5 text-purple-500" />}
                            {interaction.type === 'stage_change' && <Target className="h-5 w-5 text-orange-500" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{interaction.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {interaction.user_name} • {interaction.department} • {formatDistanceToNow(new Date(interaction.timestamp))} ago
                            </div>
                            {interaction.outcome && (
                              <div className="text-sm mt-1">
                                <Badge variant="outline">{interaction.outcome}</Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground">No interaction history available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
