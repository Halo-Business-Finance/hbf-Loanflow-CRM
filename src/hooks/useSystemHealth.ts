import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SystemHealth {
  databaseStatus: 'healthy' | 'degraded' | 'offline';
  activeUsers: number;
  totalSessions: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: number;
  lastChecked: Date;
}

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth>({
    databaseStatus: 'healthy',
    activeUsers: 0,
    totalSessions: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    uptime: 0,
    lastChecked: new Date()
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[useSystemHealth] Initializing system health monitoring');

    const checkSystemHealth = async () => {
      try {
        // Check database connectivity
        const { error: dbError } = await supabase
          .from('profiles')
          .select('count', { count: 'exact', head: true });

        const databaseStatus = dbError ? 'offline' : 'healthy';

        // Get active sessions count
        const { count: sessionsCount } = await supabase
          .from('user_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Get unique active users
        const { data: activeSessions } = await supabase
          .from('user_sessions')
          .select('user_id')
          .eq('is_active', true);

        const uniqueUsers = new Set(activeSessions?.map(s => s.user_id) || []).size;

        // Simulate system metrics (in real app, these would come from backend)
        const cpuUsage = Math.floor(Math.random() * 30) + 20; // 20-50%
        const memoryUsage = Math.floor(Math.random() * 20) + 40; // 40-60%
        const diskUsage = Math.floor(Math.random() * 15) + 25; // 25-40%
        const uptime = Date.now() - (Date.now() - Math.random() * 86400000 * 30); // Random uptime

        setHealth({
          databaseStatus,
          activeUsers: uniqueUsers,
          totalSessions: sessionsCount || 0,
          cpuUsage,
          memoryUsage,
          diskUsage,
          uptime,
          lastChecked: new Date()
        });

        console.log('[useSystemHealth] Health check complete:', {
          databaseStatus,
          activeUsers: uniqueUsers,
          sessions: sessionsCount
        });
      } catch (error) {
        console.error('[useSystemHealth] Error checking system health:', error);
        setHealth(prev => ({
          ...prev,
          databaseStatus: 'degraded',
          lastChecked: new Date()
        }));
      } finally {
        setLoading(false);
      }
    };

    // Initial check
    checkSystemHealth();

    // Check every 10 seconds
    const interval = setInterval(checkSystemHealth, 10000);

    return () => {
      console.log('[useSystemHealth] Cleaning up');
      clearInterval(interval);
    };
  }, []);

  return { health, loading };
}
