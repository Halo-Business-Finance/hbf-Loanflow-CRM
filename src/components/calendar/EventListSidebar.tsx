import { CalendarEvent } from '@/hooks/useCalendarData';
import { Clock, Users, MapPin, Phone, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface EventListSidebarProps {
  events: CalendarEvent[];
  selectedDate: Date;
}

export function EventListSidebar({ events, selectedDate }: EventListSidebarProps) {
  const navigate = useNavigate();

  const getEventIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return <Users className="h-5 w-5 text-primary" />;
      case 'call':
        return <Phone className="h-5 w-5 text-primary" />;
      case 'task':
        return <CheckCircle className="h-5 w-5 text-primary" />;
      case 'deadline':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'followup':
        return <Mail className="h-5 w-5 text-primary" />;
      default:
        return <Clock className="h-5 w-5 text-primary" />;
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.relatedId && event.relatedType === 'lead') {
      navigate(`/leads/${event.relatedId}`);
    } else if (event.relatedId && event.relatedType === 'client') {
      navigate(`/clients/${event.relatedId}`);
    }
  };

  const sortedEvents = [...events].sort((a, b) => 
    a.startTime.getTime() - b.startTime.getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {format(selectedDate, 'MMMM d, yyyy')}
        </h3>
        
        {sortedEvents.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No events scheduled</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEvents.map((event) => (
              <div
                key={event.id}
                className={`flex items-start space-x-3 p-3 border rounded-lg transition-colors ${
                  event.relatedId ? 'cursor-pointer hover:bg-accent' : ''
                }`}
                onClick={() => handleEventClick(event)}
              >
                {getEventIcon(event.type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(event.startTime, 'h:mm a')}
                  </p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
