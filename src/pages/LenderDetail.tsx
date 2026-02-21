import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  Building2, 
  Plus, 
  Phone, 
  Mail, 
  MapPin,
  Globe,
  Pencil,
  Trash2,
  User,
  Briefcase,
  Star,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { ibmDb } from '@/lib/ibm';
import { useToast } from '@/hooks/use-toast';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { formatPhoneNumber } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RelatedLeadsTable } from '@/components/RelatedLeadsTable';

interface Lender {
  id: string;
  name: string;
  lender_type: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  is_active: boolean;
}

interface LenderContact {
  id: string;
  lender_id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  is_primary: boolean;
  is_bdo: boolean;
  is_closer: boolean;
  is_vice_president: boolean;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

interface LenderPerformance {
  total_leads: number;
  total_funded: number;
  average_days_to_funding: number;
  by_stage: {
    [key: string]: number;
  };
}

export default function LenderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [lender, setLender] = useState<Lender | null>(null);
  const [contacts, setContacts] = useState<LenderContact[]>([]);
  const [performance, setPerformance] = useState<LenderPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<LenderContact | null>(null);
  const [contactFormData, setContactFormData] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    mobile_phone: '',
    is_primary: false,
    is_bdo: false,
    is_closer: false,
    is_vice_president: false,
    notes: '',
    is_active: true,
  });

  useEffect(() => {
    if (id && user) {
      fetchLenderDetails();
    }
  }, [id, user]);

  const fetchLenderDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch lender details
      const { data: lenderData, error: lenderError } = await ibmDb
        .from('lenders')
        .select('*')
        .eq('id', id)
        .single();

      if (lenderError) throw lenderError;
      setLender(lenderData as unknown as Lender);

      // Fetch lender contacts
      const { data: contactsData, error: contactsError } = await ibmDb
        .from('lender_contacts')
        .select('*')
        .eq('lender_id', id)
        .order('is_primary', { ascending: false })
        .order('is_bdo', { ascending: false })
        .order('name');

      if (contactsError) throw contactsError;
      setContacts((contactsData || []) as unknown as LenderContact[]);

      // Fetch lender performance metrics
      const { data: performanceData, error: performanceError } = await ibmDb
        .from('contact_entities')
        .select('stage, id, loan_amount, created_at, updated_at')
        .eq('lender_id', id);

      if (performanceError) throw performanceError;

      // Calculate performance metrics
      const stageCount: { [key: string]: number } = {};
      let totalFunded = 0;
      let fundedLoans = 0;
      let totalDaysToFunding = 0;
      
      (performanceData as any[])?.forEach((contact: any) => {
        const stage = contact.stage || 'No Stage';
        stageCount[stage] = (stageCount[stage] || 0) + 1;
        
        if (contact.loan_amount) {
          totalFunded += Number(contact.loan_amount);
        }

        if (stage.toLowerCase().includes('funded') || stage.toLowerCase().includes('closed')) {
          fundedLoans++;
          const createdDate = new Date(contact.created_at);
          const updatedDate = new Date(contact.updated_at);
          const daysToFunding = Math.floor((updatedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          totalDaysToFunding += daysToFunding;
        }
      });

      const averageDaysToFunding = fundedLoans > 0 ? Math.round(totalDaysToFunding / fundedLoans) : 0;

      setPerformance({
        total_leads: performanceData?.length || 0,
        total_funded: totalFunded,
        average_days_to_funding: averageDaysToFunding,
        by_stage: stageCount,
      });
    } catch (error) {
      console.error('Error fetching lender details:', error);
      toast({
        title: "Error",
        description: "Failed to load lender details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !id) return;

    try {
      if (editingContact) {
        const { error } = await ibmDb
          .from('lender_contacts')
          .update(contactFormData)
          .eq('id', editingContact.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Contact updated successfully"
        });
      } else {
        const { error } = await ibmDb
          .from('lender_contacts')
          .insert([{ 
            ...contactFormData, 
            lender_id: id,
            user_id: user.id 
          }]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Contact added successfully"
        });
      }

      setShowContactForm(false);
      setEditingContact(null);
      resetContactForm();
      fetchLenderDetails();
    } catch (error) {
      console.error('Error saving contact:', error);
      toast({
        title: "Error",
        description: "Failed to save contact",
        variant: "destructive"
      });
    }
  };

  const handleDeleteContact = async (contactId: string, contactName: string) => {
    if (!confirm(`Are you sure you want to delete ${contactName}?`)) return;

    try {
      const { error } = await ibmDb
        .from('lender_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Contact deleted successfully"
      });

      fetchLenderDetails();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive"
      });
    }
  };

  const resetContactForm = () => {
    setContactFormData({
      name: '',
      title: '',
      email: '',
      phone: '',
      mobile_phone: '',
      is_primary: false,
      is_bdo: false,
      is_closer: false,
      is_vice_president: false,
      notes: '',
      is_active: true,
    });
  };

  const openEditContactForm = (contact: LenderContact) => {
    setEditingContact(contact);
    setContactFormData({
      name: contact.name,
      title: contact.title || '',
      email: contact.email || '',
      phone: contact.phone || '',
      mobile_phone: contact.mobile_phone || '',
      is_primary: contact.is_primary,
      is_bdo: contact.is_bdo,
      is_closer: contact.is_closer,
      is_vice_president: contact.is_vice_president,
      notes: contact.notes || '',
      is_active: contact.is_active,
    });
    setShowContactForm(true);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!lender) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Lender not found</p>
            <Button onClick={() => navigate('/lenders')} className="mt-4">
              Back to Lenders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeContacts = contacts.filter(c => c.is_active);
  const inactiveContacts = contacts.filter(c => !c.is_active);

  return (
    <div className="min-h-screen bg-background p-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/lenders')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Lenders
      </Button>

      <IBMPageHeader
        title={lender.name}
        subtitle={lender.lender_type.replace('_', ' ').toUpperCase()}
      />

      {/* Combined Lender & Contacts Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded bg-primary/10 flex items-center justify-center overflow-hidden">
              {lender.logo_url ? (
                <img src={lender.logo_url} alt={`${lender.name} logo`} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-10 w-10 text-primary" />
              )}
            </div>
            <div>
              <CardTitle className="text-2xl mb-4">{lender.name}</CardTitle>
              <div className="space-y-3 text-sm">
              {lender.address && (
                <div>
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="mt-1">
                    {lender.address}
                    {lender.city && `, ${lender.city}`}
                    {lender.state && `, ${lender.state}`}
                    {lender.zip_code && ` ${lender.zip_code}`}
                  </p>
                </div>
              )}
              {lender.phone && (
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="mt-1">{formatPhoneNumber(lender.phone)}</p>
                </div>
              )}
              {lender.email && (
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="mt-1">{lender.email}</p>
                </div>
              )}
              {lender.website && (
                <div>
                  <Label className="text-muted-foreground">Website</Label>
                  <p className="mt-1">
                    <a href={lender.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {lender.website}
                    </a>
                  </p>
                </div>
              )}
              {lender.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="mt-1">{lender.notes}</p>
                </div>
              )}
            </div>
          </div>
          </div>
          <Button onClick={() => navigate(`/lenders/${id}/contacts/new`)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </CardHeader>
        
        {/* Lender Performance Section */}
        {performance && (
          <CardContent className="pt-6 border-t">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Lender Performance</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Assigned Loans</p>
                <p className="text-2xl font-bold text-primary">{performance.total_leads}</p>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-muted-foreground mb-1">Total Funded</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                  ${performance.total_funded.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-sm text-muted-foreground mb-1">Avg. Time to Funding</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                  {performance.average_days_to_funding} days
                </p>
              </div>
              {Object.entries(performance.by_stage).sort((a, b) => b[1] - a[1]).map(([stage, count]) => (
                <div key={stage} className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{stage}</p>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {performance.total_leads > 0 ? Math.round((count / performance.total_leads) * 100) : 0}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
        
        <CardContent className="pt-6 border-t">
          <h3 className="text-lg font-semibold mb-4">Lender Contacts</h3>
          {contacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No contacts yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="uppercase text-xs font-semibold">Contact Name</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">Title/Position</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">Contact Information</TableHead>
                  <TableHead className="uppercase text-xs font-semibold">Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeContacts.map((contact) => (
                  <TableRow key={contact.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="font-medium">{contact.name}</div>
                    </TableCell>
                    <TableCell>
                      {contact.title && (
                        <div className="text-sm">
                          <span>{contact.title}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{formatPhoneNumber(contact.phone)}</span>
                          </div>
                        )}
                        {contact.mobile_phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{formatPhoneNumber(contact.mobile_phone)} (Mobile)</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span className="text-sm">Active</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditContactForm(contact)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteContact(contact.id, contact.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {inactiveContacts.length > 0 && inactiveContacts.map((contact) => (
                  <TableRow key={contact.id} className="hover:bg-muted/50 opacity-60">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="font-medium">{contact.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.title && (
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          <span>{contact.title}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                        {contact.mobile_phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{contact.mobile_phone} (Mobile)</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.is_primary && (
                          <Badge variant="default" className="gap-1">
                            <Star className="h-3 w-3" />
                            Primary
                          </Badge>
                        )}
                        {contact.is_bdo && (
                          <Badge variant="secondary">BDO</Badge>
                        )}
                        {contact.is_closer && (
                          <Badge variant="outline" className="border-green-500 text-green-700">
                            Closer
                          </Badge>
                        )}
                        {contact.is_vice_president && (
                          <Badge variant="outline" className="border-purple-500 text-purple-700">
                            VP
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                        <span className="text-sm">Inactive</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditContactForm(contact)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteContact(contact.id, contact.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Related Leads Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Related Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RelatedLeadsTable lenderId={id || ''} />
        </CardContent>
      </Card>

      {/* Contact Form Dialog */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'Add New Contact'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="contact_name">Full Name *</Label>
                <Input
                  id="contact_name"
                  value={contactFormData.name}
                  onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={contactFormData.title}
                  onChange={(e) => setContactFormData({ ...contactFormData, title: e.target.value })}
                  placeholder="Business Development Officer, Loan Officer, etc."
                />
              </div>

              <div>
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={contactFormData.email}
                  onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="contact_phone">Office Phone</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={contactFormData.phone}
                  onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="mobile_phone">Mobile Phone</Label>
                <Input
                  id="mobile_phone"
                  type="tel"
                  value={contactFormData.mobile_phone}
                  onChange={(e) => setContactFormData({ ...contactFormData, mobile_phone: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_primary"
                    checked={contactFormData.is_primary}
                    onCheckedChange={(checked) => 
                      setContactFormData({ ...contactFormData, is_primary: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_primary" className="cursor-pointer">
                    Primary Contact
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_bdo"
                    checked={contactFormData.is_bdo}
                    onCheckedChange={(checked) => 
                      setContactFormData({ ...contactFormData, is_bdo: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_bdo" className="cursor-pointer">
                    Business Development Officer (BDO)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_closer"
                    checked={contactFormData.is_closer}
                    onCheckedChange={(checked) => 
                      setContactFormData({ ...contactFormData, is_closer: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_closer" className="cursor-pointer">
                    Closer
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_vice_president"
                    checked={contactFormData.is_vice_president}
                    onCheckedChange={(checked) => 
                      setContactFormData({ ...contactFormData, is_vice_president: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_vice_president" className="cursor-pointer">
                    Vice President
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_active_contact"
                    checked={contactFormData.is_active}
                    onCheckedChange={(checked) => 
                      setContactFormData({ ...contactFormData, is_active: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_active_contact" className="cursor-pointer">
                    Active
                  </Label>
                </div>
              </div>

              <div className="col-span-2">
                <Label htmlFor="contact_notes">Notes</Label>
                <Textarea
                  id="contact_notes"
                  value={contactFormData.notes}
                  onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowContactForm(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingContact ? 'Update' : 'Add'} Contact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
