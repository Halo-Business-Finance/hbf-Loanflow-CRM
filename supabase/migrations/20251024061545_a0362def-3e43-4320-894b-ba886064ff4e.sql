-- Create user_messages table for internal communication
CREATE TABLE IF NOT EXISTS public.user_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  parent_message_id UUID REFERENCES public.user_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages they sent or received
CREATE POLICY "Users can view their messages"
ON public.user_messages
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can send messages
CREATE POLICY "Users can send messages"
ON public.user_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Users can mark their received messages as read
CREATE POLICY "Users can update received messages"
ON public.user_messages
FOR UPDATE
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
ON public.user_messages
FOR SELECT
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Admins can delete messages
CREATE POLICY "Admins can delete messages"
ON public.user_messages
FOR DELETE
USING (has_role('admin'::user_role) OR has_role('super_admin'::user_role));

-- Create index for performance
CREATE INDEX idx_user_messages_recipient ON public.user_messages(recipient_id, created_at DESC);
CREATE INDEX idx_user_messages_sender ON public.user_messages(sender_id, created_at DESC);
CREATE INDEX idx_user_messages_unread ON public.user_messages(recipient_id, is_read) WHERE is_read = false;

-- Create trigger for updated_at
CREATE TRIGGER update_user_messages_updated_at
BEFORE UPDATE ON public.user_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_messages;