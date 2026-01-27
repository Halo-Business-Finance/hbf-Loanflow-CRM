import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'
import { checkRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts'

const logger = new SecureLogger('session-security')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, session_token, user_id, device_fingerprint } = await req.json()

    // Apply rate limiting for session operations (except cleanup which is internal)
    if (action !== 'cleanup_sessions' && user_id) {
      const rateLimitConfig = action === 'validate_session' 
        ? RATE_LIMITS.SESSION_VALIDATE 
        : RATE_LIMITS.SESSION_TRACK
      const rateLimitResult = await checkRateLimit(supabase, user_id, rateLimitConfig)
      
      if (!rateLimitResult.allowed) {
        logger.warn('Rate limit exceeded for session operation', { userId: user_id, action })
        return new Response(
          JSON.stringify({ error: rateLimitResult.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        )
      }
    }

    switch (action) {
      case 'validate_session':
        return await validateSessionSecurity(req, user_id, session_token)
      case 'track_activity':
        return await trackUserActivity(req, user_id, session_token)
      case 'cleanup_sessions':
        return await cleanupExpiredSessions()
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error) {
    logger.error('Session security error', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function validateSessionSecurity(req: Request, userId: string, sessionToken: string) {
  try {
    const { data, error } = await supabase.rpc('validate_session_security', {
      p_user_id: userId,
      p_session_token: sessionToken
    })

    if (error) {
      throw error
    }

    // Additional security checks
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Check for suspicious patterns
    const riskFactors = []
    
    // Check for VPN/Proxy usage
    if (clientIP.includes('tor') || clientIP.includes('proxy')) {
      riskFactors.push('potential_proxy_usage')
    }

    // Check for unusual user agent
    if (userAgent.length < 50 || userAgent.includes('bot') || userAgent.includes('curl')) {
      riskFactors.push('suspicious_user_agent')
    }

    const securityScore = calculateSecurityScore(data, riskFactors)

    return new Response(
      JSON.stringify({
        ...data,
        security_score: securityScore,
        risk_factors: riskFactors,
        requires_additional_verification: securityScore < 70
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Session validation error', error)
    return new Response(
      JSON.stringify({ valid: false, reason: 'Validation failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

async function trackUserActivity(req: Request, userId: string, sessionToken: string) {
  try {
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown'
    
    // Update session activity
    await supabase
      .from('active_sessions')
      .update({ 
        last_activity: new Date().toISOString(),
        ip_address: clientIP 
      })
      .eq('user_id', userId)
      .eq('session_token', sessionToken)
      .eq('is_active', true)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Activity tracking error', error)
    return new Response(
      JSON.stringify({ error: 'Failed to track activity' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

async function cleanupExpiredSessions() {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_sessions')
    
    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cleaned_sessions: data,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Session cleanup error', error)
    return new Response(
      JSON.stringify({ error: 'Cleanup failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

function calculateSecurityScore(sessionData: any, riskFactors: string[]): number {
  let score = 100

  // Deduct points for risk factors
  score -= riskFactors.length * 15

  // Deduct points if session is not valid
  if (!sessionData.valid) {
    score -= 50
  }

  // Additional deductions based on session age and activity
  if (sessionData.reason?.includes('timeout')) {
    score -= 20
  }

  if (sessionData.reason?.includes('expired')) {
    score -= 30
  }

  return Math.max(score, 0)
}