import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Users, Building2, Send, Plus, Eye, DollarSign, TrendingUp, FileText } from "lucide-react";

interface PartnerOrganization {
  id: string;
  name: string;
  partner_type: string;
  contact_email: string;
  commission_rate: number;
  status: string;
}

interface PartnerSubmission {
  id: string;
  organization_id: string;
  borrower_name: string;
  borrower_email: string;
  loan_amount: number;
  loan_type: string;
  status: string;
  created_at: string;
}

export default function PartnerPortal() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<PartnerOrganization[]>([]);
  const [submissions, setSubmissions] = useState<PartnerSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: "",
    partner_type: "broker",
    contact_email: "",
    commission_rate: 1,
  });
  const [newSubmission, setNewSubmission] = useState({
    organization_id: "",
    borrower_name: "",
    borrower_email: "",
    borrower_phone: "",
    loan_amount: 0,
    loan_type: "SBA 7(a)",
    business_name: "",
    notes: "",
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    const [orgsRes, subsRes] = await Promise.all([
      supabase.from("partner_organizations").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_submissions").select("*").order("created_at", { ascending: false }),
    ]);

    if (orgsRes.data) setOrganizations(orgsRes.data);
    if (subsRes.data) setSubmissions(subsRes.data);
    setIsLoading(false);
  };

  const createOrganization = async () => {
    const { error } = await supabase.from("partner_organizations").insert([newOrg]);
    if (error) {
      toast.error("Failed to create partner organization");
    } else {
      toast.success("Partner organization created");
      setOrgDialogOpen(false);
      fetchData();
    }
  };

  const createSubmission = async () => {
    if (!user) return;
    const { error } = await supabase.from("partner_submissions").insert([{
      ...newSubmission,
      submitted_by: user.id,
    }]);
    if (error) {
      toast.error("Failed to submit deal");
    } else {
      toast.success("Deal submitted successfully");
      setSubmissionDialogOpen(false);
      fetchData();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-500/20 text-green-400";
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "rejected": return "bg-red-500/20 text-red-400";
      case "converted": return "bg-blue-500/20 text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const stats = {
    totalPartners: organizations.length,
    activePartners: organizations.filter(o => o.status === "active").length,
    totalSubmissions: submissions.length,
    pendingSubmissions: submissions.filter(s => s.status === "pending").length,
    totalVolume: submissions.reduce((a, b) => a + (b.loan_amount || 0), 0),
  };

  if (isLoading) {
    return (
      <StandardPageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </StandardPageLayout>
    );
  }

  return (
    <StandardPageLayout>
      <IBMPageHeader
        title="Partner Portal"
        subtitle="Manage broker and referral partner relationships"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Building2 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Partners</p>
                <p className="text-2xl font-bold">{stats.totalPartners}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Users className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Partners</p>
                <p className="text-2xl font-bold">{stats.activePartners}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <FileText className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Deals</p>
                <p className="text-2xl font-bold">{stats.pendingSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-yellow-500/20">
                <DollarSign className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Volume</p>
                <p className="text-2xl font-bold">${(stats.totalVolume / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="partners" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partners">Partner Organizations</TabsTrigger>
          <TabsTrigger value="submissions">Deal Submissions</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Partner Organizations</CardTitle>
              <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Add Partner</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Partner Organization</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Organization Name</Label>
                      <Input
                        value={newOrg.name}
                        onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                        placeholder="e.g., ABC Mortgage Brokers"
                      />
                    </div>
                    <div>
                      <Label>Partner Type</Label>
                      <Select
                        value={newOrg.partner_type}
                        onValueChange={(v) => setNewOrg({ ...newOrg, partner_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="broker">Broker</SelectItem>
                          <SelectItem value="referral">Referral Partner</SelectItem>
                          <SelectItem value="affiliate">Affiliate</SelectItem>
                          <SelectItem value="bank">Bank Partner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Contact Email</Label>
                      <Input
                        type="email"
                        value={newOrg.contact_email}
                        onChange={(e) => setNewOrg({ ...newOrg, contact_email: e.target.value })}
                        placeholder="contact@partner.com"
                      />
                    </div>
                    <div>
                      <Label>Commission Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={newOrg.commission_rate}
                        onChange={(e) => setNewOrg({ ...newOrg, commission_rate: parseFloat(e.target.value) })}
                      />
                    </div>
                    <Button onClick={createOrganization} className="w-full">Add Partner</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {organizations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No partner organizations yet</p>
              ) : (
                <div className="space-y-4">
                  {organizations.map((org) => (
                    <div key={org.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/20">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {org.partner_type} • {org.contact_email} • {org.commission_rate}% commission
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(org.status)}>{org.status}</Badge>
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Deal Submissions</CardTitle>
              <Dialog open={submissionDialogOpen} onOpenChange={setSubmissionDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Send className="h-4 w-4 mr-2" />Submit Deal</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Submit New Deal</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label>Partner Organization</Label>
                      <Select
                        value={newSubmission.organization_id}
                        onValueChange={(v) => setNewSubmission({ ...newSubmission, organization_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select partner" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Borrower Name</Label>
                        <Input
                          value={newSubmission.borrower_name}
                          onChange={(e) => setNewSubmission({ ...newSubmission, borrower_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Business Name</Label>
                        <Input
                          value={newSubmission.business_name}
                          onChange={(e) => setNewSubmission({ ...newSubmission, business_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={newSubmission.borrower_email}
                          onChange={(e) => setNewSubmission({ ...newSubmission, borrower_email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={newSubmission.borrower_phone}
                          onChange={(e) => setNewSubmission({ ...newSubmission, borrower_phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Loan Amount</Label>
                        <Input
                          type="number"
                          value={newSubmission.loan_amount}
                          onChange={(e) => setNewSubmission({ ...newSubmission, loan_amount: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Loan Type</Label>
                        <Select
                          value={newSubmission.loan_type}
                          onValueChange={(v) => setNewSubmission({ ...newSubmission, loan_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SBA 7(a)">SBA 7(a)</SelectItem>
                            <SelectItem value="SBA 504">SBA 504</SelectItem>
                            <SelectItem value="Commercial RE">Commercial RE</SelectItem>
                            <SelectItem value="Equipment">Equipment</SelectItem>
                            <SelectItem value="Line of Credit">Line of Credit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={newSubmission.notes}
                        onChange={(e) => setNewSubmission({ ...newSubmission, notes: e.target.value })}
                        placeholder="Additional deal information..."
                      />
                    </div>
                    <Button onClick={createSubmission} className="w-full">Submit Deal</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No deal submissions yet</p>
              ) : (
                <div className="space-y-4">
                  {submissions.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{sub.borrower_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {sub.loan_type} • ${sub.loan_amount?.toLocaleString()} • {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={getStatusColor(sub.status)}>{sub.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <CardTitle>Commission Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Commission tracking will be available once deals are converted.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </StandardPageLayout>
  );
}
