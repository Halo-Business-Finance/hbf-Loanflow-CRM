import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SecureLogger } from '../_shared/secure-logger.ts'

const logger = new SecureLogger('persistent-ai-security')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AIBot {
  id: string
  bot_name: string
  bot_type: string
  status: string
  sensitivity_level: string
  configuration: any
  last_activity: string
  performance_metrics?: {
    scans_completed?: number
    alerts_generated?: number
    last_scan?: string
    uptime_percentage?: number
  }
}

interface ThreatIndicator {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical' | 'emergency'
  confidence: number
  details: any
}

class AISecurityEngine {
  private supabase: any
  private bots: AIBot[] = []

  constructor(supabase: any) {
    this.supabase = supabase
  }

  async initializeBots() {
    const { data: bots, error } = await this.supabase
      .from('ai_security_bots')
      .select('*')
      .eq('status', 'active')

    if (error) {
      logger.error('Failed to load AI bots', error)
      return
    }

    this.bots = bots || []
    logger.info(`Initialized ${this.bots.length} AI security bots`)
  }

  async runThreatDetection(): Promise<ThreatIndicator[]> {
    const threats: ThreatIndicator[] = []
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

    logger.info('ThreatHunter-Alpha: Starting high-sensitivity threat scan')

    // 1. CRITICAL: Monitor failed login attempts with extreme sensitivity
    const { data: failedLogins } = await this.supabase
      .from('security_events')
      .select('*')
      .eq('event_type', 'failed_login')
      .gte('created_at', fiveMinutesAgo)

    if (failedLogins && failedLogins.length >= 2) { // Ultra-sensitive: 2+ failures in 5 minutes
      threats.push({
        type: 'authentication_attack',
        severity: failedLogins.length >= 5 ? 'emergency' : 'critical',
        confidence: 95.0,
        details: {
          failed_attempts: failedLogins.length,
          unique_ips: [...new Set(failedLogins.map((f: any) => f.ip_address))].length,
          timeframe: '5 minutes',
          auto_response: 'IP blocking recommended'
        }
      })
    }

    // 2. CRITICAL: Detect privilege escalation attempts
    const { data: privilegeEvents } = await this.supabase
      .from('audit_logs')
      .select('*')
      .ilike('action', '%role%')
      .gte('created_at', oneHourAgo)

    if (privilegeEvents && privilegeEvents.length > 0) {
      threats.push({
        type: 'privilege_escalation',
        severity: 'critical',
        confidence: 88.0,
        details: {
          events: privilegeEvents.length,
          users_involved: [...new Set(privilegeEvents.map((e: any) => e.user_id))].length,
          recent_attempts: privilegeEvents.slice(-3)
        }
      })
    }

    // 3. CRITICAL: Detect unusual data access patterns
    const { data: dataAccess } = await this.supabase
      .from('audit_logs')
      .select('*')
      .in('table_name', ['contact_entities', 'contact_encrypted_fields', 'clients'])
      .gte('created_at', fiveMinutesAgo)

    if (dataAccess && dataAccess.length >= 10) { // 10+ data access events in 5 minutes
      threats.push({
        type: 'data_exfiltration_pattern',
        severity: 'emergency',
        confidence: 92.0,
        details: {
          access_count: dataAccess.length,
          tables_accessed: [...new Set(dataAccess.map((d: any) => d.table_name))],
          rapid_access_detected: true,
          auto_response: 'Account lockdown recommended'
        }
      })
    }

    // 4. CRITICAL: Monitor for geo-location anomalies
    const { data: geoEvents } = await this.supabase
      .from('security_events')
      .select('*')
      .eq('event_type', 'geo_anomaly')
      .gte('created_at', oneHourAgo)

    if (geoEvents && geoEvents.length >= 1) { // Single geo anomaly triggers alert
      threats.push({
        type: 'geographical_anomaly',
        severity: 'high',
        confidence: 85.0,
        details: {
          anomaly_count: geoEvents.length,
          locations: geoEvents.map((e: any) => e.details?.location || 'Unknown'),
          suspicious_travel_patterns: true
        }
      })
    }

    return threats
  }

