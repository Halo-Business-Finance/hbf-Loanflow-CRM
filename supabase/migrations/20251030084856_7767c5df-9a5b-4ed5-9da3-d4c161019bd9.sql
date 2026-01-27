-- Enable real-time for notifications table
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add notifications to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;