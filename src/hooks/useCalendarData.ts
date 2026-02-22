import { useState, useEffect } from 'react';
import { ibmDb } from '@/lib/ibm';
const supabase = ibmDb; // IBM migration shim
import { getAuthUser } from '@/lib/auth-utils';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  type: 'meeting' | 'call' | 'task' | 'deadline' | 'reminder' | 'followup';
  relatedId?: string;
  relatedType?: 'lead' | 'contact' | 'client';
  source: 'notification';
}

export function useCalendarData(currentMonth: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const user = await getAuthUser();
      if (!user) return;

      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);

      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .not('scheduled_for', 'is', null)
        .gte('scheduled_for', startDate.toISOString())
        .lte('scheduled_for', endDate.toISOString())
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      const calendarEvents: CalendarEvent[] = (notifications || []).map(notif => ({
        id: notif.id,
        title: notif.title,
        description: notif.message,
        startTime: new Date(notif.scheduled_for!),
        type: mapNotificationTypeToEventType(notif.type),
        relatedId: notif.related_id,
        relatedType: notif.related_type as 'lead' | 'contact' | 'client' | undefined,
        source: 'notification' as const,
      }));

      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentMonth]);

  // Real-time subscription for notifications
  useRealtimeSubscription({
    table: 'notifications',
    event: '*',
    onChange: () => {
      fetchEvents();
    },
  });

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.filter(event => 
      format(event.startTime, 'yyyy-MM-dd') === dateStr
    );
  };

  const getDatesWithEvents = (): Date[] => {
    const uniqueDates = new Set(
      events.map(event => format(event.startTime, 'yyyy-MM-dd'))
    );
    return Array.from(uniqueDates).map(dateStr => new Date(dateStr));
  };

  return {
    events,
    loading,
    getEventsForDate,
    getDatesWithEvents,
    refetch: fetchEvents,
  };
}

function mapNotificationTypeToEventType(type: string): CalendarEvent['type'] {
  switch (type) {
    case 'meeting':
    case 'team_meeting':
      return 'meeting';
    case 'call':
      return 'call';
    case 'task':
      return 'task';
    case 'deadline':
      return 'deadline';
    case 'follow_up':
    case 'follow_up_reminder':
      return 'followup';
    case 'message':
      return 'reminder'; // Messages show as reminders in calendar
    default:
      return 'reminder';
  }
}
