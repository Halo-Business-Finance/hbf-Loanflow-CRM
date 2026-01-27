import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Plus, Phone, Video, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, isPast, isToday } from 'date-fns';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { cn } from '@/lib/utils';

interface ScheduledEvent {
  id: string;
  title: string;
  message: string | null;
  type: string;
  scheduled_for: string;
}

interface ClientSchedulerProps {
  clientId: string;
  clientName: string;
  clientType: 'client' | 'lead';
  compact?: boolean;
}

export function ClientScheduler({ clientId, clientName, clientType, compact = false }: ClientSchedulerProps) {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchClientEvents();
  }, [clientId]);

  const fetchClientEvents = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, type, scheduled_for')
        .eq('related_id', clientId)
        .not('scheduled_for', 'is', null)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching client events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'meeting':
        return <Video className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventBadgeVariant = (type: string) => {
    switch (type) {
      case 'call':
        return 'default';
      case 'meeting':
        return 'secondary';
      case 'follow_up':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const upcomingEvents = events.filter(e => !isPast(new Date(e.scheduled_for)));
  const pastEvents = events.filter(e => isPast(new Date(e.scheduled_for)));

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Events
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground">No upcoming events</div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="flex items-center gap-2 text-sm">
                  {getEventIcon(event.type)}
                  <span className="truncate flex-1">{event.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(event.scheduled_for), 'MMM d')}
                  </span>
                </div>
              ))}
              {upcomingEvents.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{upcomingEvents.length - 3} more
                </div>
              )}
            </div>
          )}
        </CardContent>
        <ScheduleMeetingModal
          open={showModal}
          onOpenChange={setShowModal}
          onSuccess={fetchClientEvents}
          preselectedClient={{ id: clientId, name: clientName, type: clientType }}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule with {clientName}
          </CardTitle>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Event
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upcoming Events */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Upcoming ({upcomingEvents.length})
              </h4>
              {upcomingEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 border rounded-lg border-dashed text-center">
                  No upcoming events scheduled. Click "Schedule Event" to add one.
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => {
                    const eventDate = new Date(event.scheduled_for);
                    const isEventToday = isToday(eventDate);
                    
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                          isEventToday && "bg-primary/5 border-primary/20"
                        )}
                      >
                        <div className="p-2 rounded-full bg-muted">
                          {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{event.title}</span>
                            <Badge variant={getEventBadgeVariant(event.type)} className="text-xs">
                              {event.type}
                            </Badge>
                            {isEventToday && (
                              <Badge variant="default" className="text-xs bg-primary">
                                Today
                              </Badge>
                            )}
                          </div>
                          {event.message && (
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {event.message}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(eventDate, 'EEE, MMM d, yyyy')}
                            <Clock className="h-3 w-3 ml-2" />
                            {format(eventDate, 'h:mm a')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past Events */}
            {pastEvents.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                  Past Events ({pastEvents.length})
                </h4>
                <div className="space-y-2 opacity-60">
                  {pastEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-dashed"
                    >
                      {getEventIcon(event.type)}
                      <span className="text-sm truncate flex-1">{event.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.scheduled_for), 'MMM d, yyyy')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Schedule Buttons */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Quick Schedule</h4>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2"
                >
                  <Phone className="h-4 w-4" />
                  Call
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2"
                >
                  <Video className="h-4 w-4" />
                  Meeting
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Follow-up
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <ScheduleMeetingModal
        open={showModal}
        onOpenChange={setShowModal}
        onSuccess={fetchClientEvents}
        preselectedClient={{ id: clientId, name: clientName, type: clientType }}
      />
    </Card>
  );
}
