import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Shield, Clock, User, Activity } from 'lucide-react';
import { useEmergencyEvents } from '@/hooks/useEmergencyEvents';
import { formatDistanceToNow } from 'date-fns';

export function EmergencyEventHistory() {
  const { events, loading, error } = useEmergencyEvents();

  if (loading) {
    return (
      <Card className="border-0">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-0">
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load event history: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatThreatType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-[#0A1628]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-normal text-[#161616] flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Emergency Event History
            <Badge variant="outline" className="ml-auto">
              {events.length} Total Events
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg font-medium">
                No emergency events recorded
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                All systems operational - no security incidents detected
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <Card
                  key={event.id}
                  className="border-2 border-[#0A1628] shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Header Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getSeverityColor(event.severity)}>
                            {event.severity.toUpperCase()}
                          </Badge>
                          {event.auto_shutdown && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              AUTO-SHUTDOWN
                            </Badge>
                          )}
                          {event.manual_override && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              <User className="h-3 w-3 mr-1" />
                              MANUAL OVERRIDE
                            </Badge>
                          )}
                        </div>

                        {/* Threat Type */}
                        <div>
                          <h3 className="font-semibold text-base text-foreground">
                            {formatThreatType(event.threat_type)}
                          </h3>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="font-medium">Source:</span>
                            <span>{event.trigger_source}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">Time:</span>
                            <span>
                              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>

                        {/* Event Data */}
                        {event.event_data && typeof event.event_data === 'object' && (
                          <div className="bg-muted/50 rounded p-3 text-xs font-mono">
                            <pre className="whitespace-pre-wrap break-words">
                              {JSON.stringify(event.event_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div>
                        <Badge
                          variant={event.resolved_at ? 'secondary' : 'destructive'}
                          className="whitespace-nowrap"
                        >
                          {event.resolved_at ? 'RESOLVED' : 'ACTIVE'}
                        </Badge>
                      </div>
                    </div>

                    {/* Resolution Info */}
                    {event.resolved_at && (
                      <div className="mt-3 pt-3 border-t border-[#0A1628] text-sm text-muted-foreground">
                        Resolved {formatDistanceToNow(new Date(event.resolved_at), { addSuffix: true })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real-time Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-3">
        <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
        <span className="font-medium">Real-time monitoring active</span>
      </div>
    </div>
  );
}
