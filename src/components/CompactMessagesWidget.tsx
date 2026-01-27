import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, Send, Eye } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/components/auth/AuthProvider"
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"

interface Message {
  id: string
  subject: string
  message: string
  sender_id: string
  recipient_id: string
  is_read: boolean
  created_at: string
  sender_profile?: {
    first_name?: string
    last_name?: string
    email?: string
  }
}

export function CompactMessagesWidget() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  const fetchRecentMessages = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('user_messages')
        .select(`
          *,
          sender_profile:profiles!user_messages_sender_id_fkey(first_name, last_name, email)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        throw error
      }

      const messagesWithProfiles = (data || []).map(msg => ({
        ...msg,
        sender_profile: Array.isArray(msg.sender_profile) 
          ? msg.sender_profile[0] 
          : msg.sender_profile
      }))

      setMessages(messagesWithProfiles)
    } catch (error) {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecentMessages()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('messages-widget')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_messages',
          filter: `recipient_id=eq.${user?.id}`
        },
        () => {
          fetchRecentMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const unreadCount = messages.filter(msg => !msg.is_read).length

  const getSenderName = (message: Message) => {
    if (message.sender_profile?.first_name && message.sender_profile?.last_name) {
      return `${message.sender_profile.first_name} ${message.sender_profile.last_name}`
    }
    return message.sender_profile?.email?.split('@')[0] || 'Unknown'
  }

  if (loading) {
    return (
      <Card className="shadow-soft border-blue-600 h-[280px]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-soft border-blue-600 h-[280px] flex flex-col">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 rounded-full h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/messages')}
            className="text-xs h-7 px-2"
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pb-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
            <MessageSquare className="h-6 w-6 mb-2 opacity-50" />
            <p className="text-sm">No messages</p>
          </div>
        ) : (
          <div className="space-y-1.5 flex-1 overflow-auto">
            {messages.slice(0, 3).map(message => (
              <div
                key={message.id}
                className={`p-2 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                  !message.is_read ? 'bg-primary/5 border-primary/20' : 'bg-background border-border'
                }`}
                onClick={() => navigate('/messages')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-xs truncate flex-1">
                    {getSenderName(message)}
                  </div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(message.created_at), 'MMM d')}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {message.subject}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <Button 
          className="w-full mt-2 h-8" 
          variant="outline"
          onClick={() => navigate('/messages')}
        >
          <Send className="h-3.5 w-3.5 mr-2" />
          Send Message
        </Button>
      </CardContent>
    </Card>
  )
}