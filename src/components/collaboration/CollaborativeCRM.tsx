import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Users, 
  FileText,
  Share2,
  Plus,
  Send,
  Search,
  Filter,
  Bell,
  Eye,
  Edit,
  Clock,
  Building,
  DollarSign,
  User,
  Phone,
  Mail,
  Calendar,
  Tag,
  History,
  CheckCircle,
  AlertCircle,
  Target,
  BookOpen,
  Database,
  Activity
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { useRoleBasedAccess } from "@/hooks/useRoleBasedAccess";
import { formatDistanceToNow, format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

interface BorrowerInfo {
  id: string;
  name: string;
  business_name?: string;
  email: string;
  phone: string;
  loan_amount?: number;
  loan_type?: string;
  stage: string;
  priority: string;
  created_at: string;
  last_contact?: string;
  assigned_processor?: string;
  assigned_underwriter?: string;
  assigned_closer?: string;
}

interface DepartmentMessage {
  id: string;
  borrower_id: string;
  department: string;
  user_name: string;
  user_role: string;
  message: string;
  message_type: 'update' | 'question' | 'approval' | 'issue';
  timestamp: string;
  attachments?: string[];
  is_urgent: boolean;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  views: number;
  helpful_votes: number;
}

interface ActivityLog {
  id: string;
  borrower_id: string;
  user_name: string;
  department: string;
  action: string;
  details: string;
  timestamp: string;
}

export function CollaborativeCRM() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { userRole, canAccessLeads, canProcessLoans, canUnderwriteLoans, canCloseLoans } = useRoleBasedAccess();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedBorrower, setSelectedBorrower] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<'update' | 'question' | 'approval' | 'issue'>('update');
  
  // State for data
  const [borrowers, setBorrowers] = useState<BorrowerInfo[]>([]);
  const [messages, setMessages] = useState<DepartmentMessage[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock departments for filtering
  const departments = [
    { value: 'all', label: 'All Departments' },
    { value: 'sales', label: 'Sales' },
    { value: 'processing', label: 'Processing' },
    { value: 'underwriting', label: 'Underwriting' },
    { value: 'closing', label: 'Closing' },
    { value: 'funding', label: 'Funding' }
  ];

  useEffect(() => {
    if (user) {
      fetchBorrowerData();
      fetchMessages();
      fetchKnowledgeBase();
      fetchActivityLog();
    }
  }, [user]);

  const fetchBorrowerData = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_entities')
        .select(`
          id,
          name,
          business_name,
          email,
          phone,
          loan_amount,
          loan_type,
          stage,
          priority,
          created_at,
          processor_name,
          bdo_name
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedData: BorrowerInfo[] = (data || []).map(contact => ({
        id: contact.id,
        name: contact.name || '',
        business_name: contact.business_name,
        email: contact.email || '',
        phone: contact.phone || '',
        loan_amount: contact.loan_amount,
        loan_type: contact.loan_type,
        stage: contact.stage || 'New Lead',
        priority: contact.priority || 'medium',
        created_at: contact.created_at,
        assigned_processor: contact.processor_name,
        assigned_underwriter: contact.bdo_name
      }));

      setBorrowers(transformedData);
    } catch (error) {
      console.error('Error fetching borrower data:', error);
      toast({
        title: "Error",
        description: "Failed to load borrower information",
        variant: "destructive",
      });
    }
  };

  const fetchMessages = async () => {
    // In a real implementation, this would fetch from a messages table
    // For now, we'll use mock data
    const mockMessages: DepartmentMessage[] = [
      {
        id: '1',
        borrower_id: borrowers[0]?.id || '1',
        department: 'processing',
        user_name: 'Emily Rodriguez',
        user_role: 'Loan Processor',
        message: 'Initial documentation review completed. Credit report shows 720 score. Moving to underwriting.',
        message_type: 'update',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        is_urgent: false
      },
      {
        id: '2',
        borrower_id: borrowers[0]?.id || '1',
        department: 'underwriting',
        user_name: 'Mike Chen',
        user_role: 'Senior Underwriter',
        message: 'Need additional cash flow statements for the last 6 months. Current debt-to-income ratio requires clarification.',
        message_type: 'question',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        is_urgent: true
      },
      {
        id: '3',
        borrower_id: borrowers[0]?.id || '1',
        department: 'sales',
        user_name: 'Sarah Johnson',
        user_role: 'Senior Loan Officer',
        message: 'Client has provided the requested documents. Uploading to system now.',
        message_type: 'update',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        is_urgent: false
      }
    ];
    setMessages(mockMessages);
  };

  const fetchKnowledgeBase = async () => {
    // Mock knowledge base items
    const mockKnowledge: KnowledgeItem[] = [
      {
        id: '1',
        title: 'SBA Loan Processing Guidelines',
        content: 'Complete guide for processing SBA loans including documentation requirements...',
        category: 'Processing',
        tags: ['SBA', 'processing', 'documentation'],
        created_by: 'System Admin',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
        views: 245,
        helpful_votes: 23
      },
      {
        id: '2',
        title: 'Underwriting Checklist for Equipment Financing',
        content: 'Step-by-step checklist for underwriting equipment financing applications...',
        category: 'Underwriting',
        tags: ['equipment', 'financing', 'checklist'],
        created_by: 'Mike Chen',
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-12T00:00:00Z',
        views: 156,
        helpful_votes: 18
      },
      {
        id: '3',
        title: 'Common Closing Issues and Resolutions',
        content: 'Frequently encountered issues during the closing process and their solutions...',
        category: 'Closing',
        tags: ['closing', 'issues', 'solutions'],
        created_by: 'David Kim',
        created_at: '2024-01-08T00:00:00Z',
        updated_at: '2024-01-14T00:00:00Z',
        views: 189,
        helpful_votes: 31
      }
    ];
    setKnowledgeBase(mockKnowledge);
  };

  const fetchActivityLog = async () => {
    // Mock activity log
    const mockActivity: ActivityLog[] = [
      {
        id: '1',
        borrower_id: borrowers[0]?.id || '1',
        user_name: 'Emily Rodriguez',
        department: 'Processing',
        action: 'Document Review',
        details: 'Completed initial document review and credit analysis',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        borrower_id: borrowers[0]?.id || '1',
        user_name: 'Mike Chen',
        department: 'Underwriting',
        action: 'Request Additional Info',
        details: 'Requested additional cash flow statements',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      }
    ];
    setActivityLog(mockActivity);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedBorrower) return;

    const message: DepartmentMessage = {
      id: Date.now().toString(),
      borrower_id: selectedBorrower,
      department: getDepartmentFromRole(userRole),
      user_name: user?.email?.split('@')[0] || 'Unknown User',
      user_role: userRole || 'User',
      message: newMessage,
      message_type: messageType,
      timestamp: new Date().toISOString(),
      is_urgent: messageType === 'issue' || messageType === 'approval'
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');

    toast({
      title: "Message Sent",
      description: "Your message has been shared with the team",
    });
  };

  const getDepartmentFromRole = (role?: string) => {
    switch (role) {
      case 'loan_processor': return 'processing';
      case 'underwriter': return 'underwriting';
      case 'closer': return 'closing';
      case 'funder': return 'funding';
      default: return 'sales';
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'update': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'question': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approval': return 'bg-green-100 text-green-800 border-green-200';
      case 'issue': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredBorrowers = borrowers.filter(borrower =>
    borrower.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    borrower.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMessages = selectedBorrower
    ? messages.filter(msg => msg.borrower_id === selectedBorrower &&
        (filterDepartment === 'all' || msg.department === filterDepartment))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading collaborative CRM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-card/60 to-card/30 backdrop-blur-sm rounded-xl p-6 border border-border/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Collaborative CRM</h1>
            <p className="text-sm text-muted-foreground">Cross-departmental communication and shared customer information</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Customer Overview</TabsTrigger>
          <TabsTrigger value="communication">Team Communication</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Customer List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Borrowers
                </CardTitle>
                <Input
                  placeholder="Search borrowers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {filteredBorrowers.map(borrower => (
                      <div
                        key={borrower.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedBorrower === borrower.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedBorrower(borrower.id)}
                      >
                        <div className="font-medium text-sm">{borrower.name}</div>
                        {borrower.business_name && (
                          <div className="text-xs text-muted-foreground">{borrower.business_name}</div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={borrower.stage === 'New Lead' ? 'secondary' : 'outline'} className="text-xs">
                            {borrower.stage}
                          </Badge>
                          {borrower.loan_amount && (
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(borrower.loan_amount)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Customer Details */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {selectedBorrower ? 'Borrower Details' : 'Select a Borrower'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedBorrower ? (
                  <div className="space-y-6">
                    {(() => {
                      const borrower = borrowers.find(b => b.id === selectedBorrower);
                      if (!borrower) return null;
                      
                      return (
                        <>
                          {/* Basic Info */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Name</label>
                              <p className="font-medium">{borrower.name}</p>
                            </div>
                            {borrower.business_name && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Business</label>
                                <p className="font-medium">{borrower.business_name}</p>
                              </div>
                            )}
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Email</label>
                              <p className="font-medium">{borrower.email}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Phone</label>
                              <p className="font-medium">{borrower.phone}</p>
                            </div>
                          </div>

                          {/* Loan Info */}
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            {borrower.loan_amount && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Loan Amount</label>
                                <p className="font-medium">{formatCurrency(borrower.loan_amount)}</p>
                              </div>
                            )}
                            {borrower.loan_type && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Loan Type</label>
                                <p className="font-medium">{borrower.loan_type}</p>
                              </div>
                            )}
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Stage</label>
                              <Badge variant="outline" className="ml-2">{borrower.stage}</Badge>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground">Priority</label>
                              <Badge variant="outline" className="ml-2">{borrower.priority}</Badge>
                            </div>
                          </div>

                          {/* Team Assignments */}
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            {borrower.assigned_processor && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Assigned Processor</label>
                                <p className="font-medium">{borrower.assigned_processor}</p>
                              </div>
                            )}
                            {borrower.assigned_underwriter && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Assigned Underwriter</label>
                                <p className="font-medium">{borrower.assigned_underwriter}</p>
                              </div>
                            )}
                          </div>

                          {/* Recent Activity */}
                          <Separator />
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Recent Activity</label>
                            <div className="mt-2 space-y-2">
                              {activityLog
                                .filter(activity => activity.borrower_id === selectedBorrower)
                                .slice(0, 3)
                                .map(activity => (
                                  <div key={activity.id} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                                    <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{activity.action}</p>
                                      <p className="text-xs text-muted-foreground">{activity.details}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {activity.user_name} • {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a borrower to view detailed information and team communications
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="communication" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Message Filters */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Department</label>
                  <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.value} value={dept.value}>
                          {dept.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Message Type</label>
                  <Select value={messageType} onValueChange={(value: any) => setMessageType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="approval">Approval</SelectItem>
                      <SelectItem value="issue">Issue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Communication Area */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Team Communication
                  {selectedBorrower && (
                    <span className="text-sm font-normal text-muted-foreground">
                      - {borrowers.find(b => b.id === selectedBorrower)?.name}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedBorrower ? (
                  <div className="space-y-4">
                    {/* Messages */}
                    <ScrollArea className="h-96">
                      <div className="space-y-3">
                        {filteredMessages.map(message => (
                          <div key={message.id} className="p-3 border rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarFallback className="text-xs">
                                    {message.user_name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <span className="font-medium text-sm">{message.user_name}</span>
                                  <span className="text-xs text-muted-foreground ml-1">({message.user_role})</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-xs ${getMessageTypeColor(message.message_type)}`}>
                                  {message.message_type}
                                </Badge>
                                {message.is_urgent && (
                                  <Badge variant="destructive" className="text-xs">
                                    Urgent
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm">{message.message}</p>
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 flex gap-1">
                                {message.attachments.map((file, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    <FileText className="h-3 w-3 mr-1" />
                                    {file}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {filteredMessages.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No messages for this borrower yet
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    {/* New Message */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Share an update, ask a question, or report an issue..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        rows={3}
                      />
                      <div className="flex items-center justify-between">
                        <Select value={messageType} onValueChange={(value: any) => setMessageType(value)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="update">Update</SelectItem>
                            <SelectItem value="question">Question</SelectItem>
                            <SelectItem value="approval">Approval</SelectItem>
                            <SelectItem value="issue">Issue</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                          <Send className="h-4 w-4 mr-2" />
                          Send Message
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a borrower to view and participate in team communications
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Knowledge Base
                </CardTitle>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Article
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {knowledgeBase.map(item => (
                  <Card key={item.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-sm">{item.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.content}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            <Tag className="h-2 w-2 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Eye className="h-3 w-3" />
                          {item.views}
                          <CheckCircle className="h-3 w-3" />
                          {item.helpful_votes}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {activityLog.map(activity => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {activity.user_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{activity.user_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {activity.department}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">{activity.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}