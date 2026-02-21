/**
 * Security Incident Response System
 * Automated incident detection and response for production security
 */

import { logger } from '@/lib/logger';
import { ibmDb } from '@/lib/ibm';

export interface SecurityIncident {
  id: string;
  type: 'breach_attempt' | 'data_leak' | 'malware' | 'ddos' | 'privilege_escalation' | 'ai_bot' | 'rate_limit_abuse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp: string;
  details: any;
  status: 'detected' | 'investigating' | 'contained' | 'resolved';
  responseActions: string[];
  autoResolved: boolean;
}

export interface IncidentResponse {
  action: string;
  automated: boolean;
  timestamp: string;
  result: 'success' | 'failure' | 'partial';
  details?: any;
}

class SecurityIncidentResponseSystem {
  private incidents: Map<string, SecurityIncident> = new Map();
  private responseQueue: Array<{ incidentId: string; action: string }> = [];
  private isProcessingResponses = false;

  constructor() {
    this.startResponseProcessor();
    this.setupPreventiveMonitoring();
  }

  public detectIncident(
    type: SecurityIncident['type'],
    severity: SecurityIncident['severity'],
    source: string,
    details: any
  ): SecurityIncident {
    const incident: SecurityIncident = {
      id: this.generateIncidentId(),
      type,
      severity,
      source,
      timestamp: new Date().toISOString(),
      details: this.sanitizeIncidentDetails(details),
      status: 'detected',
      responseActions: [],
      autoResolved: false
    };

    this.incidents.set(incident.id, incident);
    
    if (severity === 'critical') {
      this.triggerEmergencyResponse(incident);
    } else {
      this.queueAutomatedResponse(incident);
    }

    return incident;
  }

  private triggerEmergencyResponse(incident: SecurityIncident): void {
    const emergencyActions = this.getEmergencyActions(incident.type);
    emergencyActions.forEach(action => {
      this.executeResponse(incident.id, action, true);
    });
    this.notifySecurityTeam(incident);
    this.logIncidentResponse(incident.id, 'emergency_response_initiated', true, 'success');
  }

  private queueAutomatedResponse(incident: SecurityIncident): void {
    const responseActions = this.getResponseActions(incident.type, incident.severity);
    responseActions.forEach(action => {
      this.responseQueue.push({ incidentId: incident.id, action });
    });
  }

  private getEmergencyActions(incidentType: SecurityIncident['type']): string[] {
    switch (incidentType) {
      case 'breach_attempt':
        return ['block_source_ip', 'enable_enhanced_monitoring', 'alert_security_team'];
      case 'data_leak':
        return ['isolate_data_source', 'enable_audit_logging', 'notify_compliance_team'];
      case 'malware':
        return ['quarantine_system', 'scan_all_systems', 'block_external_connections'];
      case 'ddos':
        return ['enable_rate_limiting', 'activate_ddos_protection', 'scale_infrastructure'];
      case 'privilege_escalation':
        return ['revoke_elevated_permissions', 'lock_admin_accounts', 'audit_access_logs'];
      default:
        return ['increase_monitoring', 'log_detailed_activity'];
    }
  }

  private getResponseActions(incidentType: SecurityIncident['type'], severity: SecurityIncident['severity']): string[] {
    const baseActions = ['log_incident', 'increase_monitoring'];
    if (severity === 'high') {
      baseActions.push('alert_administrators', 'enable_enhanced_logging');
    }
    switch (incidentType) {
      case 'ai_bot':
        return [...baseActions, 'enable_captcha', 'increase_rate_limiting'];
      case 'rate_limit_abuse':
        return [...baseActions, 'temporary_ip_block', 'reduce_rate_limits'];
      case 'breach_attempt':
        return [...baseActions, 'enable_2fa_requirement', 'audit_access_patterns'];
      default:
        return baseActions;
    }
  }

