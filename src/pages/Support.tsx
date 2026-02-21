import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  MessageSquare, 
  Ticket, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  User,
  Calendar,
  Plus,
  Filter,
  Search,
  TrendingUp,
  Users,
  MoreVertical,
  Eye,
  MessageCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ibmDb } from '@/lib/ibm';
import { getAuthUser } from '@/lib/auth-utils';
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  category: string;
}

interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'support';
  timestamp: string;
}

export default function Support() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      message: 'Hello! Welcome to LoanFlow Support. How can I assist you today?',
      sender: 'support',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketDescription, setNewTicketDescription] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newTicketCategory, setNewTicketCategory] = useState('General');
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch tickets from database
  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const user = await getAuthUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await ibmDb
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTickets(((data as any[]) || []) as SupportTicket[]);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: "Error",
        description: "Failed to load support tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicketSubject || !newTicketDescription) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await ibmDb
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: newTicketSubject,
          description: newTicketDescription,
          priority: newTicketPriority,
          category: newTicketCategory,
          status: 'open'
        });

      if (error) throw error;

      toast({
        title: "Ticket created",
        description: "Your support ticket has been submitted successfully",
      });

      setNewTicketSubject('');
      setNewTicketDescription('');
      setNewTicketPriority('medium');
      setNewTicketCategory('General');

      // Refresh tickets list
      fetchTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: "Error",
        description: "Failed to create support ticket",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      message: chatInput,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    setChatMessages([...chatMessages, newMessage]);
    setChatInput('');

    // Simulate support response
    setTimeout(() => {
      const supportReply: ChatMessage = {
        id: (Date.now() + 1).toString(),
        message: 'Thank you for your message. A support agent will respond shortly.',
        sender: 'support',
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, supportReply]);
    }, 1000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'in_progress':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'resolved':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return '';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'low':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return '';
    }
  };

  const ticketStats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <IBMPageHeader 
          title="Support Center"
          subtitle="Manage support tickets and connect with our team through live chat"
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-8 text-xs font-medium">
                <Filter className="h-3 w-3 mr-2" />
                Filter
              </Button>
              <Button size="sm" className="h-8 text-xs font-medium bg-[#0f62fe] hover:bg-[#0353e9] text-white">
                <Plus className="h-3 w-3 mr-2" />
                New Ticket
              </Button>
            </>
          }
        />

        {/* Content Area */}
        <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-[#0A1628] hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div>
                <p className="text-sm text-muted-foreground">Total Tickets</p>
                <p className="text-2xl font-bold text-foreground">{ticketStats.total}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-[#0A1628] hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-blue-500">{ticketStats.open}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-[#0A1628] hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-yellow-500">{ticketStats.inProgress}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-[#0A1628] hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-500">{ticketStats.resolved}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-[#0A1628] p-1 gap-2">
            <TabsTrigger value="tickets" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              <span>Support Tickets</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white hover:text-white rounded-md flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Live Chat</span>
            </TabsTrigger>
          </TabsList>

          {/* Support Tickets Tab */}
          <TabsContent value="tickets" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Create New Ticket */}
              <div className="lg:col-span-1">
                <Card className="border-[#0A1628]">
                  <CardHeader>
                    <CardTitle>Create New Ticket</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Subject</label>
                        <Input
                          placeholder="Brief description of your issue"
                          value={newTicketSubject}
                          onChange={(e) => setNewTicketSubject(e.target.value)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Category</label>
                          <Select value={newTicketCategory} onValueChange={setNewTicketCategory}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent className="z-50 bg-popover">
                              <SelectItem value="General">General</SelectItem>
                              <SelectItem value="Technical">Technical</SelectItem>
                              <SelectItem value="Access">Access</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Priority</label>
                          <Select value={newTicketPriority} onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') => setNewTicketPriority(value)}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent className="z-50 bg-popover">
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Description</label>
                        <Textarea
                          placeholder="Detailed description of your issue..."
                          className="min-h-32"
                          value={newTicketDescription}
                          onChange={(e) => setNewTicketDescription(e.target.value)}
                        />
                      </div>
                      
                      <Button className="w-full bg-[#0f62fe] hover:bg-[#0353e9] text-white" onClick={handleCreateTicket}>
                        <Plus className="h-4 w-4 mr-2" />
                        Submit Ticket
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tickets List */}
              <div className="lg:col-span-2">
                <Card className="border-[#0A1628]">
                  <CardHeader>
                    <CardTitle>Your Support Tickets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search tickets..."
                          className="pl-10"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      {/* Tickets */}
                      <div className="space-y-3">
                        {loading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p className="ml-3 text-muted-foreground">Loading tickets...</p>
                          </div>
                        ) : filteredTickets.length === 0 ? (
                          <Alert>
                            <AlertDescription>
                              {searchQuery ? "No tickets found. Try adjusting your search." : "No support tickets yet. Create your first ticket above."}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          filteredTickets.map((ticket) => (
                            <div
                              key={ticket.id}
                              className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-foreground">{ticket.subject}</h3>
                                    <Badge className={getPriorityColor(ticket.priority)} variant="outline">
                                      {ticket.priority}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-2">{ticket.description}</p>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(ticket.created_at).toLocaleDateString()}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {ticket.category}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={getStatusColor(ticket.status)} variant="outline">
                                    <span className="flex items-center gap-1">
                                      {getStatusIcon(ticket.status)}
                                      {ticket.status.replace('_', ' ')}
                                    </span>
                                  </Badge>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <MessageCircle className="h-4 w-4 mr-2" />
                                        Add Comment
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Live Chat Tab */}
          <TabsContent value="chat" className="mt-6">
            <Card className="border-[#0A1628]">
              <CardHeader>
                <CardTitle>Live Support Chat</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <Users className="h-4 w-4" />
                    <AlertDescription>
                      Our support team is available 24/7. Average response time: 2 minutes
                    </AlertDescription>
                  </Alert>

                  {/* Chat Messages */}
                  <div className="h-96 overflow-y-auto border border-border rounded-lg p-4 space-y-4 bg-muted/20">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            msg.sender === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-3 w-3" />
                            <span className="text-xs font-medium">
                              {msg.sender === 'user' ? 'You' : 'Support Agent'}
                            </span>
                          </div>
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button onClick={handleSendMessage} size="icon" className="bg-[#0f62fe] hover:bg-[#0353e9] text-white">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