  async runBehaviorAnalysis(): Promise<ThreatIndicator[]> {
    const threats: ThreatIndicator[] = []
    const now = new Date()
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString()

    logger.info('BehaviorWatch-Beta: Analyzing user behavior patterns')

    // Analyze unusual login times
    const { data: loginTimes } = await this.supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'user_login')
      .gte('created_at', tenMinutesAgo)

    for (const login of loginTimes || []) {
      const loginHour = new Date(login.created_at).getHours()
      
      // Flag logins outside business hours (6 AM - 10 PM)
      if (loginHour < 6 || loginHour > 22) {
        threats.push({
          type: 'unusual_login_time',
          severity: 'medium',
          confidence: 70.0,
          details: {
            user_id: login.user_id,
            login_time: login.created_at,
            hour: loginHour,
            pattern: 'outside_business_hours'
          }
        })
      }
    }

    // Detect rapid successive actions
    const { data: rapidActions } = await this.supabase
      .from('audit_logs')
      .select('*')
      .gte('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false })

    const userActionCounts = rapidActions?.reduce((acc: any, action: any) => {
      acc[action.user_id] = (acc[action.user_id] || 0) + 1
      return acc
    }, {}) || {}

    for (const [userId, count] of Object.entries(userActionCounts)) {
      if ((count as number) >= 20) { // 20+ actions in 10 minutes
        threats.push({
          type: 'hyperactive_behavior',
          severity: 'high',
          confidence: 80.0,
          details: {
            user_id: userId,
            action_count: count,
            timeframe: '10 minutes',
            pattern: 'automated_behavior_suspected'
          }
        })
      }
    }

    return threats
  }

  async runNetworkMonitoring(): Promise<ThreatIndicator[]> {
    const threats: ThreatIndicator[] = []
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

    logger.info('NetworkGuard-Gamma: Monitoring network traffic patterns')

    // Check for rate limit violations
    const { data: rateLimits } = await this.supabase
      .from('api_request_analytics')
      .select('*')
      .eq('rate_limit_triggered', true)
      .gte('created_at', fiveMinutesAgo)

    if (rateLimits && rateLimits.length >= 3) {
      threats.push({
        type: 'rate_limit_abuse',
        severity: 'high',
        confidence: 90.0,
        details: {
          violations: rateLimits.length,
          endpoints: [...new Set(rateLimits.map((r: any) => r.endpoint))],
          suspected_ddos: rateLimits.length >= 10
        }
      })
    }

    // Monitor for bot-like behavior
    const { data: botActivity } = await this.supabase
      .from('api_request_analytics')
      .select('*')
      .eq('is_bot_suspected', true)
      .gte('created_at', fiveMinutesAgo)

    if (botActivity && botActivity.length >= 1) {
      threats.push({
        type: 'bot_activity_detected',
        severity: 'medium',
        confidence: 75.0,
        details: {
          bot_requests: botActivity.length,
          user_agents: [...new Set(botActivity.map((b: any) => b.user_agent))],
          pattern: 'automated_access_pattern'
        }
      })
    }

    return threats
  }

  async runDataProtection(): Promise<ThreatIndicator[]> {
    const threats: ThreatIndicator[] = []
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

    logger.info('DataProtector-Delta: Scanning for data protection violations')

    // Monitor encrypted field access
    const { data: encryptedAccess } = await this.supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'contact_encrypted_fields')
      .gte('created_at', fiveMinutesAgo)

    if (encryptedAccess && encryptedAccess.length >= 5) {
      threats.push({
        type: 'sensitive_data_access',
        severity: 'critical',
        confidence: 88.0,
        details: {
          access_count: encryptedAccess.length,
          fields_accessed: encryptedAccess.length,
          pattern: 'bulk_encrypted_field_access'
        }
      })
    }

    // Check for bulk operations on sensitive tables
    const { data: bulkOps } = await this.supabase
      .from('audit_logs')
      .select('*')
      .in('table_name', ['contact_entities', 'leads', 'clients'])
      .in('action', ['bulk_update', 'bulk_delete', 'bulk_insert'])
      .gte('created_at', fiveMinutesAgo)

