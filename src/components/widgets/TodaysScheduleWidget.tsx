import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, CalendarPlus } from 'lucide-react';
import { useCalendarData } from '@/hooks/useCalendarData';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export function TodaysScheduleWidget() {
  const navigate = useNavigate();
  const [currentDate] = useState(new Date());
  const { events, loading, getEventsForDate } = useCalendarData(currentDate);
  const todaysEvents = getEventsForDate(currentDate);

  const formatEventTime = (date: Date) => {
    try {
      return format(date, 'h:mm a');
    } catch {
      return '';
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-blue-500';
      case 'deadline':
        return 'bg-red-500';
      case 'followup':
        return 'bg-orange-500';
      case 'call':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="bg-card border border-border h-[280px] flex flex-col">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-normal text-foreground">
              Today's Schedule
            </CardTitle>
          </div>
          <Button 
            variant="link" 
            size="sm"
            onClick={() => navigate('/activities/calendar')}
            className="text-xs text-primary h-7 px-2"
          >
            View All
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pb-3">
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-sm text-muted-foreground">Loading events...</p>
          </div>
        ) : todaysEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">No events scheduled for today</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => navigate('/activities/calendar')}
              className="text-primary h-7"
            >
              <CalendarPlus className="h-3.5 w-3.5 mr-1" />
              Schedule an event
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {todaysEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="p-2 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (event.relatedId) {
                      navigate(`/leads/${event.relatedId}`);
                    }
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${getEventTypeColor(event.type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs text-foreground truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          <Clock className="h-2.5 w-2.5 mr-0.5" />
                          {formatEventTime(event.startTime)}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 capitalize">
                          {event.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
