import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('geo-security')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Only flag truly suspicious indicators (actual Tor/proxy headers)
    const suspiciousHeaders = ['tor-exit-node', 'x-tor'];
    const userAgent = req.headers.get('user-agent') || '';
    
    // Only flag as suspicious for ACTUAL Tor browser usage, not normal browsers
    const isTorBrowser = userAgent.toLowerCase().includes('tor browser');
    const hasSuspiciousHeaders = suspiciousHeaders.some(header => req.headers.has(header));
    const isSuspicious = isTorBrowser || hasSuspiciousHeaders;

    let countryCode = 'UNKNOWN';
    let isAllowed = true; // Default to ALLOWED - fail open for better UX
    
    logger.info('Geo-security check initiated', { suspicious: isSuspicious })
    
    try {
      // Allow localhost/private IPs (development)
      if (clientIP === 'unknown' || clientIP.startsWith('127.') || 
          clientIP.startsWith('192.168.') || clientIP.startsWith('10.') ||
          clientIP.startsWith('172.')) {
        logger.info('Local/private IP detected, allowing access')
        countryCode = 'US';
        isAllowed = true;
      } else {
        // Use ipapi.co for geolocation
        const geoResponse = await fetch(`https://ipapi.co/${clientIP}/json/`);
        const geoData = await geoResponse.json();
        countryCode = geoData.country_code || 'UNKNOWN';
        
        logger.info('Geolocation check completed', { country: countryCode })

        // UNKNOWN = geolocation failed, allow access (don't punish users for API failures)
        if (countryCode === 'UNKNOWN') {
          isAllowed = true;
          logger.info('Country unknown, allowing access by default')
        } else if (countryCode === 'US') {
          // US users allowed unless using Tor browser
          isAllowed = !isTorBrowser;
        } else {
          // Non-US users blocked
          isAllowed = false;
        }
        
        logger.info('Access decision made', { 
          country: countryCode, 
          suspicious: isSuspicious, 
          allowed: isAllowed 
        })
      }
      
    } catch (geoError) {
      logger.error('Geolocation check failed', geoError)
      // Default to ALLOWED on errors - don't block users due to geo API issues
      isAllowed = true;
      countryCode = 'UNKNOWN';
    }

    // Log the IP restriction (IP will be redacted by SecureLogger)
    try {
      await supabase
        .from('ip_restrictions')
        .upsert({
          ip_address: clientIP,
          country_code: countryCode,
          is_allowed: isAllowed,
          reason: !isAllowed ? 
            (countryCode !== 'US' ? 'Non-US location' : 'Suspicious traffic detected') : 
            'Allowed US location'
        });
    } catch (logError) {
      logger.error('Failed to log IP restriction', logError)
    }

    // Log security event if blocked
    if (!isAllowed) {
      try {
        await supabase.rpc('log_security_event', {
          p_event_type: 'geo_restriction_blocked',
          p_severity: 'high',
          p_details: {
            country_code: countryCode,
            suspicious_headers: suspiciousHeaders.filter(h => req.headers.has(h)),
            reason: countryCode !== 'US' ? 'Non-US location' : 'Suspicious traffic'
          },
          p_ip_address: clientIP,
          p_user_agent: userAgent
        });
      } catch (eventError) {
        logger.error('Failed to log security event', eventError)
      }
    }

    return new Response(
      JSON.stringify({
        allowed: isAllowed,
        country: countryCode,
        reason: !isAllowed ? 'Access restricted to US locations only' : 'Access allowed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: isAllowed ? 200 : 403
      }
    );

  } catch (error) {
    logger.error('Geo-security check error', error)
    return new Response(
      JSON.stringify({ 
        error: 'Security check failed',
        allowed: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});