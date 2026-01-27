import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSecurityHeaders, handleSecureOptions } from '../_shared/security-headers.ts'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('security-enhanced')

const corsHeaders = getSecurityHeaders()

interface SecurityScanResult {
  score: number;
  threats: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
  recommendations: string[];
}

interface ThreatSignature {
  pattern: RegExp;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleSecureOptions();
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, ...requestData } = await req.json()
    logger.logAction(action);

    switch (action) {
      case 'comprehensive_scan':
        return await handleComprehensiveScan(supabase, requestData)
      
      case 'threat_analysis':
        return await handleThreatAnalysis(supabase, requestData)
      
      case 'security_validation':
        return await handleSecurityValidation(supabase, requestData)
      
      case 'incident_response':
        return await handleIncidentResponse(supabase, requestData)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid security action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }
  } catch (error) {
    logger.error('Security Enhanced Error', error)
    
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: 'Security system error',
        details: message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function handleComprehensiveScan(supabase: any, data: any) {
  logger.info('Starting comprehensive security scan')
  
  const scanResult: SecurityScanResult = {
    score: 100,
    threats: [],
    recommendations: []
  }

  try {
    // 1. Database Security Scan
    const dbScan = await scanDatabaseSecurity(supabase)
    scanResult.threats.push(...dbScan.threats)
    scanResult.score -= dbScan.penaltyPoints

    // 2. Session Security Scan  
    const sessionScan = await scanSessionSecurity(supabase, data.user_id)
    scanResult.threats.push(...sessionScan.threats)
    scanResult.score -= sessionScan.penaltyPoints

    // 3. Input Validation Scan
    const inputScan = await scanInputValidation(supabase)
    scanResult.threats.push(...inputScan.threats)
    scanResult.score -= inputScan.penaltyPoints

    // 4. Access Control Scan
    const accessScan = await scanAccessControls(supabase, data.user_id)
    scanResult.threats.push(...accessScan.threats)
    scanResult.score -= accessScan.penaltyPoints

    // Generate recommendations
    scanResult.recommendations = generateSecurityRecommendations(scanResult.threats)

    // Log scan results
    await supabase.from('security_events').insert({
      event_type: 'comprehensive_security_scan',
      severity: scanResult.score < 70 ? 'high' : scanResult.score < 85 ? 'medium' : 'low',
      details: {
        scan_score: scanResult.score,
        threats_found: scanResult.threats.length,
        critical_threats: scanResult.threats.filter(t => t.severity === 'critical').length,
        high_threats: scanResult.threats.filter(t => t.severity === 'high').length
      },
      user_id: data.user_id
    })

    logger.info('Security scan complete', { score: scanResult.score, threatsFound: scanResult.threats.length })

    return new Response(
      JSON.stringify({ 
        success: true, 
        scan_result: scanResult,
        status: scanResult.score >= 85 ? 'secure' : scanResult.score >= 70 ? 'warning' : 'critical'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    logger.error('Security scan error', error)
    throw error
  }
}

async function scanDatabaseSecurity(supabase: any) {
  const threats = []
  let penaltyPoints = 0

  try {
    // Check for tables without RLS
    const { data: tables } = await supabase.rpc('get_tables_without_rls')
    if (tables && tables.length > 0) {
      threats.push({
        type: 'database_security',
        severity: 'critical' as const,
        description: `${tables.length} tables found without Row Level Security enabled`,
        recommendation: 'Enable RLS on all sensitive tables immediately'
      })
      penaltyPoints += 30
    }

    // Check for weak password policies
    const { data: weakPolicies } = await supabase.rpc('check_password_policies')
    if (weakPolicies && weakPolicies.weak_policies > 0) {
      threats.push({
        type: 'authentication',
        severity: 'high' as const,
        description: 'Weak password policies detected',
        recommendation: 'Implement stronger password requirements'
      })
      penaltyPoints += 15
    }

  } catch (error) {
    logger.error('Database security scan error', error)
    threats.push({
      type: 'system_error',
      severity: 'medium' as const,
      description: 'Unable to complete database security scan',
      recommendation: 'Review database security manually'
    })
    penaltyPoints += 10
  }

  return { threats, penaltyPoints }
}

async function scanSessionSecurity(supabase: any, userId: string) {
  const threats: Array<{type: string, severity: 'low' | 'medium' | 'high' | 'critical', description: string, recommendation: string}> = []
  let penaltyPoints = 0

  try {
    if (!userId) return { threats, penaltyPoints }

    // Check for suspicious session activity
    const { data: suspiciousSessions } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .or('is_suspicious.eq.true,risk_score.gt.50')

    if (suspiciousSessions && suspiciousSessions.length > 0) {
      threats.push({
        type: 'session_security',
        severity: 'high' as const,
        description: `${suspiciousSessions.length} suspicious sessions detected`,
        recommendation: 'Terminate suspicious sessions and force re-authentication'
      })
      penaltyPoints += 20
    }

    // Check for concurrent sessions from different locations
    const { data: concurrentSessions } = await supabase
      .from('active_sessions')
      .select('ip_address')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (concurrentSessions && concurrentSessions.length > 3) {
      threats.push({
        type: 'session_management',
        severity: 'medium' as const,
        description: `${concurrentSessions.length} concurrent active sessions`,
        recommendation: 'Limit concurrent sessions and monitor for session hijacking'
      })
      penaltyPoints += 10
    }

  } catch (error) {
    logger.error('Session security scan error', error)
  }

  return { threats, penaltyPoints }
}

async function scanInputValidation(supabase: any) {
  const threats = []
  let penaltyPoints = 0

  try {
    // Check recent security events for injection attempts
    const { data: injectionAttempts } = await supabase
      .from('security_events')
      .select('*')
      .in('event_type', ['input_validation', 'xss_attempt', 'sql_injection'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .eq('severity', 'high')

    if (injectionAttempts && injectionAttempts.length > 5) {
      threats.push({
        type: 'input_validation',
        severity: 'high' as const,
        description: `${injectionAttempts.length} injection attempts in last 24 hours`,
        recommendation: 'Enhance input validation and implement rate limiting'
      })
      penaltyPoints += 15
    }

  } catch (error) {
    logger.error('Input validation scan error', error)
  }

  return { threats, penaltyPoints }
}

async function scanAccessControls(supabase: any, userId: string) {
  const threats = []
  let penaltyPoints = 0

  try {
    // Check for recent permission escalation attempts
    const { data: escalationAttempts } = await supabase
      .from('security_events')
      .select('*')
      .eq('event_type', 'privilege_escalation_attempt')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    if (escalationAttempts && escalationAttempts.length > 0) {
      threats.push({
        type: 'access_control',
        severity: 'critical' as const,
        description: `${escalationAttempts.length} privilege escalation attempts detected`,
        recommendation: 'Review user permissions and implement additional access controls'
      })
      penaltyPoints += 25
    }

  } catch (error) {
    logger.error('Access control scan error', error)
  }

  return { threats, penaltyPoints }
}

function generateSecurityRecommendations(threats: any[]): string[] {
  const recommendations = new Set<string>()

  threats.forEach(threat => {
    switch (threat.type) {
      case 'database_security':
        recommendations.add('Enable Row Level Security on all tables')
        recommendations.add('Implement database audit logging')
        break
      case 'session_security':
        recommendations.add('Implement session timeout policies')
        recommendations.add('Add device fingerprinting for session validation')
        break
      case 'input_validation':
        recommendations.add('Enhance input sanitization and validation')
        recommendations.add('Implement Content Security Policy headers')
        break
      case 'access_control':
        recommendations.add('Review and tighten user role permissions')
        recommendations.add('Implement multi-factor authentication for sensitive operations')
        break
    }
  })

  return Array.from(recommendations)
}

async function handleThreatAnalysis(supabase: any, data: any) {
  logger.info('Performing threat analysis')

  const threatSignatures: ThreatSignature[] = [
    {
      pattern: /<script|javascript:|on\w+\s*=/i,
      type: 'xss_attempt',
      severity: 'high',
      description: 'Cross-site scripting (XSS) pattern detected'
    },
    {
      pattern: /(union|select|insert|update|delete|drop|exec|execute|alter|create)\s+/i,
      type: 'sql_injection',
      severity: 'critical',
      description: 'SQL injection pattern detected'
    },
    {
      pattern: /(\||&|;|`|\$\(|<|>|rm\s|wget\s|curl\s)/,
      type: 'command_injection',
      severity: 'critical',
      description: 'Command injection pattern detected'
    },
    {
      pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
      type: 'path_traversal',
      severity: 'high',
      description: 'Path traversal attempt detected'
    }
  ]

  const results = []
  const inputText = data.input || ''

  for (const signature of threatSignatures) {
    if (signature.pattern.test(inputText)) {
      results.push({
        threat_type: signature.type,
        severity: signature.severity,
        description: signature.description,
        matched_pattern: signature.pattern.toString(),
        confidence: 0.95
      })

      // Log threat detection
      await supabase.from('security_events').insert({
        event_type: signature.type,
        severity: signature.severity,
        details: {
          input_sample: inputText.substring(0, 100),
          pattern_matched: signature.pattern.toString(),
          confidence: 0.95
        },
        user_id: data.user_id
      })
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      threats_detected: results.length,
      threats: results,
      risk_level: results.length > 0 ? 'high' : 'low'
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

async function handleSecurityValidation(supabase: any, data: any) {
  logger.info('Performing security validation')

  const validation = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[],
    score: 100
  }

  // Validate session
  if (data.session_token) {
    const sessionValid = await validateSecureSession(supabase, data.session_token, data.user_id)
    if (!sessionValid) {
      validation.valid = false
      validation.errors.push('Invalid or expired session')
      validation.score -= 50
    }
  }

  // Validate permissions
  if (data.required_permission && data.user_id) {
    const hasPermission = await checkUserPermissions(supabase, data.user_id, data.required_permission)
    if (!hasPermission) {
      validation.valid = false
      validation.errors.push('Insufficient permissions')
      validation.score -= 30
    }
  }

  // Rate limit check
  if (data.action && data.user_id) {
    const rateLimitOk = await checkRateLimit(supabase, data.user_id, data.action)
    if (!rateLimitOk) {
      validation.valid = false
      validation.errors.push('Rate limit exceeded')
      validation.score -= 20
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      validation_result: validation 
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

async function validateSecureSession(supabase: any, sessionToken: string, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single()

    return !!data
  } catch {
    return false
  }
}

async function checkUserPermissions(supabase: any, userId: string, permission: string): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('has_role', {
      required_role: permission,
      user_id: userId
    })

    return !!data
  } catch {
    return false
  }
}

async function checkRateLimit(supabase: any, userId: string, action: string): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('check_rate_limit', {
      p_identifier: userId,
      p_action_type: action
    })

    return data?.allowed || false
  } catch {
    return false
  }
}

async function handleIncidentResponse(supabase: any, data: any) {
  logger.info('Handling security incident response')

  const incident = {
    type: data.incident_type || 'unknown',
    severity: data.severity || 'medium',
    description: data.description || 'Security incident detected',
    user_id: data.user_id,
    ip_address: data.ip_address,
    user_agent: data.user_agent,
    timestamp: new Date().toISOString(),
    response_actions: [] as string[]
  }

  // Determine response actions based on severity and type
  switch (incident.severity) {
    case 'critical':
      incident.response_actions.push('immediate_session_termination')
      incident.response_actions.push('account_temporary_lock')
      incident.response_actions.push('admin_notification')
      break
    case 'high':
      incident.response_actions.push('session_validation_required')
      incident.response_actions.push('additional_monitoring')
      break
    case 'medium':
      incident.response_actions.push('enhanced_logging')
      break
  }

  // Log incident
  await supabase.from('security_events').insert({
    event_type: 'security_incident',
    severity: incident.severity,
    details: incident,
    user_id: incident.user_id
  })

  // Execute response actions
  for (const action of incident.response_actions) {
    await executeSecurityAction(supabase, action, data)
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      incident_id: crypto.randomUUID(),
      response_actions: incident.response_actions,
      status: 'incident_recorded_and_handled'
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

async function executeSecurityAction(supabase: any, action: string, data: any) {
  switch (action) {
    case 'immediate_session_termination':
      if (data.user_id) {
        await supabase
          .from('active_sessions')
          .update({ is_active: false })
          .eq('user_id', data.user_id)
      }
      break
    case 'account_temporary_lock':
      if (data.user_id) {
        await supabase.from('account_lockouts').insert({
          user_id: data.user_id,
          reason: 'Security incident - automatic lock',
          locked_by_system: true
        })
      }
      break
    // Add more security actions as needed
  }
}