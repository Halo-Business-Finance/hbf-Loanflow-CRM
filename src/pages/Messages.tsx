import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Button } from '@/components/ui/button';
import { MessageComposer } from '@/components/MessageComposer';
import { MessagesSidebar } from '@/components/messages/MessagesSidebar';
import { MessageList } from '@/components/messages/MessageList';
import { MessageContent } from '@/components/messages/MessageContent';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { Send, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender_profile?: {
    full_name: string | null;
    email: string;
  };
  recipient_profile?: {
    full_name: string | null;
    email: string;
  };
}

export default function Messages() {
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Batch profile lookups
      const uniqueIds = Array.from(new Set((data || []).flatMap(d => [d.sender_id, d.recipient_id])));
      
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', uniqueIds);
        
        const emailById = new Map((profiles || []).map(p => [p.id, p.email]));
        
        const messagesWithProfiles = (data || []).map(msg => ({
          ...msg,
          sender_profile: { 
            full_name: null, 
            email: emailById.get(msg.sender_id) || msg.sender_id 
          },
          recipient_profile: { 
            full_name: null, 
            email: emailById.get(msg.recipient_id) || msg.recipient_id 
          }
        }));
        
        setMessages(messagesWithProfiles);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  useRealtimeSubscription({
    table: 'user_messages',
    onChange: () => {
      try {
        fetchMessages();
      } catch (e) {
        console.warn('Realtime fetch failed:', e);
      }
    },
  });

  const markAsRead = async (messageId: string) => {
    if (!currentUserId) return;
    
    try {
      const { error } = await supabase
        .from('user_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('recipient_id', currentUserId);

      if (error) throw error;
      fetchMessages();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('user_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Message deleted',
      });
      
      setSelectedMessage(null);
      fetchMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive',
      });
    }
  };

  const handleMessageClick = (message: Message) => {
    setSelectedMessage(message);
    if (!message.is_read && message.recipient_id === currentUserId) {
      markAsRead(message.id);
    }
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
    setIsComposing(true);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setIsComposing(true);
  };

  const handleMessageSent = () => {
    setIsComposing(false);
    setReplyTo(null);
    fetchMessages();
    toast({
      title: 'Success',
      description: 'Message sent successfully',
    });
  };

  const unreadCount = messages.filter(msg => !msg.is_read && msg.recipient_id === currentUserId).length;

  return (
    <div className="flex flex-col h-full bg-background">
      <IBMPageHeader
        title="Messages"
        subtitle="Internal communication system"
        actions={
          <>
            <Button onClick={fetchMessages} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleCompose} size="sm">
              <Send className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </>
        }
      />

      {/* Three-Pane Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - Folders */}
        <MessagesSidebar
          activeFolder={activeFolder}
          onFolderChange={(folder) => {
            setActiveFolder(folder);
            setSelectedMessage(null);
          }}
          unreadCount={unreadCount}
        />

        {/* Middle Pane - Message List */}
        <div className={`${selectedMessage || isComposing ? 'w-72' : 'flex-1'} border-r bg-background transition-all duration-200`}>
          <MessageList
            messages={messages}
            selectedMessageId={selectedMessage?.id || null}
            onMessageClick={handleMessageClick}
            currentUserId={currentUserId}
            folder={activeFolder}
            loading={loading}
          />
        </div>

        {/* Right Pane - Message Content or Composer (Only shown when message selected or composing) */}
        {(selectedMessage || isComposing) && (
          <div className="flex-1 bg-background">
            {isComposing ? (
              <div className="p-6 h-full overflow-auto">
                <MessageComposer
                  replyTo={replyTo}
                  onClose={() => {
                    setIsComposing(false);
                    setReplyTo(null);
                  }}
                  onSent={handleMessageSent}
                />
              </div>
            ) : (
              <MessageContent
                message={selectedMessage}
                folder={activeFolder}
                onReply={handleReply}
                onDelete={deleteMessage}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
