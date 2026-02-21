import React, { useState, useEffect } from 'react';
import { ibmDb } from '@/lib/ibm';
// supabase import removed - using ibmDb
import { getAuthUser } from '@/lib/auth-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MessageComposerProps {
  replyTo?: {
    id: string;
    sender_id: string;
    subject: string;
    sender_profile?: {
      full_name: string | null;
      email: string;
    };
  } | null;
  onClose: () => void;
  onSent: () => void;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

export function MessageComposer({ replyTo, onClose, onSent }: MessageComposerProps) {
  const [recipients, setRecipients] = useState<User[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    
    if (replyTo) {
      setSelectedRecipient(replyTo.sender_id);
      setSubject(replyTo.subject.startsWith('Re: ') ? replyTo.subject : `Re: ${replyTo.subject}`);
    }
  }, [replyTo]);

  const fetchUsers = async () => {
    try {
      const currentUser = await getAuthUser();
      
      // Fetch users excluding current user
      let query = ibmDb
        .from('profiles')
        .select('id, email')
        .order('email');

      // Exclude current user
      if (currentUser) {
        query = query.neq('id', currentUser.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Format users - filter out those without email
      const formattedUsers = ((data as any[]) || [])
        .filter((u: any) => u.email)
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          full_name: null
        }));
      
      setRecipients(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    }
  };

  const handleSend = async () => {
    if (!selectedRecipient || !subject.trim() || !message.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    if (subject.trim().length > 200) {
      toast({
        title: 'Validation Error',
        description: 'Subject must be 200 characters or less',
        variant: 'destructive',
      });
      return;
    }

    if (message.trim().length > 10000) {
      toast({
        title: 'Validation Error',
        description: 'Message must be 10,000 characters or less',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSending(true);
      const user = await getAuthUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await ibmDb.from('user_messages').insert({
        sender_id: user.id,
        recipient_id: selectedRecipient,
        subject: subject.trim(),
        message: message.trim(),
        parent_message_id: replyTo?.id || null,
      });

      if (error) throw error;

      // Best-effort notification
      try {
        await ibmDb.from('notifications').insert({
          user_id: selectedRecipient,
          title: 'New Message',
          message: `${user.email} sent you a message: ${subject}`,
          type: 'message',
          scheduled_for: new Date().toISOString(), // Add to calendar
          related_id: null,
          related_type: 'message',
        });
      } catch (notifError) {
        console.warn('Notifications insert skipped:', notifError);
      }

      onSent();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold">
            {replyTo ? 'Reply to Message' : 'New Message'}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="recipient" className="text-xs">To</Label>
            <Select
              value={selectedRecipient}
              onValueChange={setSelectedRecipient}
              disabled={!!replyTo}
            >
              <SelectTrigger id="recipient" className="h-9 text-sm">
                <SelectValue placeholder="Select recipient" />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((user) => (
                  <SelectItem key={user.id} value={user.id} className="text-sm">
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="subject" className="text-xs">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="message" className="text-xs">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={6}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose} size="sm" className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending} size="sm" className="h-8 text-xs">
              <Send className="mr-1.5 h-3 w-3" />
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
