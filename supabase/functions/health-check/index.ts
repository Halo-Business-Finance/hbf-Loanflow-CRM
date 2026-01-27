import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      responseTime: number;
      message?: string;
    };
    authentication: {
      status: 'ok' | 'error';
      message?: string;
    };
    sessions: {
      status: 'ok' | 'warning';
      activeSessions: number;
      message?: string;
    };
    storage: {
      status: 'ok' | 'error';
      message?: string;
    };
  };
  uptime: {
    seconds: number;
    formatted: string;
  };
  version: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const startTime = Date.now();
    const checks: HealthCheckResult['checks'] = {
      database: { status: 'ok', responseTime: 0 },
      authentication: { status: 'ok' },
      sessions: { status: 'ok', activeSessions: 0 },
      storage: { status: 'ok' },
    };

    // Check 1: Database connectivity
    try {
      const dbStart = Date.now();
      const { data, error } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true });
      
      checks.database.responseTime = Date.now() - dbStart;
      
      if (error) {
        checks.database.status = 'error';
        checks.database.message = error.message;
      }
    } catch (error) {
      checks.database.status = 'error';
      checks.database.message = error instanceof Error ? error.message : 'Database check failed';
    }

    // Check 2: Authentication system
    try {
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) {
        checks.authentication.status = 'error';
        checks.authentication.message = error.message;
      }
    } catch (error) {
      checks.authentication.status = 'error';
      checks.authentication.message = error instanceof Error ? error.message : 'Auth check failed';
    }

    // Check 3: Active sessions
    try {
      const { count, error } = await supabase
        .from('active_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (error) {
        checks.sessions.status = 'warning';
        checks.sessions.message = error.message;
      } else {
        checks.sessions.activeSessions = count || 0;
        if (count && count > 100) {
          checks.sessions.status = 'warning';
          checks.sessions.message = 'High session count detected';
        }
      }
    } catch (error) {
      checks.sessions.status = 'warning';
      checks.sessions.message = error instanceof Error ? error.message : 'Session check failed';
    }

    // Check 4: Storage bucket access
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) {
        checks.storage.status = 'error';
        checks.storage.message = error.message;
      }
    } catch (error) {
      checks.storage.status = 'error';
      checks.storage.message = error instanceof Error ? error.message : 'Storage check failed';
    }

    // Calculate uptime (since function start)
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const uptimeFormatted = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`;

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (checks.database.status === 'error' || checks.authentication.status === 'error') {
      overallStatus = 'unhealthy';
    } else if (checks.sessions.status === 'warning' || checks.storage.status === 'error') {
      overallStatus = 'degraded';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: {
        seconds: uptimeSeconds,
        formatted: uptimeFormatted,
      },
      version: '1.0.0',
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 503 : 500,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