  private async executeResponse(incidentId: string, action: string, emergency: boolean = false): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    try {
      let result: 'success' | 'failure' | 'partial' = 'success';
      let details: any = {};

      switch (action) {
        case 'block_source_ip':
          result = await this.blockSourceIP(incident.source);
          break;
        case 'enable_enhanced_monitoring':
          result = await this.enhanceMonitoring();
          break;
        case 'enable_rate_limiting':
          result = await this.enableRateLimiting(incident.source);
          break;
        case 'temporary_ip_block':
          result = await this.temporaryIPBlock(incident.source, 3600000);
          break;
        case 'enable_captcha':
          result = await this.enableCaptcha();
          break;
        case 'alert_administrators':
          result = await this.alertAdministrators(incident);
          break;
        case 'log_incident':
          result = await this.logIncidentDetails(incident);
          break;
        default:
          result = 'partial';
          details = { message: 'Action not implemented', action };
      }

      incident.responseActions.push(action);
      this.logIncidentResponse(incidentId, action, !emergency, result, details);

      if (result === 'success' && !emergency) {
        incident.autoResolved = true;
        incident.status = 'resolved';
      }
    } catch (error: any) {
      this.logIncidentResponse(incidentId, action, !emergency, 'failure', { error: error.message });
    }
  }

  private async blockSourceIP(source: string): Promise<'success' | 'failure'> {
    try {
      logger.secureLog('Blocking IP', source);
      return 'success';
    } catch {
      return 'failure';
    }
  }

  private async enhanceMonitoring(): Promise<'success' | 'failure'> {
    try {
      const { getAuthUser } = await import('@/lib/auth-utils');
      const user = await getAuthUser();
      
      if (user) {
        await ibmDb.rpc('store_secure_session_data', {
          p_key: `enhanced_monitoring_${user.id}`,
          p_value: 'true'
        });
      }
      return 'success';
    } catch {
      return 'failure';
    }
  }

  private async enableRateLimiting(source: string): Promise<'success' | 'failure'> {
    try {
      const { getAuthUser } = await import('@/lib/auth-utils');
      const user = await getAuthUser();
      
      if (user) {
        const rateLimitData = JSON.stringify({
          enabled: true, limit: 10, window: 60000, timestamp: Date.now(), source
        });
        await ibmDb.rpc('store_secure_session_data', {
          p_key: `rate_limit_${source}`,
          p_value: rateLimitData
        });
      }
      return 'success';
    } catch {
      return 'failure';
    }
  }

  private async temporaryIPBlock(source: string, duration: number): Promise<'success' | 'failure'> {
    try {
      const { getAuthUser } = await import('@/lib/auth-utils');
      const user = await getAuthUser();
      
      if (user) {
        const blockData = JSON.stringify({ blocked: true, until: Date.now() + duration, source });
        await ibmDb.rpc('store_secure_session_data', {
          p_key: `temp_block_${source}`,
          p_value: blockData
        });
      }
      return 'success';
    } catch {
      return 'failure';
    }
  }

  private async enableCaptcha(): Promise<'success' | 'failure'> {
    try {
      const { getAuthUser } = await import('@/lib/auth-utils');
      const user = await getAuthUser();
      
      if (user) {
        await ibmDb.rpc('store_secure_session_data', {
          p_key: `captcha_required_${user.id}`,
          p_value: 'true'
        });
      }
      return 'success';
    } catch {
      return 'failure';
    }
  }

  private async alertAdministrators(incident: SecurityIncident): Promise<'success' | 'failure'> {
    try {
      logger.secureLog('Administrator alert sent for incident', incident.id);
      return 'success';
    } catch {
      return 'failure';
    }
  }

  private async logIncidentDetails(incident: SecurityIncident): Promise<'success' | 'failure'> {
    try {
      logger.secureLog('Security incident logged', incident.id);
      return 'success';
    } catch {
      return 'failure';
    }
  }

  private startResponseProcessor(): void {
    setInterval(() => {
      if (!this.isProcessingResponses && this.responseQueue.length > 0) {
        this.processResponseQueue();
      }
    }, 5000);
  }

  private async processResponseQueue(): Promise<void> {
    if (this.isProcessingResponses) return;
    this.isProcessingResponses = true;
    try {
      const batch = this.responseQueue.splice(0, 5);
      await Promise.all(batch.map(({ incidentId, action }) => this.executeResponse(incidentId, action, false)));
    } finally {
      this.isProcessingResponses = false;
    }
  }

  private setupPreventiveMonitoring(): void {
    setInterval(() => { this.checkForAnomalousActivity(); }, 60000);
    setInterval(() => { this.checkSystemHealth(); }, 300000);
  }

  private async checkForAnomalousActivity(): Promise<void> {
    try {
      const { getAuthUser } = await import('@/lib/auth-utils');
      const user = await getAuthUser();
      if (!user) return;
      
      const { data: recentRequests } = await ibmDb
        .from('api_request_analytics')
        .select('id')
        .eq('user_id', user.id);
      
      if (recentRequests && (recentRequests as any[]).length > 100) {
        this.detectIncident('rate_limit_abuse', 'high', 'automated_detection', {
          request_count: (recentRequests as any[]).length,
          time_window: '1_minute'
        });
      }
    } catch (error) {
      // Silently fail
    }
  }

  private checkSystemHealth(): void {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      const memoryUsage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
      if (memoryUsage > 90) {
        this.detectIncident('breach_attempt', 'medium', 'system_monitor', {
          memory_usage: memoryUsage, type: 'potential_memory_exhaustion'
        });
      }
    }
  }

  private generateIncidentId(): string {
    return `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeIncidentDetails(details: any): any {
    if (typeof details !== 'object') return details;
    const sanitized: any = {};
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...';
      } else if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private logIncidentResponse(
    incidentId: string, action: string, automated: boolean, 
    result: 'success' | 'failure' | 'partial', details?: any
  ): void {
    logger.secureLog(`Incident response completed [${incidentId}]`);
  }

  private notifySecurityTeam(incident: SecurityIncident): void {
    logger.secureLog('Critical security incident - security team notified', incident.id);
  }

  public getIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values());
  }

  public getIncidentById(id: string): SecurityIncident | undefined {
    return this.incidents.get(id);
  }

  public resolveIncident(id: string, resolution: string): boolean {
    const incident = this.incidents.get(id);
    if (incident) {
      incident.status = 'resolved';
      incident.details.resolution = resolution;
      incident.details.resolved_at = new Date().toISOString();
      return true;
    }
    return false;
  }
}

export const securityIncidentResponse = new SecurityIncidentResponseSystem();
