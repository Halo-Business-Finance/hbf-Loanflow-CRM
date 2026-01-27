import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SecureLogger } from '../_shared/secure-logger.ts';

const logger = new SecureLogger('threat-detection');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { 
      action, 
      user_agent, 
      ip_address, 
      request_fingerprint,
      behavior_data,
      timing_patterns,
      device_fingerprint 
    } = await req.json();

    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    ip_address || 'unknown';

    const userAgent = req.headers.get('user-agent') || user_agent || 'unknown';

    logger.logRequest(req, { action });

    switch (action) {
      case 'analyze_request':
        return await analyzeRequest(supabase, {
          ip_address: clientIP,
          user_agent: userAgent,
          request_fingerprint,
          behavior_data
        });

      case 'detect_ai_behavior':
        return await detectAIBehavior(supabase, {
          timing_patterns,
          behavior_data,
          device_fingerprint
        });

      case 'validate_session':
        return await validateSession(supabase, req);

      case 'check_anomalies':
        return await checkAnomalies(supabase, {
          ip_address: clientIP,
          user_agent: userAgent,
          behavior_data
        });

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    logger.error('[THREAT-DETECTION] Error', error);
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function analyzeRequest(supabase: any, data: any) {
  logger.info('[ANALYZE-REQUEST] Starting analysis')
  
  let threatScore = 0;
  const threats = [];
  
  // Check user agent for bot indicators
  const botPatterns = [
    /bot|crawler|spider|scraper|automated/i,
    /headless|phantom|selenium|puppeteer/i,
    /curl|wget|python|java|go-http/i
  ];
  
  for (const pattern of botPatterns) {
    if (pattern.test(data.user_agent)) {
      threatScore += 40;
      threats.push('bot_user_agent');
      break;
    }
  }
  
  // Check for suspicious request patterns
  if (data.request_fingerprint) {
    const { data: recentRequests } = await supabase
      .from('api_request_analytics')
      .select('*')
      .eq('request_fingerprint', data.request_fingerprint)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()); // Last hour
    
    if (recentRequests && recentRequests.length > 100) {
      threatScore += 60;
      threats.push('high_frequency_requests');
    }
  }
  
  // Behavioral analysis
  if (data.behavior_data) {
    const { mouse_variance, click_patterns, scroll_patterns } = data.behavior_data;
    
    // Perfect patterns (AI characteristic)
    if (mouse_variance < 5 && click_patterns === 0 && scroll_patterns === 0) {
      threatScore += 50;
      threats.push('perfect_behavior_patterns');
    }
    
    // Inhuman speed
    if (data.behavior_data.response_time < 50) {
      threatScore += 30;
      threats.push('inhuman_response_time');
    }
  }
  
  // Determine threat level
  let threatLevel = 'low';
  if (threatScore >= 80) threatLevel = 'critical';
  else if (threatScore >= 60) threatLevel = 'high';
  else if (threatScore >= 40) threatLevel = 'medium';
  
  // Log if threat detected
  if (threatScore >= 40) {
    await supabase.from('threat_incidents').insert({
      incident_type: 'automated_request_detection',
      severity: threatLevel,
      threat_vector: 'api_request',
      ai_generated: threatScore >= 60,
      incident_data: {
        threat_score: threatScore,
        threats_detected: threats,
        user_agent: data.user_agent,
        behavior_analysis: data.behavior_data
      },
      ip_address: data.ip_address,
      user_agent: data.user_agent
    });
    
    logger.info('[THREAT-DETECTED]', { score: threatScore, level: threatLevel });
  }
  
  // Log request analytics
  await supabase.from('api_request_analytics').insert({
    endpoint: 'threat-detection',
    method: 'POST',
    request_fingerprint: data.request_fingerprint,
    is_bot_suspected: threatScore >= 40,
    ai_confidence_score: threatScore,
    blocked: threatScore >= 80,
    ip_address: data.ip_address,
    user_agent: data.user_agent
  });
  
  return new Response(
    JSON.stringify({
      allowed: threatScore < 80,
      threat_score: threatScore,
      threat_level: threatLevel,
      threats_detected: threats,
      action_taken: threatScore >= 80 ? 'blocked' : 'allowed'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function detectAIBehavior(supabase: any, data: any) {
  logger.info('[AI-DETECTION] Analyzing behavioral patterns')
  
  let aiScore = 0;
  const aiIndicators = [];
  
  // Timing analysis
  if (data.timing_patterns) {
    const { variance, consistency, response_times } = data.timing_patterns;
    
    // Too consistent timing (AI characteristic)
    if (variance < 10) {
      aiScore += 35;
      aiIndicators.push('consistent_timing');
    }
    
    // Perfect consistency
    if (consistency > 95) {
      aiScore += 25;
      aiIndicators.push('perfect_consistency');
    }
    
    // Inhuman response times
    if (response_times && response_times.every((time: number) => time < 100)) {
      aiScore += 40;
      aiIndicators.push('inhuman_speed');
    }
  }
  
  // Device fingerprint analysis
  if (data.device_fingerprint) {
    const commonAIFingerprints = [
      'headless-chrome',
      'phantom-js',
      'selenium-driver',
      'puppeteer-core'
    ];
    
    if (commonAIFingerprints.some(fp => data.device_fingerprint.includes(fp))) {
      aiScore += 60;
      aiIndicators.push('ai_tool_fingerprint');
    }
  }
  
  // Behavioral patterns
  if (data.behavior_data) {
    const { mouse_movements, keyboard_dynamics, scroll_behavior } = data.behavior_data;
    
    // No human-like variations
    if (!mouse_movements && !keyboard_dynamics && !scroll_behavior) {
      aiScore += 45;
      aiIndicators.push('no_human_interaction');
    }
    
    // Perfect patterns
    if (mouse_movements === 0 && keyboard_dynamics === 0) {
      aiScore += 30;
      aiIndicators.push('perfect_automation');
    }
  }
  
  // Determine AI likelihood
  let aiLikelihood = 'low';
  if (aiScore >= 80) aiLikelihood = 'very_high';
  else if (aiScore >= 60) aiLikelihood = 'high';
  else if (aiScore >= 40) aiLikelihood = 'medium';
  
  // Log high-confidence AI detection
  if (aiScore >= 60) {
    await supabase.from('threat_incidents').insert({
      incident_type: 'ai_bot_detection',
      severity: aiScore >= 80 ? 'critical' : 'high',
      threat_vector: 'behavioral_analysis',
      ai_generated: true,
      incident_data: {
        ai_score: aiScore,
        ai_indicators: aiIndicators,
        timing_patterns: data.timing_patterns,
        device_fingerprint: data.device_fingerprint
      }
    });
    
    logger.info('[AI-DETECTED]', { score: aiScore, likelihood: aiLikelihood });
  }
  
  return new Response(
    JSON.stringify({
      ai_likelihood: aiLikelihood,
      ai_score: aiScore,
      indicators: aiIndicators,
      recommended_action: aiScore >= 80 ? 'block' : aiScore >= 60 ? 'challenge' : 'allow'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function validateSession(supabase: any, req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('No authorization header');
  }
  
  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  
  if (error || !user) {
    throw new Error('Invalid session');
  }
  
  const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  // Check for session anomalies
  const { data: anomalies } = await supabase.rpc('detect_login_anomalies', {
    p_user_id: user.id,
    p_ip_address: clientIP,
    p_user_agent: userAgent,
    p_geo_data: { country: 'US' } // This would normally come from IP geolocation
  });
  
  let riskScore = anomalies?.anomaly_score || 0;
  
  // Update secure session
  await supabase.from('secure_sessions').upsert({
    user_id: user.id,
    session_token: jwt.slice(-10), // Last 10 chars for identification
    ip_address: clientIP,
    user_agent: userAgent,
    risk_score: riskScore,
    is_suspicious: riskScore >= 50,
    requires_mfa: riskScore >= 70,
    last_activity: new Date().toISOString()
  }, { onConflict: 'session_token' });
  
  return new Response(
    JSON.stringify({
      valid: true,
      user: {
        id: user.id,
        email: user.email
      },
      security: {
        risk_score: riskScore,
        is_suspicious: riskScore >= 50,
        requires_mfa: riskScore >= 70
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function checkAnomalies(supabase: any, data: any) {
  logger.info('[ANOMALY-CHECK] Scanning for unusual patterns')
  
  let anomalyScore = 0;
  const anomalies = [];
  
  // Check IP reputation
  const { data: ipHistory } = await supabase
    .from('ip_restrictions')
    .select('*')
    .eq('ip_address', data.ip_address)
    .single();
  
  if (ipHistory && !ipHistory.is_allowed) {
    anomalyScore += 70;
    anomalies.push('blocked_ip');
  }
  
  // Time-based anomalies
  const currentHour = new Date().getHours();
  if (currentHour >= 2 && currentHour <= 5) { // 2-5 AM
    anomalyScore += 20;
    anomalies.push('unusual_hour');
  }
  
  // Rate limiting check
  const { data: recentRequests } = await supabase
    .from('api_request_analytics')
    .select('*')
    .eq('ip_address', data.ip_address)
    .gte('created_at', new Date(Date.now() - 300000).toISOString()); // Last 5 minutes
  
  if (recentRequests && recentRequests.length > 50) {
    anomalyScore += 50;
    anomalies.push('rate_limit_exceeded');
  }
  
  // Behavioral anomalies
  if (data.behavior_data) {
    const { rapid_clicks, impossible_mouse_speed } = data.behavior_data;
    
    if (rapid_clicks > 10) {
      anomalyScore += 30;
      anomalies.push('rapid_clicking');
    }
    
    if (impossible_mouse_speed) {
      anomalyScore += 40;
      anomalies.push('impossible_mouse_movement');
    }
  }
  
  return new Response(
    JSON.stringify({
      anomaly_score: anomalyScore,
      anomalies_detected: anomalies,
      risk_level: anomalyScore >= 70 ? 'high' : anomalyScore >= 40 ? 'medium' : 'low',
      recommended_action: anomalyScore >= 70 ? 'block' : anomalyScore >= 40 ? 'monitor' : 'allow'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}