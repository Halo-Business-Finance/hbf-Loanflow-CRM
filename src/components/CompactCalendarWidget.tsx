import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { useCalendarData } from "@/hooks/useCalendarData"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export function CompactCalendarWidget() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { getEventsForDate, getDatesWithEvents, loading } = useCalendarData(currentMonth)

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'call':
        return 'bg-blue-500'
      case 'meeting':
      case 'team_meeting':
        return 'bg-purple-500'
      case 'followup':
      case 'follow_up':
        return 'bg-green-500'
      case 'deadline':
        return 'bg-red-500'
      case 'task':
        return 'bg-orange-500'
      default:
        return 'bg-muted-foreground'
    }
  }

  const datesWithEvents = getDatesWithEvents()
  const eventsForSelectedDate = date ? getEventsForDate(date) : []

  return (
    <Card className="shadow-soft h-[280px] flex flex-col overflow-hidden bg-card">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </CardTitle>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handlePreviousMonth}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-2 pt-0 flex-1 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-pulse text-sm text-muted-foreground">Loading events...</div>
          </div>
        ) : (
          <>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-md w-full p-0"
              modifiers={{
                hasEvents: datesWithEvents,
              }}
              modifiersClassNames={{
                hasEvents: "relative",
              }}
              classNames={{
                months: "w-full",
                month: "w-full",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "hidden",
                nav_button: "hidden",
                nav_button_previous: "hidden",
                nav_button_next: "hidden",
                table: "w-full border-collapse",
                head_row: "flex w-full",
                head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.7rem] text-center",
                row: "flex w-full mt-1",
                cell: "p-0 relative flex-1 text-center text-xs focus-within:relative focus-within:z-20 h-8",
                day: "w-full h-8 p-0 font-normal aria-selected:opacity-100",
              }}
              components={{
                Day: ({ date: dayDate, ...props }) => {
                  const dayEvents = getEventsForDate(dayDate)
                  const isSelected = date && format(date, 'yyyy-MM-dd') === format(dayDate, 'yyyy-MM-dd')
                  
                  return (
                    <div className="relative w-full h-full">
                      <button
                        {...props}
                        className={cn(
                          "relative w-full h-8 p-0 font-normal hover:bg-accent hover:text-accent-foreground rounded-md flex flex-col items-center justify-center",
                          isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                        )}
                      >
                        <span className="text-xs">{dayDate.getDate()}</span>
                        {dayEvents.length > 0 && (
                          <div className="flex gap-0.5 justify-center absolute bottom-0.5">
                            {dayEvents.slice(0, 2).map((event, idx) => (
                              <span
                                key={idx}
                                className={cn(
                                  "w-1 h-1 rounded-full",
                                  getEventTypeColor(event.type)
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    </div>
                  )
                },
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
