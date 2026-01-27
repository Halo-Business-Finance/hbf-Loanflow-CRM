import { useState } from "react";
import { StandardPageLayout } from "@/components/StandardPageLayout";

import { StandardContentCard } from "@/components/StandardContentCard";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useCalendarData } from "@/hooks/useCalendarData";
import { EventListSidebar } from "@/components/calendar/EventListSidebar";
import { ScheduleMeetingModal } from "@/components/calendar/ScheduleMeetingModal";
import { addMonths, subMonths, format, isToday, isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { IBMPageHeader } from "@/components/ui/IBMPageHeader";

export default function ActivitiesCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  const { events, loading, getEventsForDate, getDatesWithEvents, refetch } = useCalendarData(currentMonth);
  
  const datesWithEvents = getDatesWithEvents();
  const selectedDateEvents = getEventsForDate(selectedDate);
  const todayEvents = getEventsForDate(new Date());

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'call':
        return 'bg-primary'
      case 'meeting':
      case 'team_meeting':
        return 'bg-secondary'
      case 'followup':
      case 'follow_up':
        return 'bg-accent'
      case 'deadline':
        return 'bg-destructive'
      case 'task':
        return 'bg-primary/70'
      default:
        return 'bg-muted-foreground'
    }
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const getEventCountForDate = (date: Date) => {
    return getEventsForDate(date).length;
  };

  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Calendar"
        subtitle="Manage your appointments, meetings, and important deadlines"
        actions={
          <Button onClick={() => refetch()} size="sm" className="h-8 text-xs font-medium bg-[#0f62fe] hover:bg-[#0353e9] text-white">
            <RefreshCw className="h-3 w-3 mr-2" />
            Refresh Data
          </Button>
        }
      />
      
      <ResponsiveContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StandardContentCard>
              <div className="space-y-4">
                <div className="flex items-center justify-end">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      onClick={handlePreviousMonth}
                      className="bg-[#0f62fe] hover:bg-[#0353e9] text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCurrentMonth(new Date());
                        setSelectedDate(new Date());
                      }}
                      className="bg-[#0f62fe] hover:bg-[#0353e9] text-white"
                    >
                      Today
                    </Button>
                    <Button
                      size="icon"
                      onClick={handleNextMonth}
                      className="bg-[#0f62fe] hover:bg-[#0353e9] text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2 animate-pulse" />
                      <p className="text-sm text-muted-foreground">Loading calendar...</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      month={currentMonth}
                      onMonthChange={setCurrentMonth}
                      modifiers={{
                        hasEvents: datesWithEvents,
                      }}
                      modifiersClassNames={{
                        hasEvents: "relative",
                      }}
                      className="rounded-md w-full [&_.rdp-caption]:hidden"
                      classNames={{
                        months: "w-full",
                        month: "w-full",
                        table: "w-full border-collapse",
                        head_row: "flex w-full",
                        head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] text-center",
                        row: "flex w-full mt-2",
                        cell: "p-0 relative flex-1 text-center text-sm focus-within:relative focus-within:z-20 h-16",
                        day: "w-full h-16 p-0 font-normal aria-selected:opacity-100",
                      }}
                      components={{
                        Day: ({ date: dayDate, ...props }) => {
                          const dayEvents = getEventsForDate(dayDate)
                          const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(dayDate, 'yyyy-MM-dd')
                          
                          return (
                            <div className="relative w-full h-full">
                              <button
                                {...props}
                                className={cn(
                                  "relative w-full h-16 p-0 font-normal hover:bg-accent hover:text-accent-foreground rounded-md flex flex-col items-center justify-center gap-1",
                                  isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                                )}
                              >
                                <span className="text-sm">{dayDate.getDate()}</span>
                                {dayEvents.length > 0 && (
                                  <div className="flex gap-1 justify-center">
                                    {dayEvents.slice(0, 3).map((event, idx) => (
                                      <span
                                        key={idx}
                                        className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          getEventTypeColor(event.type)
                                        )}
                                      />
                                    ))}
                                    {dayEvents.length > 3 && (
                                      <span className="text-[9px] leading-none ml-0.5 font-semibold">+{dayEvents.length - 3}</span>
                                    )}
                                  </div>
                                )}
                              </button>
                            </div>
                          )
                        },
                      }}
                    />
                    
                    {/* Event count indicators */}
                    <div className="absolute inset-0 pointer-events-none">
                      {datesWithEvents.map((date) => {
                        const count = getEventCountForDate(date);
                        if (count > 1) {
                          return (
                            <div
                              key={date.toISOString()}
                              className="absolute text-xs font-medium text-primary"
                              style={{
                                // Position would need calculation based on calendar grid
                                display: 'none' // Simplified for now
                              }}
                            >
                              {count}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground border-t flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span>Call</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    <span>Meeting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span>Follow-up</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <span>Deadline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary/70" />
                    <span>Task</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Badge variant="secondary">{events.length}</Badge>
                    <span>Total Events</span>
                  </div>
                </div>
              </div>
            </StandardContentCard>
          </div>

          <div className="space-y-6">
            <StandardContentCard 
              title={isToday(selectedDate) ? "Today's Schedule" : "Selected Day"}
            >
              <EventListSidebar 
                events={selectedDateEvents}
                selectedDate={selectedDate}
              />
            </StandardContentCard>

            <StandardContentCard title="Quick Actions">
              <div className="space-y-2">
                <Button 
                  className="w-full bg-[#0f62fe] hover:bg-[#0353e9] text-white" 
                  onClick={() => setShowScheduleModal(true)}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  New Event
                </Button>
                <Button 
                  className="w-full bg-[#0f62fe] hover:bg-[#0353e9] text-white" 
                  onClick={() => {
                    setShowScheduleModal(true);
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Block Time
                </Button>
                <Button 
                  className="w-full bg-[#0f62fe] hover:bg-[#0353e9] text-white" 
                  onClick={() => {
                    setShowScheduleModal(true);
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Team Meeting
                </Button>
              </div>
            </StandardContentCard>
          </div>
        </div>
      </ResponsiveContainer>

      <ScheduleMeetingModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        selectedDate={selectedDate}
        onSuccess={refetch}
      />
    </StandardPageLayout>
  );
}