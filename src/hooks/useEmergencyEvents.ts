import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EmergencyEvent {
  id: string;
  threat_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  trigger_source: string;
  auto_shutdown: boolean;
  manual_override: boolean;
  event_data: any;
  created_at: string;
  resolved_at: string | null;
}

export function useEmergencyEvents() {
  const [events, setEvents] = useState<EmergencyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[useEmergencyEvents] Initializing emergency events subscription');
    
    // Initial fetch
    const fetchEvents = async () => {
      try {
        console.log('[useEmergencyEvents] Fetching initial events');
        const { data, error } = await supabase
          .from('emergency_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('[useEmergencyEvents] Error fetching events:', error);
          setError(error.message);
          return;
        }

        console.log('[useEmergencyEvents] Fetched events:', data?.length);
        setEvents((data || []) as EmergencyEvent[]);
      } catch (err) {
        console.error('[useEmergencyEvents] Exception:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();

    // Set up real-time subscription
    console.log('[useEmergencyEvents] Setting up realtime subscription');
    const channel = supabase
      .channel('emergency-events-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emergency_events'
        },
        (payload) => {
          console.log('[useEmergencyEvents] New event received:', payload);
          setEvents((current) => [payload.new as EmergencyEvent, ...current]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'emergency_events'
        },
        (payload) => {
          console.log('[useEmergencyEvents] Event updated:', payload);
          setEvents((current) =>
            current.map((event) =>
              event.id === payload.new.id ? (payload.new as EmergencyEvent) : event
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'emergency_events'
        },
        (payload) => {
          console.log('[useEmergencyEvents] Event deleted:', payload);
          setEvents((current) =>
            current.filter((event) => event.id !== payload.old.id)
          );
        }
      )
      .subscribe((status) => {
        console.log('[useEmergencyEvents] Subscription status:', status);
      });

    return () => {
      console.log('[useEmergencyEvents] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  return { events, loading, error };
}
