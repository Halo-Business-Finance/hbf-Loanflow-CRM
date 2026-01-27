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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Star,
  Phone,
  Mail,
  Calendar,
  FileText,
  Share2,
  Target,
  Handshake,
  BarChart3
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface BankPartner {
  id: string;
  name: string;
  type: 'national' | 'regional' | 'credit_union' | 'sba_preferred';
  rating: number;
  total_funded: number;
  avg_approval_time: number;
  success_rate: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  specializations: string[];
  min_loan_amount: number;
  max_loan_amount: number;
  last_activity: string;
  status: 'active' | 'inactive' | 'pending';
}

interface LoanRequiringFunding {
  id: string;
  clientName: string;
  businessName: string;
  loanAmount: number;
  loanType: string;
  creditScore: number;
  timeInBusiness: number;
  annualRevenue: number;
  stage: string;
  urgency: 'low' | 'medium' | 'high';
  submittedAt: string;
  matchedPartners: string[];
  priority: number;
}

interface FundingRequest {
  id: string;
  partner_name: string;
  client_name: string;
  loan_amount: number;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'funded';
  response_time: number;
  notes: string;
}

interface PartnerActivity {
  id: string;
  partner_name: string;
  activity_type: 'funding_request' | 'approval' | 'rejection' | 'communication';
  description: string;
  timestamp: string;
  loan_amount?: number;
  client_name?: string;
}

