import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('security-monitor')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SecurityAlert {
  type: 'geo_blocked' | 'auth_failure' | 'rate_limit' | 'suspicious_activity'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  count: number
  timeframe: string
  details: any
}

interface MonitoringConfig {
  geo_block_threshold: number
  auth_failure_threshold: number
  rate_limit_threshold: number
  timeframe_minutes: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'monitor';
    
    logger.logAction(action);

    // Default monitoring configuration
    const config: MonitoringConfig = {
      geo_block_threshold: 5,
      auth_failure_threshold: 10,
      rate_limit_threshold: 50,
      timeframe_minutes: 15
    };

    const timeWindow = new Date(Date.now() - config.timeframe_minutes * 60 * 1000).toISOString();
    const alerts: SecurityAlert[] = [];

    switch (action) {
      case 'monitor':
        // 1. Check for blocked geo-restriction attempts
        const { data: geoBlocks } = await supabase
          .from('ip_restrictions')
          .select('*')
          .eq('is_allowed', false)
          .gte('created_at', timeWindow);

        if (geoBlocks && geoBlocks.length >= config.geo_block_threshold) {
          alerts.push({
            type: 'geo_blocked',
            severity: 'high',
            title: 'High Number of Geo-Blocked Attempts',
            description: `${geoBlocks.length} blocked geo-restriction attempts in the last ${config.timeframe_minutes} minutes`,
            count: geoBlocks.length,
            timeframe: `${config.timeframe_minutes} minutes`,
            details: {
              unique_ips: [...new Set(geoBlocks.map(b => b.ip_address))].length,
              countries: [...new Set(geoBlocks.map(b => b.country_code))],
              recent_attempts: geoBlocks.slice(-5)
            }
          });
        }

        // 2. Monitor failed authentication patterns
        const { data: failedLogins } = await supabase
          .from('failed_login_attempts')
          .select('*')
          .gte('attempt_time', timeWindow);

        if (failedLogins && failedLogins.length >= config.auth_failure_threshold) {
          const ipGroups = failedLogins.reduce((acc, attempt) => {
            const ip = attempt.ip_address;
            acc[ip] = (acc[ip] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const suspiciousIPs = Object.entries(ipGroups).filter(([ip, count]) => (count as number) >= 5);

          alerts.push({
            type: 'auth_failure',
            severity: suspiciousIPs.length > 0 ? 'critical' : 'medium',
            title: 'High Authentication Failure Rate',
            description: `${failedLogins.length} failed login attempts in the last ${config.timeframe_minutes} minutes`,
            count: failedLogins.length,
            timeframe: `${config.timeframe_minutes} minutes`,
            details: {
              unique_ips: Object.keys(ipGroups).length,
              suspicious_ips: suspiciousIPs,
              unique_emails: [...new Set(failedLogins.map(f => f.email))].length
            }
          });
        }

        // 3. Track API rate limit violations
        const { data: rateLimitViolations } = await supabase
          .from('api_request_analytics')
          .select('*')
          .eq('rate_limit_triggered', true)
          .gte('created_at', timeWindow);

        if (rateLimitViolations && rateLimitViolations.length >= config.rate_limit_threshold) {
          alerts.push({
            type: 'rate_limit',
            severity: 'medium',
            title: 'High Rate Limit Violations',
            description: `${rateLimitViolations.length} rate limit violations in the last ${config.timeframe_minutes} minutes`,
            count: rateLimitViolations.length,
            timeframe: `${config.timeframe_minutes} minutes`,
            details: {
              unique_users: [...new Set(rateLimitViolations.map(v => v.user_id))].length,
              endpoints: [...new Set(rateLimitViolations.map(v => v.endpoint))],
              ai_suspected: rateLimitViolations.filter(v => v.is_bot_suspected).length
            }
          });
        }

        // 4. Review audit logs for suspicious activities
        const { data: suspiciousAudit } = await supabase
          .from('audit_logs')
          .select('*')
          .gte('risk_score', 50)
          .gte('created_at', timeWindow);

        if (suspiciousAudit && suspiciousAudit.length > 0) {
          alerts.push({
            type: 'suspicious_activity',
            severity: suspiciousAudit.some(a => a.risk_score >= 80) ? 'critical' : 'high',
            title: 'Suspicious Activities Detected',
            description: `${suspiciousAudit.length} high-risk activities detected in audit logs`,
            count: suspiciousAudit.length,
            timeframe: `${config.timeframe_minutes} minutes`,
            details: {
              high_risk_count: suspiciousAudit.filter(a => a.risk_score >= 80).length,
              actions: [...new Set(suspiciousAudit.map(a => a.action))],
              users: [...new Set(suspiciousAudit.map(a => a.user_id))].length
            }
          });
        }

        // Store alerts in security_notifications if any alerts were generated
        if (alerts.length > 0) {
          for (const alert of alerts) {
            await supabase
              .from('security_notifications')
              .insert({
                notification_type: alert.type,
                title: alert.title,
                message: alert.description,
                severity: alert.severity,
                metadata: {
                  alert_details: alert.details,
                  count: alert.count,
                  timeframe: alert.timeframe,
                  generated_at: new Date().toISOString()
                }
              });
          }

          logger.info('Generated security alerts', { alertCount: alerts.length });
        }

        return new Response(
          JSON.stringify({
            success: true,
            alerts_generated: alerts.length,
            alerts: alerts,
            monitoring_config: config,
            timestamp: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );

      case 'dashboard':
        // Generate security dashboard data
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const [
          { data: recentGeoBlocks },
          { data: recentFailedLogins },
          { data: recentRateLimit },
          { data: recentSecurityEvents },
          { data: activeAlerts }
        ] = await Promise.all([
          supabase.from('ip_restrictions').select('*').eq('is_allowed', false).gte('created_at', last24Hours),
          supabase.from('failed_login_attempts').select('*').gte('attempt_time', last24Hours),
          supabase.from('api_request_analytics').select('*').eq('rate_limit_triggered', true).gte('created_at', last24Hours),
          supabase.from('security_events').select('*').gte('created_at', last24Hours),
          supabase.from('security_notifications').select('*').gte('created_at', last24Hours).order('created_at', { ascending: false })
        ]);

        const dashboardData = {
          summary: {
            geo_blocks_24h: recentGeoBlocks?.length || 0,
            failed_logins_24h: recentFailedLogins?.length || 0,
            rate_limit_violations_24h: recentRateLimit?.length || 0,
            security_events_24h: recentSecurityEvents?.length || 0,
            active_alerts: activeAlerts?.length || 0
          },
          recent_alerts: activeAlerts?.slice(0, 10) || [],
          top_blocked_countries: getTopCountries(recentGeoBlocks || []),
          top_suspicious_ips: getTopIPs(recentFailedLogins || []),
          timestamp: new Date().toISOString()
        };

        return new Response(
          JSON.stringify(dashboardData),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );

      case 'acknowledge':
        // Acknowledge/dismiss alerts
        const { alert_ids } = await req.json();
        
        if (alert_ids && Array.isArray(alert_ids)) {
          const { error } = await supabase
            .from('security_notifications')
            .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
            .in('id', alert_ids);

          if (error) throw error;

          return new Response(
            JSON.stringify({ success: true, acknowledged: alert_ids.length }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          );
        }

        throw new Error('Invalid alert_ids provided');

      default:
        throw new Error('Invalid action specified');
    }

  } catch (error) {
    logger.error('Security monitor error', error);
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: 'Security monitoring failed', 
        message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

function getTopCountries(geoBlocks: any[]): Array<{country: string, count: number}> {
  const counts = geoBlocks.reduce((acc, block) => {
    const country = block.country_code || 'UNKNOWN';
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(counts)
    .map(([country, count]) => ({ country, count: count as number }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, 5);
}

function getTopIPs(failedLogins: any[]): Array<{ip: string, attempts: number, emails: number}> {
  const ipStats = failedLogins.reduce((acc, login) => {
    const ip = login.ip_address;
    if (!acc[ip]) {
      acc[ip] = { attempts: 0, emails: new Set() };
    }
    acc[ip].attempts++;
    acc[ip].emails.add(login.email);
    return acc;
  }, {} as Record<string, {attempts: number, emails: Set<string>}>);

  return Object.entries(ipStats)
    .map(([ip, stats]) => ({ 
      ip, 
      attempts: (stats as any).attempts, 
      emails: (stats as any).emails.size 
    }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 5);
}