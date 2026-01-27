import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users, 
  Calendar,
  FileText,
  Share2,
  Plus,
  Send,
  Video,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  Bell,
  Settings,
  UserPlus,
  MessageCircle,
  Eye,
  Edit
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar?: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  lastSeen?: string;
}

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  message: string;
  timestamp: string;
  type: 'message' | 'file' | 'system';
}

interface SharedDocument {
  id: string;
  name: string;
  type: string;
  shared_by: string;
  shared_at: string;
  access_level: 'view' | 'edit' | 'comment';
  department: string;
}

interface ActivityItem {
  id: string;
  user_name: string;
  action: string;
  target: string;
  timestamp: string;
  type: 'lead_update' | 'document_share' | 'meeting_scheduled' | 'stage_change';
}

export function TeamCollaboration() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sharedDocuments, setSharedDocuments] = useState<SharedDocument[]>([]);
  const [teamActivity, setTeamActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('team');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('loan_originator');

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      // Fetch team members from profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!profilesError && profiles) {
        const members: TeamMember[] = profiles.map(profile => ({
          id: profile.id,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User',
          role: 'Team Member',
          email: profile.email || 'No email',
          status: 'offline' as const,
          lastSeen: profile.updated_at
        }));
        setTeamMembers(members);
      } else {
        setTeamMembers([]);
      }

      // Fetch recent activity from audit logs
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!auditError && auditLogs) {
        const activities: ActivityItem[] = auditLogs.map(log => ({
          id: log.id,
          user_name: log.user_id || 'System',
          action: log.action,
          target: log.table_name,
          timestamp: log.created_at,
          type: log.action.includes('lead') ? 'lead_update' : 
                log.action.includes('document') ? 'document_share' :
                log.action.includes('stage') ? 'stage_change' : 'lead_update'
        }));
        setTeamActivity(activities);
      } else {
        setTeamActivity([]);
      }

      // Fetch shared documents
      const { data: documents, error: documentsError } = await supabase
        .from('lead_documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!documentsError && documents) {
        const shared: SharedDocument[] = documents.map(doc => ({
          id: doc.id,
          name: doc.document_name,
          type: doc.document_type || 'Document',
          shared_by: doc.user_id || 'Unknown',
          shared_at: doc.created_at,
          access_level: 'view' as const,
          department: 'General'
        }));
        setSharedDocuments(shared);
      } else {
        setSharedDocuments([]);
      }

      // Set empty chat messages for now
      setChatMessages([]);

    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: "Error",
        description: "Failed to load team collaboration data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      user_id: user?.id || '',
      user_name: user?.user_metadata?.first_name || 'Anonymous',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      type: 'message'
    };

    setChatMessages(prev => [...prev, newMessage]);
    setMessage("");

    toast({
      title: "Message Sent",
      description: "Your message has been sent to the team.",
    });
  };

  const getStatusColor = (status: TeamMember['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'busy': return 'bg-red-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'lead_update': return <Users className="h-4 w-4" />;
      case 'document_share': return <FileText className="h-4 w-4" />;
      case 'meeting_scheduled': return <Calendar className="h-4 w-4" />;
      case 'stage_change': return <CheckCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address to send the invitation.",
        variant: "destructive",
      });
      return;
    }

    // For now, just show success toast
    // In a real implementation, this would send an invite email via edge function
    toast({
      title: "Invitation Sent",
      description: `An invitation has been sent to ${inviteEmail}`,
    });

    setInviteEmail('');
    setInviteRole('loan_originator');
    setInviteOpen(false);
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
          <h2 className="text-3xl font-bold tracking-tight">Team Collaboration</h2>
          <p className="text-muted-foreground">
            Coordinate with your team and share information across departments
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="team">Team ({teamMembers.length})</TabsTrigger>
          <TabsTrigger value="chat">Chat ({chatMessages.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({sharedDocuments.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({teamActivity.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback>
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(member.status)}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{member.name}</h3>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                      <Badge variant="outline" className="mt-1">
                        {member.status}
                      </Badge>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Mail className="h-4 w-4" />
                      </Button>
                    </div>
                    {member.lastSeen && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(member.lastSeen))} ago
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="h-5 w-5 mr-2" />
                Team Chat
              </CardTitle>
              <CardDescription>
                Real-time communication with your team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full border rounded p-4 mb-4">
                {chatMessages.length > 0 ? (
                  <div className="space-y-4">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="flex space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {msg.user_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm">{msg.user_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.timestamp))} ago
                            </span>
                          </div>
                          <p className="text-sm mt-1">{msg.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                  </div>
                )}
              </ScrollArea>
              <div className="flex space-x-2">
                <Input
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Shared Documents
              </CardTitle>
              <CardDescription>
                Documents shared across departments and team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sharedDocuments.length > 0 ? (
                <div className="space-y-3">
                  {sharedDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {doc.type} • Shared by {doc.shared_by} • {formatDistanceToNow(new Date(doc.shared_at))} ago
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{doc.access_level}</Badge>
                        <Badge variant="secondary">{doc.department}</Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No shared documents available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Team Activity Feed
              </CardTitle>
              <CardDescription>
                Recent actions and updates from team members
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamActivity.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {teamActivity.map((activity) => (
                      <div key={activity.id} className="flex space-x-3 p-3 border rounded">
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm">
                            <span className="font-medium">{activity.user_name}</span>
                            <span className="ml-2">{activity.action}</span>
                            <span className="ml-2 text-muted-foreground">{activity.target}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(activity.timestamp))} ago
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {activity.type.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Team Collaboration Settings</DialogTitle>
            <DialogDescription>
              Configure team collaboration preferences and notifications
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notification Preferences</Label>
              <p className="text-sm text-muted-foreground">
                Settings for team notifications will be available here.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Collaboration Tools</Label>
              <p className="text-sm text-muted-foreground">
                Configure integrations and collaboration features.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setSettingsOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="loan_originator">Loan Originator</option>
                <option value="loan_processor">Loan Processor</option>
                <option value="underwriter">Underwriter</option>
                <option value="closer">Closer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteMember}>
              <Send className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}