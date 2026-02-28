import React, { useState } from 'react';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Send, Users, Clock, BarChart3, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

interface SMSCampaign {
  id: string;
  name: string;
  message: string;
  status: 'draft' | 'scheduled' | 'sent' | 'active';
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  responseCount: number;
  scheduledAt?: string;
  sentAt?: string;
}

const mockCampaigns: SMSCampaign[] = [
  {
    id: '1',
    name: 'Q1 Rate Drop Alert',
    message: 'Great news! Rates just dropped. Reply YES to learn about refinancing options.',
    status: 'sent',
    recipientCount: 342,
    sentCount: 342,
    deliveredCount: 331,
    responseCount: 48,
    sentAt: '2026-02-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Document Reminder Blast',
    message: 'Hi {first_name}, we still need your documents to move forward. Reply HELP for assistance.',
    status: 'scheduled',
    recipientCount: 87,
    sentCount: 0,
    deliveredCount: 0,
    responseCount: 0,
    scheduledAt: '2026-03-01T09:00:00Z',
  },
  {
    id: '3',
    name: 'New Loan Product Launch',
    message: 'Introducing our new SBA Express loan — up to $500K with faster approval. Call us to learn more!',
    status: 'draft',
    recipientCount: 0,
    sentCount: 0,
    deliveredCount: 0,
    responseCount: 0,
  },
];

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-primary/10 text-primary',
  sent: 'bg-green-500/10 text-green-600',
  active: 'bg-blue-500/10 text-blue-600',
};

export default function SMSMarketing() {
  const [campaigns] = useState<SMSCampaign[]>(mockCampaigns);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [campaignName, setCampaignName] = useState('');

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.deliveredCount, 0);
  const totalResponses = campaigns.reduce((sum, c) => sum + c.responseCount, 0);
  const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : '0';

  const handleCreateCampaign = () => {
    if (!campaignName.trim() || !newMessage.trim()) {
      toast.error('Please enter a campaign name and message');
      return;
    }
    toast.success(`SMS campaign "${campaignName}" created as draft`);
    setCampaignName('');
    setNewMessage('');
  };

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="SMS Marketing"
        subtitle="Create and manage SMS campaigns, track delivery and response metrics"
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sent</p>
                  <p className="text-2xl font-bold">{totalSent.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-2xl font-bold">{totalDelivered.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Responses</p>
                  <p className="text-2xl font-bold">{totalResponses}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent">
                  <BarChart3 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Rate</p>
                  <p className="text-2xl font-bold">{deliveryRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="compose">Compose</TabsTrigger>
          </TabsList>

          {/* Campaigns List */}
          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Recipients</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Responses</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                            {campaign.message}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[campaign.status]}>
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{campaign.recipientCount}</TableCell>
                      <TableCell className="text-right">{campaign.deliveredCount}</TableCell>
                      <TableCell className="text-right">{campaign.responseCount}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {campaign.sentAt
                            ? new Date(campaign.sentAt).toLocaleDateString()
                            : campaign.scheduledAt
                            ? `Scheduled ${new Date(campaign.scheduledAt).toLocaleDateString()}`
                            : '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCampaigns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No campaigns found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Compose */}
          <TabsContent value="compose">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  New SMS Campaign
                </CardTitle>
                <CardDescription>
                  Compose a message and select recipients. Use {'{first_name}'} for personalization.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Campaign Name</label>
                  <Input
                    placeholder="e.g. March Rate Alert"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    placeholder="Type your SMS message here..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    maxLength={160}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {newMessage.length}/160 characters
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleCreateCampaign}>
                    <Send className="h-4 w-4 mr-2" />
                    Save as Draft
                  </Button>
                  <Button variant="outline" onClick={() => toast.info('Scheduling coming soon')}>
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
