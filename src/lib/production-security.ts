/**
 * Production Security Hardening
 * Enhanced security utilities for production environments
 */

export interface SecurityConfig {
  enableDetailedLogging: boolean;
  enablePerformanceOptimization: boolean;
  enableRealTimeAlerts: boolean;
  enableAutomaticIncidentResponse: boolean;
}

class ProductionSecurityManager {
  private config: SecurityConfig;
  private securityEventBuffer: Array<{
    event: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    details?: any;
  }> = [];
  
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableDetailedLogging: false, // Disabled in production
      enablePerformanceOptimization: true,
      enableRealTimeAlerts: true,
      enableAutomaticIncidentResponse: true,
      ...config
    };
    
    this.initializeSecurityHeaders();
    this.setupPerformanceOptimizations();
  }

  /**
   * Production Security Headers Validation
   */
  private initializeSecurityHeaders(): void {
    if (typeof window !== 'undefined') {
      // Validate CSP compliance
      this.validateCSPCompliance();
      
      // Check HTTPS enforcement
      this.enforceHTTPS();
      
      // Validate security headers
      this.validateSecurityHeaders();
    }
  }

  private validateCSPCompliance(): void {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!meta) {
      this.logSecurityEvent('csp_missing', 'high', {
        message: 'Content Security Policy not detected',
        recommendation: 'Add CSP headers for XSS protection'
      });
    }
  }

  private enforceHTTPS(): void {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      this.logSecurityEvent('insecure_connection', 'critical', {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        action: 'redirect_to_https'
      });
      
      if (this.config.enableAutomaticIncidentResponse) {
        window.location.replace(window.location.href.replace('http:', 'https:'));
      }
    }
  }

  private validateSecurityHeaders(): void {
    // Check for security headers via a test request
    if (navigator.sendBeacon) {
      fetch(window.location.origin, { method: 'HEAD' })
        .then(response => {
          const headers = response.headers;
          const requiredHeaders = [
            'strict-transport-security',
            'x-frame-options',
            'x-content-type-options',
            'referrer-policy'
          ];
          
          const missingHeaders = requiredHeaders.filter(header => !headers.get(header));
          
          if (missingHeaders.length > 0) {
            this.logSecurityEvent('missing_security_headers', 'medium', {
              missing: missingHeaders,
              recommendation: 'Configure missing security headers'
            });
          }
        })
        .catch(() => {
          // Silent fail for production
        });
    }
  }

  /**
   * Performance Optimizations for Security
   */
  private setupPerformanceOptimizations(): void {
    if (this.config.enablePerformanceOptimization) {
      // Batch security events
      setInterval(() => this.flushSecurityEvents(), 30000); // 30 seconds
      
      // Clean up rate limit counters
      setInterval(() => this.cleanupRateLimitCounters(), 60000); // 1 minute
    }
  }

  /**
   * Enhanced Rate Limiting with AI Detection
   */
  public checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const counter = this.rateLimitCounters.get(identifier);
    
    if (!counter || now > counter.resetTime) {
      this.rateLimitCounters.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }
    
    if (counter.count >= maxRequests) {
      this.logSecurityEvent('rate_limit_exceeded', 'high', {
        identifier: this.hashIdentifier(identifier),
        attempts: counter.count,
        window: windowMs,
        action: 'request_blocked'
      });
      return false;
    }
    
    counter.count++;
    return true;
  }

  /**
   * AI Behavior Detection (Enhanced)
   */
  public detectAIBehavior(requestData: {
    userAgent?: string;
    timingPattern?: number[];
    requestPattern?: string[];
    mouseMovements?: number;
  }): number {
    let aiScore = 0;
    
    // User agent analysis
    if (requestData.userAgent) {
      const suspiciousPatterns = [
        /headless/i,
        /phantom/i,
        /selenium/i,
        /chromedriver/i,
        /bot/i,
        /crawler/i,
        /spider/i
      ];
      
      if (suspiciousPatterns.some(pattern => pattern.test(requestData.userAgent!))) {
        aiScore += 40;
      }
    }
    
    // Timing pattern analysis
    if (requestData.timingPattern && requestData.timingPattern.length > 3) {
      const variance = this.calculateVariance(requestData.timingPattern);
      if (variance < 5) { // Too consistent for human
        aiScore += 30;
      }
    }
    
    // Mouse movement analysis
    if (requestData.mouseMovements !== undefined && requestData.mouseMovements < 5) {
      aiScore += 25; // Lack of natural mouse movements
    }
    
    // Request pattern analysis
    if (requestData.requestPattern && requestData.requestPattern.length > 5) {
      const uniquePatterns = new Set(requestData.requestPattern).size;
      if (uniquePatterns / requestData.requestPattern.length < 0.3) {
        aiScore += 20; // Too repetitive
      }
    }
    
    if (aiScore > 50) {
      this.logSecurityEvent('ai_behavior_detected', 'high', {
        score: aiScore,
        factors: {
          userAgent: !!requestData.userAgent,
          timing: !!requestData.timingPattern,
          mouse: requestData.mouseMovements !== undefined,
          pattern: !!requestData.requestPattern
        }
      });
    }
    
    return Math.min(aiScore, 100);
  }

  /**
   * Security Event Logging (Production Safe)
   */
  public logSecurityEvent(
    event: string, 
    severity: 'low' | 'medium' | 'high' | 'critical', 
    details?: any
  ): void {
    const securityEvent = {
      event,
      severity,
      timestamp: new Date().toISOString(),
      details: this.sanitizeDetails(details)
    };
    
    // Buffer events for batch processing
    this.securityEventBuffer.push(securityEvent);
    
    // Immediate handling for critical events
    if (severity === 'critical' && this.config.enableRealTimeAlerts) {
      this.handleCriticalEvent(securityEvent);
    }
    
    // Limit buffer size
    if (this.securityEventBuffer.length > 1000) {
      this.securityEventBuffer = this.securityEventBuffer.slice(-500);
    }
  }

  /**
   * Critical Event Response
   */
  private handleCriticalEvent(event: any): void {
    if (this.config.enableAutomaticIncidentResponse) {
      // Log to external monitoring service if available
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.sendBeacon) {
        const payload = JSON.stringify({
          type: 'critical_security_event',
          event: event.event,
          timestamp: event.timestamp,
          source: window.location.origin
        });
        
        navigator.sendBeacon('/api/security/incident', payload);
      }
    }
  }

  /**
   * Batch Security Event Flush
   */
  private flushSecurityEvents(): void {
    if (this.securityEventBuffer.length === 0) return;
    
    const events = [...this.securityEventBuffer];
    this.securityEventBuffer = [];
    
    // Send events to monitoring system
    if (typeof fetch !== 'undefined') {
      fetch('/api/security/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      }).catch(() => {
        // Silent fail in production, events are already logged locally
      });
    }
  }

  /**
   * Utility Methods
   */
  private sanitizeDetails(details: any): any {
    if (!details) return undefined;
    
    if (typeof details === 'string') {
      return details.replace(/[A-Za-z0-9+/]{20,}/g, '[REDACTED]');
    }
    
    if (typeof details === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(details)) {
        if (typeof value === 'string') {
          sanitized[key] = value.replace(/[A-Za-z0-9+/]{20,}/g, '[REDACTED]');
        } else if (typeof value === 'object') {
          sanitized[key] = '[OBJECT]';
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    
    return details;
  }

  private hashIdentifier(identifier: string): string {
    // Simple hash for identifier anonymization
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash)}`;
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const variance = numbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numbers.length;
    return variance;
  }

  private cleanupRateLimitCounters(): void {
    const now = Date.now();
    for (const [key, counter] of this.rateLimitCounters.entries()) {
      if (now > counter.resetTime) {
        this.rateLimitCounters.delete(key);
      }
    }
  }

  /**
   * Security Compliance Check
   */
  public runComplianceCheck(): {
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;
    
    // Check HTTPS
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      issues.push('Insecure HTTP connection');
      recommendations.push('Enforce HTTPS for all connections');
      score -= 20;
    }
    
    // Check for development indicators in production
    if (window.location.hostname !== 'localhost' && localStorage.getItem('debug')) {
      issues.push('Development debugging enabled in production');
      recommendations.push('Remove debug flags from production');
      score -= 10;
    }
    
    // Check for exposed APIs
    if (typeof window !== 'undefined' && (window as any).supabase) {
      const apiConfig = (window as any).supabase;
      if (apiConfig.supabaseKey && apiConfig.supabaseKey.length > 0) {
        // Check if it's a service role key (dangerous in client)
        if (apiConfig.supabaseKey.includes('service_role')) {
          issues.push('Service role key exposed in client');
          recommendations.push('Use anon key for client-side operations');
          score -= 30;
        }
      }
    }
    
    return { score: Math.max(score, 0), issues, recommendations };
  }
}

// Export singleton for production use
export const productionSecurity = new ProductionSecurityManager({
  enableDetailedLogging: import.meta.env.DEV || false,
  enablePerformanceOptimization: true,
  enableRealTimeAlerts: true,
  enableAutomaticIncidentResponse: !import.meta.env.DEV
});