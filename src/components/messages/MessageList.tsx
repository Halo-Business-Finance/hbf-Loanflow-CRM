import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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

interface MessageListProps {
  messages: Message[];
  selectedMessageId: string | null;
  onMessageClick: (message: Message) => void;
  currentUserId: string | null;
  folder: string;
  loading: boolean;
}

export function MessageList({ 
  messages, 
  selectedMessageId, 
  onMessageClick, 
  currentUserId,
  folder,
  loading 
}: MessageListProps) {
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const filteredMessages = messages.filter(msg => {
    if (folder === 'inbox') return msg.recipient_id === currentUserId;
    if (folder === 'sent') return msg.sender_id === currentUserId;
    return false;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-2">
          <div className="animate-pulse h-8 w-8 bg-primary/20 rounded-full mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (filteredMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No messages</p>
            <p className="text-xs text-muted-foreground mt-1">
              {folder === 'inbox' ? 'Your inbox is empty' : 'No sent messages'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {filteredMessages.map((message) => {
          const isSelected = selectedMessageId === message.id;
          const isInbox = folder === 'inbox';
          const displayProfile = isInbox ? message.sender_profile : message.recipient_profile;
          
          return (
            <div
              key={message.id}
              onClick={() => onMessageClick(message)}
              className={cn(
                "p-4 cursor-pointer transition-colors hover:bg-accent/50",
                isSelected && "bg-accent border-l-4 border-l-primary",
                !isSelected && "border-l-4 border-l-transparent",
                !message.is_read && isInbox && "bg-primary/5 font-medium"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <Avatar className={cn(
                    "h-10 w-10 border-2",
                    !message.is_read && isInbox ? "border-primary/40" : "border-border"
                  )}>
                    <AvatarFallback className={cn(
                      "text-sm",
                      !message.is_read && isInbox && "bg-primary/10 text-primary font-semibold"
                    )}>
                      {getInitials(
                        displayProfile?.full_name || null,
                        displayProfile?.email || ''
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {!message.is_read && isInbox && (
                    <div className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-primary rounded-full border-2 border-background" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn(
                      "text-sm truncate",
                      !message.is_read && isInbox ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                    )}>
                      {displayProfile?.full_name || displayProfile?.email}
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true }).replace('about ', '')}
                    </p>
                  </div>
                  <p className={cn(
                    "text-sm truncate",
                    !message.is_read && isInbox ? "font-semibold" : "font-normal text-foreground/80"
                  )}>
                    {message.subject}
                  </p>
                  <p className="text-sm text-muted-foreground truncate line-clamp-2">
                    {message.message}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
