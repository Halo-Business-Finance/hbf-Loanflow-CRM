import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Reply, ReplyAll, Forward, Trash2, Mail } from "lucide-react";
import { format } from "date-fns";

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

interface MessageContentProps {
  message: Message | null;
  folder: string;
  onReply: (message: Message) => void;
  onDelete: (messageId: string) => void;
}

export function MessageContent({ message, folder, onReply, onDelete }: MessageContentProps) {
  if (!message) {
    return (
      <div className="flex items-center justify-center h-full p-8 bg-muted/20">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No message selected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Select a message from the list to view its contents
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const displayProfile = folder === 'inbox' ? message.sender_profile : message.recipient_profile;
  const isInbox = folder === 'inbox';

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Message Header */}
      <div className="border-b p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground pr-4">
            {message.subject}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0"
            onClick={() => onDelete(message.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Sender Info */}
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 border-2 border-border">
            <AvatarFallback className="text-sm font-semibold">
              {getInitials(
                displayProfile?.full_name || null,
                displayProfile?.email || ''
              )}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm text-foreground">
                {displayProfile?.full_name || displayProfile?.email}
              </p>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(message.created_at), 'EEE M/d/yyyy h:mm a')}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">To:</span> {isInbox ? message.recipient_profile?.email : message.sender_profile?.email}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => onReply(message)}
          >
            <Reply className="h-4 w-4" />
            Reply
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <ReplyAll className="h-4 w-4" />
            Reply all
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Forward className="h-4 w-4" />
            Forward
          </Button>
        </div>
      </div>

      {/* Message Body */}
      <ScrollArea className="flex-1 p-6">
        <div className="prose prose-sm max-w-none">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {message.message}
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
