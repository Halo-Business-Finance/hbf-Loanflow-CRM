import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('enhanced-geo-security')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OFAC Sanctioned Countries and High-Risk Nations
// Reference: https://ofac.treasury.gov/sanctions-programs-and-country-information
const BLOCKED_COUNTRIES = [
  'KP', // North Korea
  'IR', // Iran  
  'CU', // Cuba
  'SY', // Syria
  'RU', // Russia (restricted)
  'BY', // Belarus
  'VE', // Venezuela (restricted)
  'MM', // Myanmar/Burma
];

// Countries allowed for government/military applications
// Adjust based on your compliance requirements
const ALLOWED_COUNTRIES = [
  'US', // United States
  'CA', // Canada (Five Eyes)
  'GB', // United Kingdom (Five Eyes)
  'AU', // Australia (Five Eyes)
  'NZ', // New Zealand (Five Eyes)
  // Add more NATO/allied countries as needed
];

// Enable strict mode to ONLY allow listed countries (for high-security deployments)
const STRICT_MODE = Deno.env.get('GEO_STRICT_MODE') === 'true';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get client IP from headers
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                    req.headers.get('x-real-ip') || 
                    req.headers.get('cf-connecting-ip') || // Cloudflare
                    '127.0.0.1'

    const userAgent = req.headers.get('user-agent') || ''
    const cfCountry = req.headers.get('cf-ipcountry') || null; // Cloudflare provides this
    
    logger.info('Enhanced geo-security check initiated', { hasCloudflareCountry: !!cfCountry })

    // Enhanced IP validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const isValidIPv4 = ipv4Regex.test(clientIP)
    const isLocalhost = clientIP === '127.0.0.1' || clientIP === '::1'
    
    if (!isValidIPv4 && !isLocalhost) {
      logger.warn('Invalid IP format detected')
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: 'Invalid IP format detected',
          risk_factors: ['invalid_ip_format'],
          security_level: 'high'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for private/local IPs (enhanced detection)
    const privateIPRanges = [
      /^10\./,           // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
      /^192\.168\./,     // 192.168.0.0/16
      /^127\./,          // 127.0.0.0/8 (localhost)
      /^169\.254\./,     // 169.254.0.0/16 (link-local)
      /^0\./,            // 0.0.0.0/8 (invalid)
      /^224\./,          // 224.0.0.0/8 (multicast)
    ]

    const isPrivateIP = privateIPRanges.some(range => range.test(clientIP))
    
    // Risk assessment
    let riskScore = 0
    const riskFactors: string[] = []
    let detectedCountry = cfCountry || 'UNKNOWN'

    // Check country restrictions
    if (cfCountry) {
      // Check if country is blocked (OFAC sanctions)
      if (BLOCKED_COUNTRIES.includes(cfCountry)) {
        riskScore += 100 // Immediate block
        riskFactors.push('sanctioned_country')
        logger.warn('Access from sanctioned country blocked', { country: cfCountry })
      }
      
      // In strict mode, check if country is allowed
      if (STRICT_MODE && !ALLOWED_COUNTRIES.includes(cfCountry) && !BLOCKED_COUNTRIES.includes(cfCountry)) {
        riskScore += 70
        riskFactors.push('country_not_in_allowlist')
        logger.info('Access from non-allowed country', { country: cfCountry })
      }
    } else {
      // No country information - could be suspicious
      riskScore += 20
      riskFactors.push('unknown_country')
    }

    if (isPrivateIP) {
      // Private IPs are generally trusted (internal access)
      riskScore = Math.max(0, riskScore - 20)
      detectedCountry = 'LOCAL'
    }

    // Check for VPN/Proxy indicators in User Agent
    const vpnIndicators = [
      /vpn/i,
      /proxy/i,
      /tunnel/i,
      /tor\s/i,
      /anonymous/i,
      /hide\s*my/i,
    ]

    if (vpnIndicators.some(indicator => indicator.test(userAgent))) {
      riskScore += 40
      riskFactors.push('vpn_proxy_indicators')
    }

    // Check for known VPN/Proxy IP ranges (basic heuristics)
    // Note: For production, consider using a commercial IP intelligence service
    const suspiciousASNPatterns = [
      /^104\.28\./,  // Cloudflare (could be CDN or proxy)
      /^172\.64\./,  // Cloudflare
    ]
    
    // Check for headless browsers or automation tools
    const automationIndicators = [
      /headless/i,
      /phantom/i,
      /selenium/i,
      /chromedriver/i,
      /puppeteer/i,
      /playwright/i,
      /webdriver/i,
      /bot\b/i,
      /crawler/i,
      /spider/i,
    ]

    if (automationIndicators.some(indicator => indicator.test(userAgent))) {
      riskScore += 50
      riskFactors.push('automation_detected')
    }

    // Check for missing or suspicious User-Agent
    if (!userAgent || userAgent.length < 10) {
      riskScore += 30
      riskFactors.push('suspicious_user_agent')
    }

    // Check IP reputation in database
    const { data: ipRestriction } = await supabase
      .from('ip_restrictions')
      .select('is_allowed, risk_level, last_seen, country_code')
      .eq('ip_address', clientIP)
      .single()

    if (ipRestriction) {
      if (!ipRestriction.is_allowed) {
        riskScore += 80
        riskFactors.push('blocked_ip')
      }
      
      // Use stored country if available
      if (ipRestriction.country_code && !cfCountry) {
        detectedCountry = ipRestriction.country_code
      }
      
      // Update last seen
      await supabase
        .from('ip_restrictions')
        .update({ last_seen: new Date().toISOString() })
        .eq('ip_address', clientIP)
    } else if (!isPrivateIP) {
      // Log new IP for future reference
      await supabase
        .from('ip_restrictions')
        .upsert({
          ip_address: clientIP,
          is_allowed: riskScore < 50,
          risk_level: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
          country_code: detectedCountry !== 'UNKNOWN' ? detectedCountry : null,
          notes: `First seen. Risk score: ${riskScore}. Factors: ${riskFactors.join(', ') || 'none'}`
        })
    }

    // Determine security level
    let securityLevel = 'low'
    if (riskScore >= 80) securityLevel = 'critical'
    else if (riskScore >= 60) securityLevel = 'high'
    else if (riskScore >= 30) securityLevel = 'medium'

    // Determine if access should be allowed
    const allowed = riskScore < 80

    // Log security event for high-risk access
    if (riskScore >= 40) {
      await supabase
        .from('security_events')
        .insert({
          event_type: riskScore >= 80 ? 'geo_access_blocked' : 'high_risk_geo_access',
          severity: securityLevel,
          details: {
            risk_score: riskScore,
            risk_factors: riskFactors,
            country: detectedCountry,
            strict_mode: STRICT_MODE,
          },
          ip_address: clientIP,
          user_agent: userAgent.substring(0, 500)
        })
    }

    const response = {
      allowed,
      risk_score: riskScore,
      risk_factors: riskFactors,
      security_level: securityLevel,
      reason: allowed ? 'Access granted' : 'Access denied due to geographic or security restrictions',
      country_code: detectedCountry,
      strict_mode: STRICT_MODE,
      blocked_countries: BLOCKED_COUNTRIES,
      allowed_countries: STRICT_MODE ? ALLOWED_COUNTRIES : null,
    }

    logger.info('Geo-security check complete', { 
      allowed, 
      riskScore, 
      country: detectedCountry 
    })

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    logger.error('Enhanced geo-security error', error instanceof Error ? error : new Error(String(error)))
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: 'Security validation failed',
        risk_factors: ['validation_error'],
        security_level: 'high'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
