import { useState, useEffect, useRef } from 'react';
import { ibmDb } from '@/lib/ibm';
import { useAuth } from '@/components/auth/AuthProvider';

interface DocumentAnalyticsData {
  documentId: string;
  documentName: string;
  viewerType: 'adobe' | 'google' | 'direct';
}

interface PageViewEvent {
  page: number;
  timestamp: number;
}

type JsonPageViewEvent = {
  page: number;
  timestamp: number;
};

export const useDocumentAnalytics = (data: DocumentAnalyticsData | null) => {
  const { user } = useAuth();
  const [analyticsId, setAnalyticsId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  const startTimeRef = useRef<number | null>(null);
  const pagesViewedRef = useRef<PageViewEvent[]>([]);
  const maxPageRef = useRef<number>(1);
  const zoomEventsRef = useRef<number>(0);
  const downloadAttemptedRef = useRef<boolean>(false);
  const printAttemptedRef = useRef<boolean>(false);

  // Start tracking when document opens
  const startTracking = async () => {
    if (!user || !data || isTracking) return;

    try {
      startTimeRef.current = Date.now();
      setIsTracking(true);

      const { data: analyticsRecord, error } = await ibmDb
        .from('document_analytics')
        .insert({
          user_id: user.id,
          document_id: data.documentId,
          document_name: data.documentName,
          viewer_type: data.viewerType,
          view_started_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('Error starting document analytics:', error);
        await logError('analytics_start_failed', error.message);
        return;
      }

      if (analyticsRecord) {
        setAnalyticsId((analyticsRecord as any).id);
      }
    } catch (error) {
      console.error('Error in startTracking:', error);
      await logError('analytics_start_exception', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Stop tracking and save final data
  const stopTracking = async () => {
    if (!isTracking || !analyticsId || !startTimeRef.current) return;

    try {
      const endTime = Date.now();
      const totalViewTime = Math.round((endTime - startTimeRef.current) / 1000);

      await ibmDb
        .from('document_analytics')
        .update({
          view_ended_at: new Date().toISOString(),
          total_view_time_seconds: totalViewTime,
          pages_viewed: pagesViewedRef.current as any,
          max_page_reached: maxPageRef.current,
          zoom_events: zoomEventsRef.current,
          download_attempted: downloadAttemptedRef.current,
          print_attempted: printAttemptedRef.current,
        })
        .eq('id', analyticsId);

      setIsTracking(false);
      setAnalyticsId(null);
      
      // Reset refs
      startTimeRef.current = null;
      pagesViewedRef.current = [];
      maxPageRef.current = 1;
      zoomEventsRef.current = 0;
      downloadAttemptedRef.current = false;
      printAttemptedRef.current = false;
    } catch (error) {
      console.error('Error stopping document analytics:', error);
      await logError('analytics_stop_exception', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Track page view
  const trackPageView = (pageNumber: number) => {
    if (!isTracking) return;

    pagesViewedRef.current.push({
      page: pageNumber,
      timestamp: Date.now(),
    });

    if (pageNumber > maxPageRef.current) {
      maxPageRef.current = pageNumber;
    }
  };

  // Track zoom event
  const trackZoomEvent = () => {
    if (!isTracking) return;
    zoomEventsRef.current += 1;
  };

  // Track download attempt
  const trackDownloadAttempt = () => {
    if (!isTracking) return;
    downloadAttemptedRef.current = true;
  };

  // Track print attempt
  const trackPrintAttempt = () => {
    if (!isTracking) return;
    printAttemptedRef.current = true;
  };

  // Log errors
  const logError = async (errorType: string, errorMessage: string, errorStack?: string) => {
    if (!user) return;

    try {
      await ibmDb
        .from('document_error_logs')
        .insert({
          user_id: user.id,
          document_id: data?.documentId || null,
          document_name: data?.documentName || null,
          error_type: errorType,
          error_message: errorMessage,
          error_stack: errorStack,
          viewer_type: data?.viewerType || null,
          browser_info: {
            userAgent: navigator.userAgent,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
            timestamp: new Date().toISOString(),
          },
        });
    } catch (error) {
      console.error('Error logging document error:', error);
    }
  };

  // Update analytics periodically while viewing
  useEffect(() => {
    if (!isTracking || !analyticsId) return;

    const interval = setInterval(async () => {
      if (startTimeRef.current) {
        const currentViewTime = Math.round((Date.now() - startTimeRef.current) / 1000);
        
        try {
          await ibmDb
            .from('document_analytics')
            .update({
              total_view_time_seconds: currentViewTime,
              pages_viewed: pagesViewedRef.current as any,
              max_page_reached: maxPageRef.current,
              zoom_events: zoomEventsRef.current,
              download_attempted: downloadAttemptedRef.current,
              print_attempted: printAttemptedRef.current,
            })
            .eq('id', analyticsId);
        } catch (error) {
          console.error('Error updating analytics:', error);
        }
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [isTracking, analyticsId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, []);

  return {
    startTracking,
    stopTracking,
    trackPageView,
    trackZoomEvent,
    trackDownloadAttempt,
    trackPrintAttempt,
    logError,
    isTracking,
  };
};