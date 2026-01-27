import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('security-settings-validator')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { action, settings, setting_category } = await req.json()

    switch (action) {
      case 'validate_and_enforce':
        return await validateAndEnforceSettings(supabase, user.id, setting_category, settings)
      case 'audit_settings':
        return await auditSecuritySettings(supabase, user.id)
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error) {
    logger.error('Security settings validation error', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function validateAndEnforceSettings(
  supabase: any,
  userId: string,
  category: string,
  settings: any
): Promise<Response> {
  try {
    // Validate settings structure
    const validationResult = validateSettings(category, settings)
    if (!validationResult.valid) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: validationResult.error,
          violations: validationResult.violations 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check for security policy violations
    const policyViolations = await checkSecurityPolicies(supabase, userId, category, settings)
    if (policyViolations.length > 0) {
      logger.warn('Security policy violations detected', { userId, violations: policyViolations })
      
      // Log security event for policy violation attempt
      await supabase.from('security_events').insert({
        user_id: userId,
        event_type: 'security_policy_violation_attempt',
        severity: 'high',
        details: {
          category,
          violations: policyViolations,
          settings
        }
      })

      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Security policy violations detected',
          violations: policyViolations 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Settings are valid and comply with policies
    logger.logAction('settings_validated', { userId, category })
    
    return new Response(
      JSON.stringify({ 
        valid: true,
        enforced_settings: settings,
        message: 'Settings validated and ready to apply'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Settings validation failed', error)
    return new Response(
      JSON.stringify({ error: 'Validation failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

async function auditSecuritySettings(supabase: any, userId: string): Promise<Response> {
  try {
    // Get all user settings
    const { data: userSettings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    // Audit each setting for compliance
    const auditResults = []
    const issues = []

    for (const setting of userSettings || []) {
      const audit = await auditSetting(supabase, userId, setting)
      auditResults.push(audit)
      
      if (!audit.compliant) {
        issues.push({
          category: setting.setting_category,
          key: setting.setting_key,
          issue: audit.issue,
          severity: audit.severity
        })
      }
    }

    // Log audit event
    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: 'security_settings_audit',
      severity: issues.length > 0 ? 'medium' : 'low',
      details: {
        total_settings: userSettings?.length || 0,
        issues_found: issues.length,
        issues
      }
    })

    return new Response(
      JSON.stringify({ 
        compliant: issues.length === 0,
        audit_results: auditResults,
        issues,
        audit_timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Settings audit failed', error)
    return new Response(
      JSON.stringify({ error: 'Audit failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

function validateSettings(category: string, settings: any): { valid: boolean; error?: string; violations?: string[] } {
  const violations: string[] = []

  switch (category) {
    case 'data_protection':
      // Validate data protection settings
      if (typeof settings.auto_encrypt_new_data !== 'boolean') {
        violations.push('auto_encrypt_new_data must be a boolean')
      }
      if (typeof settings.enable_data_retention !== 'boolean') {
        violations.push('enable_data_retention must be a boolean')
      }
      if (settings.retention_period_days && 
          (typeof settings.retention_period_days !== 'number' || 
           settings.retention_period_days < 30 || 
           settings.retention_period_days > 3650)) {
        violations.push('retention_period_days must be between 30 and 3650 days')
      }
      break

    case 'session_security':
      // Validate session security settings
      if (settings.session_timeout && 
          (typeof settings.session_timeout !== 'number' || 
           settings.session_timeout < 300 || 
           settings.session_timeout > 86400)) {
        violations.push('session_timeout must be between 300 and 86400 seconds')
      }
      break

    default:
      // Generic validation for unknown categories
      if (!settings || typeof settings !== 'object') {
        violations.push('Settings must be a valid object')
      }
  }

  return {
    valid: violations.length === 0,
    error: violations.length > 0 ? 'Settings validation failed' : undefined,
    violations: violations.length > 0 ? violations : undefined
  }
}

async function checkSecurityPolicies(
  supabase: any, 
  userId: string, 
  category: string, 
  settings: any
): Promise<string[]> {
  const violations: string[] = []

  // Check organization-level security policies
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  // Enforce minimum security standards
  if (category === 'data_protection') {
    // For sensitive roles, enforce stricter policies
    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
      if (!settings.auto_encrypt_new_data) {
        violations.push('Admins must have auto_encrypt_new_data enabled')
      }
      if (!settings.enable_secure_export) {
        violations.push('Admins must have secure_export enabled')
      }
    }

    // Minimum retention period enforcement
    if (settings.enable_data_retention && settings.retention_period_days < 90) {
      violations.push('Minimum data retention period is 90 days for compliance')
    }
  }

  return violations
}

async function auditSetting(supabase: any, userId: string, setting: any): Promise<any> {
  const validationResult = validateSettings(setting.setting_category, setting.setting_value)
  const policyViolations = await checkSecurityPolicies(
    supabase, 
    userId, 
    setting.setting_category, 
    setting.setting_value
  )

  return {
    category: setting.setting_category,
    key: setting.setting_key,
    compliant: validationResult.valid && policyViolations.length === 0,
    issue: !validationResult.valid 
      ? validationResult.error 
      : policyViolations.length > 0 
        ? policyViolations.join('; ') 
        : null,
    severity: policyViolations.length > 0 ? 'high' : 'low'
  }
}
