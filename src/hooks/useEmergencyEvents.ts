import { useState, useEffect } from 'react';
import { ibmDb } from '@/lib/ibm';

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
    console.log('[useEmergencyEvents] Initializing emergency events polling');
    
    const fetchEvents = async () => {
      try {
        const { data, error } = await ibmDb
          .from('emergency_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('[useEmergencyEvents] Error fetching events:', error);
          setError(error.message);
          return;
        }

        setEvents((data || []) as unknown as EmergencyEvent[]);
      } catch (err) {
        console.error('[useEmergencyEvents] Exception:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();

    // Poll every 15 seconds instead of realtime subscription
    const interval = setInterval(fetchEvents, 15000);

    return () => {
      console.log('[useEmergencyEvents] Cleaning up polling');
      clearInterval(interval);
    };
  }, []);

  return { events, loading, error };
}