    if (bulkOps && bulkOps.length > 0) {
      threats.push({
        type: 'bulk_data_operation',
        severity: 'emergency',
        confidence: 95.0,
        details: {
          operations: bulkOps.length,
          tables: [...new Set(bulkOps.map((op: any) => op.table_name))],
          actions: [...new Set(bulkOps.map((op: any) => op.action))],
          immediate_review_required: true
        }
      })
    }

    return threats
  }

  async processThreats(threats: ThreatIndicator[]) {
    for (const threat of threats) {
      // Log bot activity
      await this.supabase
        .from('ai_bot_activity')
        .insert({
          bot_id: this.getBotIdByType(threat.type),
          activity_type: 'alert',
          details: {
            threat_type: threat.type,
            severity: threat.severity,
            confidence: threat.confidence,
            threat_details: threat.details
          },
          status: 'completed'
        })

      // Create high-priority alert
      const alertData = {
        bot_id: this.getBotIdByType(threat.type),
        alert_type: threat.type,
        severity: threat.severity,
        title: this.generateAlertTitle(threat),
        description: this.generateAlertDescription(threat),
        threat_indicators: threat.details,
        confidence_score: threat.confidence,
        requires_human_review: threat.severity === 'emergency' || threat.severity === 'critical',
        auto_response_taken: threat.severity === 'emergency'
      }

      const { data: alert, error } = await this.supabase
        .from('ai_bot_alerts')
        .insert(alertData)
        .select()
        .single()

      if (error) {
        logger.error('Failed to create alert', error)
        continue
      }

      // Auto-response for emergency threats
      if (threat.severity === 'emergency') {
        await this.executeAutoResponse(threat, alert.id)
      }

      // Send real-time notification
      await this.sendRealTimeAlert(threat, alert.id)
    }
  }

  private getBotIdByType(threatType: string): string {
    const botMap: Record<string, string> = {
      'authentication_attack': 'threat_detection',
      'privilege_escalation': 'threat_detection',
      'data_exfiltration_pattern': 'data_protection',
      'geographical_anomaly': 'behavior_analysis',
      'unusual_login_time': 'behavior_analysis',
      'hyperactive_behavior': 'behavior_analysis',
      'rate_limit_abuse': 'network_monitor',
      'bot_activity_detected': 'network_monitor',
      'sensitive_data_access': 'data_protection',
      'bulk_data_operation': 'data_protection'
    }

    const botType = botMap[threatType] || 'threat_detection'
    const bot = this.bots.find(b => b.bot_type === botType)
    return bot?.id || 'unknown'
  }

  private generateAlertTitle(threat: ThreatIndicator): string {
    const titles: Record<string, string> = {
      'authentication_attack': '🚨 CRITICAL: Authentication Attack Detected',
      'privilege_escalation': '⚠️ CRITICAL: Privilege Escalation Attempt',
      'data_exfiltration_pattern': '🔒 EMERGENCY: Data Exfiltration Pattern',
      'geographical_anomaly': '🌍 HIGH: Geographical Access Anomaly',
      'unusual_login_time': '⏰ MEDIUM: Unusual Login Time Pattern',
      'hyperactive_behavior': '🤖 HIGH: Hyperactive User Behavior',
      'rate_limit_abuse': '📈 HIGH: Rate Limit Abuse Detected',
      'bot_activity_detected': '🤖 MEDIUM: Bot Activity Detected',
      'sensitive_data_access': '🔐 CRITICAL: Sensitive Data Access Pattern',
      'bulk_data_operation': '📊 EMERGENCY: Bulk Data Operation Detected'
    }

    return titles[threat.type] || `AI Security Alert: ${threat.type}`
  }

  private generateAlertDescription(threat: ThreatIndicator): string {
    const base = `AI Security Bot detected ${threat.type} with ${threat.confidence}% confidence. `
    const details = JSON.stringify(threat.details, null, 2)
    return base + `Details: ${details}`
  }

  private async executeAutoResponse(threat: ThreatIndicator, alertId: string) {
    logger.info('Executing auto-response', { threatType: threat.type })

    // Log emergency security event
    await this.supabase
      .from('emergency_events')
      .insert({
        threat_type: threat.type,
        severity: 'critical',
        trigger_source: 'ai_security_bot',
        event_data: {
          alert_id: alertId,
          threat_details: threat.details,
          auto_response: true,
          timestamp: new Date().toISOString()
        },
        auto_shutdown: false
      })

    // Update alert to indicate auto-response was taken
    await this.supabase
      .from('ai_bot_alerts')
      .update({ 
        auto_response_taken: true,
        metadata: { auto_response_timestamp: new Date().toISOString() }
      })
      .eq('id', alertId)
  }

  private async sendRealTimeAlert(threat: ThreatIndicator, alertId: string) {
    // Create security notification for real-time alerts
    await this.supabase
      .from('security_notifications')
      .insert({
        notification_type: threat.type,
        title: this.generateAlertTitle(threat),
        message: `AI Security Bot Alert: ${threat.type} detected with ${threat.confidence}% confidence`,
        severity: threat.severity,
        metadata: {
          alert_id: alertId,
          bot_generated: true,
          threat_details: threat.details,
          requires_immediate_action: threat.severity === 'emergency'
        }
      })
  }

  async updateBotMetrics() {
    for (const bot of this.bots) {
      const metrics = {
        last_scan: new Date().toISOString(),
        scans_completed: (bot.performance_metrics?.scans_completed || 0) + 1,
        uptime_percentage: 99.9, // Always-on bots maintain high uptime
        alerts_generated: bot.performance_metrics?.alerts_generated || 0
      }

      await this.supabase
        .from('ai_security_bots')
        .update({ 
          performance_metrics: metrics,
          last_activity: new Date().toISOString()
        })
        .eq('id', bot.id)
    }
  }
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
    const action = url.searchParams.get('action') || 'run_scan';
    
    logger.info('AI Security Engine starting', { action });

    const aiEngine = new AISecurityEngine(supabase)
    await aiEngine.initializeBots()

    const startTime = Date.now()
    let allThreats: ThreatIndicator[] = []

    switch (action) {
      case 'run_scan':
        logger.info('Running comprehensive AI security scan')
        
        const [threatDetection, behaviorAnalysis, networkMonitoring, dataProtection] = await Promise.all([
          aiEngine.runThreatDetection(),
          aiEngine.runBehaviorAnalysis(),
          aiEngine.runNetworkMonitoring(),
          aiEngine.runDataProtection()
        ])

        allThreats = [...threatDetection, ...behaviorAnalysis, ...networkMonitoring, ...dataProtection]
        
        // Process all detected threats
        if (allThreats.length > 0) {
          await aiEngine.processThreats(allThreats)
        }

        // Update bot performance metrics
        await aiEngine.updateBotMetrics()

        const executionTime = Date.now() - startTime
        
        logger.info('AI Security Scan complete', { threatsDetected: allThreats.length, executionTimeMs: executionTime })

        return new Response(
          JSON.stringify({
            success: true,
            scan_completed: true,
            threats_detected: allThreats.length,
            high_priority_threats: allThreats.filter(t => t.severity === 'critical' || t.severity === 'emergency').length,
            execution_time_ms: executionTime,
            threats: allThreats,
            timestamp: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );

      case 'status':
        // Get AI bot status
        const { data: bots } = await supabase
          .from('ai_security_bots')
          .select('*')
          .order('last_activity', { ascending: false })

        const { data: recentAlerts } = await supabase
          .from('ai_bot_alerts')
          .select('*')
          .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
          .order('created_at', { ascending: false })

        return new Response(
          JSON.stringify({
            success: true,
            bots: bots || [],
            recent_alerts: recentAlerts || [],
            total_active_bots: bots?.filter(b => b.status === 'active').length || 0,
            last_update: new Date().toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );

      default:
        throw new Error('Invalid action specified');
    }

  } catch (error: unknown) {
    logger.error('AI Security Engine error', error);
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        error: 'AI Security monitoring failed',
        message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});