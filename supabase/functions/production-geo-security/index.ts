import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('production-geo-security')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Environment detection
const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development' || 
                    Deno.env.get('SUPABASE_URL')?.includes('localhost')

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

    // Get client IP address - handle forwarded IPs properly
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    
    // Parse the first IP from forwarded chain
    let clientIP = 'unknown';
    if (forwardedFor) {
      clientIP = forwardedFor.split(',')[0].trim();
    } else if (realIP) {
      clientIP = realIP.trim();
    }

    // Enhanced suspicious indicators
    const suspiciousHeaders = [
      'tor-exit-node',
      'x-tor',
      'x-forwarded-for', // Multiple forwarded IPs can indicate proxy chains
      'x-proxy-id',
      'x-anonymizer'
    ];

    const userAgent = req.headers.get('user-agent') || '';
    
    // Enhanced bot/proxy detection
    const isSuspicious = suspiciousHeaders.some(header => req.headers.has(header)) ||
                        userAgent.toLowerCase().includes('tor browser') ||
                        userAgent.toLowerCase().includes('phantom') ||
                        userAgent.toLowerCase().includes('headless') ||
                        userAgent.toLowerCase().includes('selenium') ||
                        userAgent.toLowerCase().includes('bot') ||
                        userAgent.toLowerCase().includes('crawler') ||
                        // Check for unusual user agent patterns
                        userAgent.length < 20 || // Suspiciously short UA
                        !userAgent.includes('Mozilla'); // Most legitimate browsers include Mozilla

    // VPN/Proxy detection via multiple forwarded headers
    const forwardedHeaderCount = [
      'x-forwarded-for',
      'x-real-ip',
      'x-forwarded-proto',
      'x-forwarded-host'
    ].filter(header => req.headers.has(header)).length;
    
    const hasMultipleProxies = forwardedHeaderCount > 2;

    // Check IP geolocation using a free service
    let countryCode = 'UNKNOWN';
    let isAllowed = false; // Default to blocked for security
    let blockReason = 'Unknown location';
    
    try {
      // Development environment handling - more permissive
      if (isDevelopment && (
        clientIP === 'unknown' || 
        clientIP.startsWith('127.') || 
        clientIP.startsWith('192.168.') || 
        clientIP.startsWith('10.') ||
        clientIP.startsWith('172.')
      )) {
        countryCode = 'US';
        isAllowed = true;
        blockReason = 'Development environment - local IP';
      } else {
        // Production geo-location check
        const geoResponse = await fetch(`https://ipapi.co/${clientIP}/json/`);
        const geoData = await geoResponse.json();
        countryCode = geoData.country_code || 'UNKNOWN';
        
        // Enhanced security checks for production
        if (countryCode === 'US') {
          // Even US IPs are blocked if suspicious
          if (isSuspicious) {
            isAllowed = false;
            blockReason = 'Suspicious traffic patterns detected';
          } else if (hasMultipleProxies && !isDevelopment) {
            isAllowed = false;
            blockReason = 'Multiple proxy layers detected';
          } else {
            isAllowed = true;
            blockReason = 'Allowed US location';
          }
        } else {
          isAllowed = false;
          blockReason = 'Non-US location detected';
        }
      }
      
    } catch (geoError) {
      // Default to blocked on errors for security
      isAllowed = false;
      countryCode = 'UNKNOWN';
      blockReason = 'Geolocation verification failed';
    }

    // Enhanced logging with security details
    try {
      await supabase
        .from('ip_restrictions')
        .upsert({
          ip_address: clientIP,
          country_code: countryCode,
          is_allowed: isAllowed,
          reason: blockReason,
          // Store additional security metadata
          metadata: {
            user_agent: userAgent,
            forwarded_headers: forwardedHeaderCount,
            suspicious_indicators: isSuspicious,
            environment: isDevelopment ? 'development' : 'production',
            timestamp: new Date().toISOString()
          }
        });
    } catch (logError) {
      logger.error('Failed to log IP restriction', logError);
    }

    // Enhanced security event logging for blocked requests
    if (!isAllowed) {
      try {
        await supabase.rpc('log_enhanced_security_event', {
          p_event_type: 'geo_restriction_blocked',
          p_severity: isSuspicious ? 'critical' : 'high',
          p_details: {
            ip_address: clientIP,
            country_code: countryCode,
            user_agent: userAgent,
            block_reason: blockReason,
            suspicious_indicators: {
              suspicious_headers: suspiciousHeaders.filter(h => req.headers.has(h)),
              suspicious_user_agent: isSuspicious,
              multiple_proxies: hasMultipleProxies,
              forwarded_header_count: forwardedHeaderCount
            },
            environment: isDevelopment ? 'development' : 'production'
          },
          p_ip_address: clientIP,
          p_user_agent: userAgent
        });
      } catch (eventError) {
        logger.error('Failed to log security event', eventError);
      }
    }

    return new Response(
      JSON.stringify({
        allowed: isAllowed,
        country: countryCode,
        ip: clientIP,
        reason: blockReason,
        security_level: isSuspicious ? 'high_risk' : 'normal',
        environment: isDevelopment ? 'development' : 'production'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: isAllowed ? 200 : 403
      }
    );

  } catch (error) {
    logger.error('Production geo-security check error', error);
    return new Response(
      JSON.stringify({ 
        error: 'Security check failed',
        allowed: false,
        reason: 'System security error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
})