export function BankPartnerCollaboration() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Real bank partner data - would be from a bank_partners table
  const [bankPartners, setBankPartners] = useState<BankPartner[]>([])
  const [loansRequiringFunding, setLoansRequiringFunding] = useState<LoanRequiringFunding[]>([])
  const [fundingRequests, setFundingRequests] = useState<FundingRequest[]>([])
  const [partnerActivity, setPartnerActivity] = useState<PartnerActivity[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    // For now, show empty state until bank partners table is created
    setBankPartners([])
    setLoading(false)
  }, [])

  useEffect(() => {
    // Fetch loans requiring funding
    const loansData: LoanRequiringFunding[] = [];
    const fundingRequestsData: FundingRequest[] = [];
    const partnerActivityData: PartnerActivity[] = [];

    setLoansRequiringFunding(loansData);
    setFundingRequests(fundingRequestsData);
    setPartnerActivity(partnerActivityData);
    setLoading(false);
  }, []);

  const getPartnerTypeColor = (type: BankPartner['type']) => {
    switch (type) {
      case 'national': return 'default';
      case 'regional': return 'secondary';
      case 'credit_union': return 'outline';
      case 'sba_preferred': return 'destructive';
      default: return 'outline';
    }
  };

  const getUrgencyColor = (urgency: LoanRequiringFunding['urgency']) => {
    switch (urgency) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: FundingRequest['status']) => {
    switch (status) {
      case 'approved': return 'default';
      case 'funded': return 'secondary';
      case 'pending': return 'outline';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const sendFundingRequest = async (partnerId: string, loanId: string) => {
    try {
      // This would send a funding request to the partner
      toast({
        title: "Funding Request Sent",
        description: "Your funding request has been sent to the partner bank.",
      });
    } catch (error) {
      console.error('Error sending funding request:', error);
      toast({
        title: "Error",
        description: "Failed to send funding request.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bank Partner Collaboration</h2>
          <p className="text-muted-foreground">
            Manage relationships and coordinate funding with bank partners
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            Partner Reports
          </Button>
          <Button>
            <Handshake className="h-4 w-4 mr-2" />
            Add Partner
          </Button>
        </div>
      </div>

      <Tabs defaultValue="partners" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="partners">Partners ({bankPartners.length})</TabsTrigger>
          <TabsTrigger value="funding">Funding Queue ({loansRequiringFunding.length})</TabsTrigger>
          <TabsTrigger value="requests">Requests ({fundingRequests.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({partnerActivity.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="partners" className="space-y-6">
          {bankPartners.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {bankPartners.map((partner) => (
                <Card key={partner.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{partner.name}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getPartnerTypeColor(partner.type)}>
                            {partner.type.replace('_', ' ')}
                          </Badge>
                          <div className="flex items-center">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="ml-1 text-sm">{partner.rating}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={partner.status === 'active' ? 'default' : 'secondary'}>
                        {partner.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Partner Metrics */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Total Funded</div>
                        <div className="font-semibold">{formatCurrency(partner.total_funded)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Success Rate</div>
                        <div className="font-semibold">{partner.success_rate}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Approval</div>
                        <div className="font-semibold">{partner.avg_approval_time} days</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Loan Range</div>
                        <div className="font-semibold">
                          {formatCurrency(partner.min_loan_amount)} - {formatCurrency(partner.max_loan_amount)}
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-2 text-sm">
                      <div className="font-medium">Contact: {partner.contact_name}</div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{partner.contact_phone}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span>{partner.contact_email}</span>
                      </div>
                    </div>

                    {/* Specializations */}
                    <div>
                      <div className="text-sm font-medium mb-2">Specializations</div>
                      <div className="flex flex-wrap gap-1">
                        {partner.specializations.map((spec, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Phone className="h-3 w-3 mr-1" />
                        Call
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Mail className="h-3 w-3 mr-1" />
                        Email
                      </Button>
                      <Button size="sm" className="flex-1">
                        <Share2 className="h-3 w-3 mr-1" />
                        Send Deal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Bank Partners</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't added any bank partners yet. Start building your network.
                </p>
                <Button>
                  <Handshake className="h-4 w-4 mr-2" />
                  Add First Partner
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="funding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Loans Requiring Funding
              </CardTitle>
              <CardDescription>
                Loans ready to be sent to bank partners for funding
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loansRequiringFunding.length > 0 ? (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {loansRequiringFunding.map((loan) => (
                      <Card key={loan.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center space-x-2">
                                <h3 className="font-semibold">{loan.clientName}</h3>
                                <Badge variant={getUrgencyColor(loan.urgency)}>
                                  {loan.urgency} priority
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {loan.businessName} • {loan.loanType}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <div className="text-muted-foreground">Loan Amount</div>
                                  <div className="font-semibold">{formatCurrency(loan.loanAmount)}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Credit Score</div>
                                  <div className="font-semibold">{loan.creditScore}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Time in Business</div>
                                  <div className="font-semibold">{loan.timeInBusiness} years</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Annual Revenue</div>
                                  <div className="font-semibold">{formatCurrency(loan.annualRevenue)}</div>
                                </div>
                              </div>
                              {loan.matchedPartners.length > 0 && (
                                <div>
                                  <div className="text-sm font-medium mb-1">Matched Partners</div>
                                  <div className="flex flex-wrap gap-1">
                                    {loan.matchedPartners.map((partner, index) => (
                                      <Badge key={index} variant="outline" className="text-xs">
                                        {partner}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col space-y-2 ml-4">
                              <Button size="sm">
                                <Share2 className="h-3 w-3 mr-1" />
                                Send to Partners
                              </Button>
                              <Button variant="outline" size="sm">
                                <FileText className="h-3 w-3 mr-1" />
                                View Details
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Loans Requiring Funding</h3>
                  <p className="text-muted-foreground">
                    All loans are either funded or not yet ready for funding.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Funding Requests
              </CardTitle>
              <CardDescription>
                Track funding requests sent to bank partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fundingRequests.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {fundingRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <div className="font-medium">{request.client_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {request.partner_name} • {formatCurrency(request.loan_amount)} • 
                            Requested {formatDistanceToNow(new Date(request.requested_at))} ago
                          </div>
                          {request.notes && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {request.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {request.response_time}h
                          </div>
                          <Button variant="outline" size="sm">
                            Follow Up
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Funding Requests</h3>
                  <p className="text-muted-foreground">
                    No funding requests have been sent yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Partner Activity Feed
              </CardTitle>
              <CardDescription>
                Recent activity from bank partners and funding requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {partnerActivity.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {partnerActivity.map((activity) => (
                      <div key={activity.id} className="flex space-x-3 p-3 border rounded">
                        <div className="flex-shrink-0 mt-1">
                          {activity.activity_type === 'funding_request' && <Share2 className="h-4 w-4 text-blue-500" />}
                          {activity.activity_type === 'approval' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {activity.activity_type === 'rejection' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          {activity.activity_type === 'communication' && <Mail className="h-4 w-4 text-gray-500" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm">
                            <span className="font-medium">{activity.partner_name}</span>
                            <span className="ml-2">{activity.description}</span>
                          </div>
                          {activity.client_name && (
                            <div className="text-xs text-muted-foreground">
                              Client: {activity.client_name}
                              {activity.loan_amount && ` • ${formatCurrency(activity.loan_amount)}`}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(activity.timestamp))} ago
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {activity.activity_type.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Recent Activity</h3>
                  <p className="text-muted-foreground">
                    Partner activity will appear here once you start collaborating.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}