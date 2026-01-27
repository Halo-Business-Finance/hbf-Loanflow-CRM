/**
 * Zero Trust Architecture Implementation
 * Never trust, always verify - every request is authenticated and authorized
 * 
 * SECURITY: Uses server-side encryption via Edge Functions
 */

import { supabase } from "@/integrations/supabase/client";
import { SecurityManager } from "./security";
import { encryptData, decryptData } from "./server-encryption";
import { logger } from "./logger";
import { EnhancedMFA } from "./enhanced-mfa";

export class ZeroTrustManager {
  private static instance: ZeroTrustManager;
  private trustLevels = new Map<string, number>();
  private riskScores = new Map<string, number>();
  private accessPatterns = new Map<string, any[]>();

  private constructor() {
    this.initializeZeroTrust();
  }

  static getInstance(): ZeroTrustManager {
    if (!ZeroTrustManager.instance) {
      ZeroTrustManager.instance = new ZeroTrustManager();
    }
    return ZeroTrustManager.instance;
  }

  private initializeZeroTrust(): void {
    // Initialize continuous verification
    this.startContinuousVerification();
    
    // Initialize behavioral analytics
    this.startBehavioralAnalytics();
    
    // Initialize adaptive access controls
    this.initializeAdaptiveAccess();
  }

  // Continuous identity verification
  private startContinuousVerification(): void {
    setInterval(async () => {
      await this.performIdentityVerification();
    }, 60000); // Every minute
  }

  private async performIdentityVerification(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    const userId = session.user.id;
    
    // Device fingerprint verification
    const currentFingerprint = SecurityManager.generateDeviceFingerprint();
    const { data: storedFingerprintData } = await supabase.rpc('get_secure_session_data', {
      p_key: `device_${userId}`
    });
    const storedFingerprint = storedFingerprintData as string | null;
    
    if (storedFingerprint && storedFingerprint !== currentFingerprint) {
      await this.handleIdentityAnomaly(userId, 'device_fingerprint_mismatch', {
        stored: storedFingerprint,
        current: currentFingerprint
      });
    }
    
    // Location verification
    const locationData = await SecurityManager.getLocationData();
    const { data: lastKnownLocationData } = await supabase.rpc('get_secure_session_data', {
      p_key: `location_${userId}`
    });
    const lastKnownLocation = lastKnownLocationData ? JSON.parse(lastKnownLocationData as string) : null;
    
    if (lastKnownLocation && this.calculateLocationDistance(locationData, lastKnownLocation) > 1000) {
      await this.handleIdentityAnomaly(userId, 'location_anomaly', {
        lastKnown: lastKnownLocation,
        current: locationData
      });
    }
    
    // Update trust level based on verification results
    await this.updateTrustLevel(userId);
  }

  // Behavioral analytics for anomaly detection
  private startBehavioralAnalytics(): void {
    // Monitor user behavior patterns
    this.monitorClickPatterns();
    this.monitorNavigationPatterns();
    this.monitorDataAccessPatterns();
    this.monitorTypingPatterns();
  }

  private monitorClickPatterns(): void {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const clickData = {
        timestamp: Date.now(),
        x: event.clientX,
        y: event.clientY,
        target: target?.tagName,
        button: event.button
      };
      
      this.recordBehavioralData('click_pattern', clickData).catch(() => logger.error('Failed to record click pattern'));
    });
  }

  private monitorNavigationPatterns(): void {
    let lastNavigation = Date.now();
    
    const observer = new MutationObserver(() => {
      const now = Date.now();
      const timeDiff = now - lastNavigation;
      
      this.recordBehavioralData('navigation_pattern', {
        timestamp: now,
        timeSinceLastNav: timeDiff,
        url: window.location.href
      }).catch(() => logger.error('Failed to record navigation pattern'));
      
      lastNavigation = now;
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }

  private monitorDataAccessPatterns(): void {
    // Monitor API calls and data access
    const originalFetch = window.fetch;
    
    window.fetch = async (input, init) => {
      const startTime = Date.now();
      const url = typeof input === 'string' ? input : 
                 input instanceof URL ? input.toString() : 
                 (input as Request).url;
      
      try {
        const response = await originalFetch(input, init);
        
        this.recordBehavioralData('api_access', {
          timestamp: startTime,
          url,
          method: init?.method || 'GET',
          responseTime: Date.now() - startTime,
          status: response.status
        }).catch(() => logger.error('Failed to record API access'));
        
        return response;
      } catch (error: any) {
        this.recordBehavioralData('api_error', {
          timestamp: startTime,
          url,
          error: error.message
        }).catch(() => logger.error('Failed to record API error'));
        throw error;
      }
    };
  }

  private monitorTypingPatterns(): void {
    let keystrokes: number[] = [];
    let lastKeyTime = 0;
    
    document.addEventListener('keydown', () => {
      const now = Date.now();
      
      if (lastKeyTime > 0) {
        const timeDiff = now - lastKeyTime;
        keystrokes.push(timeDiff);
        
        // Keep only last 50 keystrokes
        if (keystrokes.length > 50) {
          keystrokes = keystrokes.slice(-50);
        }
        
        // Analyze every 10 keystrokes
        if (keystrokes.length % 10 === 0) {
          this.analyzeTypingPattern(keystrokes);
        }
      }
      
      lastKeyTime = now;
    });
  }

  private analyzeTypingPattern(keystrokes: number[]): void {
    const avgTime = keystrokes.reduce((a, b) => a + b, 0) / keystrokes.length;
    const variance = keystrokes.reduce((acc, time) => acc + Math.pow(time - avgTime, 2), 0) / keystrokes.length;
    
    this.recordBehavioralData('typing_pattern', {
      timestamp: Date.now(),
      avgKeystrokeTime: avgTime,
      variance: variance,
      pattern: keystrokes.slice(-10) // Last 10 for pattern analysis
    }).catch(() => logger.error('Failed to record typing pattern'));
  }

  private async recordBehavioralData(type: string, data: any): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    const userId = session.user.id;
    const patterns = this.accessPatterns.get(userId) || [];
    
    patterns.push({
      type,
      data,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 patterns
    if (patterns.length > 1000) {
      patterns.splice(0, patterns.length - 1000);
    }
    
    this.accessPatterns.set(userId, patterns);
    
    // Analyze for anomalies
    this.detectBehavioralAnomalies(userId, type, data);
  }

  private async detectBehavioralAnomalies(userId: string, type: string, data: any): Promise<void> {
    const patterns = this.accessPatterns.get(userId) || [];
    const similarPatterns = patterns.filter(p => p.type === type);
    
    if (similarPatterns.length < 10) return; // Need baseline
    
    let anomalyScore = 0;
    
    switch (type) {
      case 'click_pattern':
        anomalyScore = this.analyzeClickAnomaly(similarPatterns, data);
        break;
      case 'navigation_pattern':
        anomalyScore = this.analyzeNavigationAnomaly(similarPatterns, data);
        break;
      case 'api_access':
        anomalyScore = this.analyzeAPIAnomaly(similarPatterns, data);
        break;
      case 'typing_pattern':
        anomalyScore = this.analyzeTypingAnomaly(similarPatterns, data);
        break;
    }
    
    if (anomalyScore > 70) {
      await this.handleBehavioralAnomaly(userId, type, anomalyScore, data);
    }
  }

  private analyzeClickAnomaly(patterns: any[], current: any): number {
    const recentPatterns = patterns.slice(-50);
    const avgX = recentPatterns.reduce((sum, p) => sum + p.data.x, 0) / recentPatterns.length;
    const avgY = recentPatterns.reduce((sum, p) => sum + p.data.y, 0) / recentPatterns.length;
    
    const distance = Math.sqrt(Math.pow(current.x - avgX, 2) + Math.pow(current.y - avgY, 2));
    
    // If click is very far from normal patterns
    return distance > 200 ? 80 : 0;
  }

  private analyzeNavigationAnomaly(patterns: any[], current: any): number {
    const recentTimes = patterns.slice(-20).map(p => p.data.timeSinceLastNav);
    const avgTime = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
    
    // Very fast navigation might indicate automation
    if (current.timeSinceLastNav < avgTime * 0.1) return 90;
    
    // Very slow navigation might indicate account takeover
    if (current.timeSinceLastNav > avgTime * 10) return 70;
    
    return 0;
  }

  private analyzeAPIAnomaly(patterns: any[], current: any): number {
    const recentCalls = patterns.slice(-100);
    const callFrequency = recentCalls.filter(p => 
      Date.now() - p.timestamp < 60000
    ).length;
    
    // Too many API calls in short time
    if (callFrequency > 50) return 95;
    
    // Unusual response times
    const avgResponseTime = recentCalls.reduce((sum, p) => sum + p.data.responseTime, 0) / recentCalls.length;
    if (current.responseTime > avgResponseTime * 5) return 60;
    
    return 0;
  }

  private analyzeTypingAnomaly(patterns: any[], current: any): number {
    const recentPatterns = patterns.slice(-10);
    const avgVariance = recentPatterns.reduce((sum, p) => sum + p.data.variance, 0) / recentPatterns.length;
    
    // Very consistent typing might indicate automation
    if (current.variance < avgVariance * 0.1) return 85;
    
    // Very inconsistent typing might indicate different user
    if (current.variance > avgVariance * 5) return 75;
    
    return 0;
  }

  // Adaptive access controls based on risk
  private initializeAdaptiveAccess(): void {
    // Monitor access requests and adjust controls
    setInterval(async () => {
      await this.adjustAccessControls();
    }, 120000); // Every 2 minutes
  }

  private async adjustAccessControls(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    const userId = session.user.id;
    const riskScore = await this.calculateRiskScore(userId);
    
    this.riskScores.set(userId, riskScore);
    
    // Adjust required authentication methods based on risk using server-side encryption
    const requiredMethods = await EnhancedMFA.getRequiredAuthMethods(riskScore);
    const encryptResult = await encryptData(requiredMethods, 'required_auth');
    if (encryptResult.success && encryptResult.encrypted) {
      await supabase.rpc('store_secure_session_data', {
        p_key: `required_auth_${userId}`,
        p_value: encryptResult.encrypted
      });
    }
    
    // Adjust session timeout based on risk
    const sessionTimeout = this.calculateSessionTimeout(riskScore);
    await supabase.rpc('store_secure_session_data', {
      p_key: `session_timeout_${userId}`,
      p_value: sessionTimeout.toString()
    });
    
    // Trigger additional verification if risk is high
    if (riskScore > 80) {
      await this.triggerAdditionalVerification(userId, riskScore);
    }
  }

  private async calculateRiskScore(userId: string): Promise<number> {
    let riskScore = 0;
    
    // Base risk from trust level
    const trustLevel = this.trustLevels.get(userId) || 50;
    riskScore += (100 - trustLevel) * 0.4;
    
    // Risk from behavioral anomalies
    const patterns = this.accessPatterns.get(userId) || [];
    const recentAnomalies = patterns.filter(p => 
      Date.now() - p.timestamp < 300000 && // Last 5 minutes
      p.data.anomalyScore > 50
    );
    riskScore += recentAnomalies.length * 10;
    
    // Risk from security events - query server-side
    try {
      const { data: recentSecurityEvents } = await supabase
        .from('security_events')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString());
      
      if (recentSecurityEvents) {
        riskScore += recentSecurityEvents.length * 15;
      }
    } catch {
      // Silently fail if unable to fetch security events
    }
    
    // Risk from location/device changes
    const deviceFingerprint = SecurityManager.generateDeviceFingerprint();
    const { data: storedFingerprintData } = await supabase.rpc('get_secure_session_data', {
      p_key: `device_${userId}`
    });
    const storedFingerprint = storedFingerprintData as string | null;
    if (storedFingerprint && deviceFingerprint !== storedFingerprint) {
      riskScore += 25;
    }
    
    // Risk from time of access
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour > 22) {
      riskScore += 10;
    }
    
    return Math.min(100, riskScore);
  }

  private calculateSessionTimeout(riskScore: number): number {
    // Higher risk = shorter session timeout
    if (riskScore > 80) return 5 * 60 * 1000; // 5 minutes
    if (riskScore > 60) return 15 * 60 * 1000; // 15 minutes
    if (riskScore > 40) return 30 * 60 * 1000; // 30 minutes
    if (riskScore > 20) return 60 * 60 * 1000; // 1 hour
    
    return 4 * 60 * 60 * 1000; // 4 hours for low risk
  }

  // Handle various types of anomalies
  private async handleIdentityAnomaly(userId: string, type: string, details: any): Promise<void> {
    const severity = this.getAnomalySeverity(type);
    
    // Log to security_events table
    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: `identity_anomaly_${type}`,
      severity: severity >= 8 ? 'critical' : severity >= 5 ? 'high' : 'medium',
      details: {
        severity,
        details,
        timestamp: new Date().toISOString()
      }
    });
    
    // Reduce trust level
    const currentTrust = this.trustLevels.get(userId) || 50;
    this.trustLevels.set(userId, Math.max(0, currentTrust - severity * 10));
    
    // Trigger additional verification for high severity
    if (severity >= 8) {
      await this.triggerAdditionalVerification(userId, severity * 10);
    }
  }

  private async handleBehavioralAnomaly(userId: string, type: string, anomalyScore: number, data: any): Promise<void> {
    // Log to security_events table
    await supabase.from('security_events').insert({
      user_id: userId,
      event_type: `behavioral_anomaly_${type}`,
      severity: anomalyScore >= 80 ? 'critical' : anomalyScore >= 60 ? 'high' : 'medium',
      details: {
        anomalyScore,
        data,
        timestamp: new Date().toISOString()
      }
    });
    
    // Record anomaly in behavioral data
    const patterns = this.accessPatterns.get(userId) || [];
    patterns.push({
      type: `${type}_anomaly`,
      data: { ...data, anomalyScore },
      timestamp: Date.now()
    });
    this.accessPatterns.set(userId, patterns);
  }

  private async triggerAdditionalVerification(userId: string, riskScore: number): Promise<void> {
    const requiredMethods = await EnhancedMFA.getRequiredAuthMethods(riskScore);
    
    // Store verification requirement server-side using secure encryption
    const verificationData = {
      methods: requiredMethods,
      riskScore,
      timestamp: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
    };
    
    const encryptResult = await encryptData(verificationData, 'pending_verification');
    if (encryptResult.success && encryptResult.encrypted) {
      await supabase.rpc('store_secure_session_data', {
        p_key: `pending_verification_${userId}`,
        p_value: encryptResult.encrypted
      });
    }
    
    // Notify user
    this.notifyAdditionalVerificationRequired(requiredMethods);
  }

  private notifyAdditionalVerificationRequired(methods: string[]): void {
    // In production, show modal or redirect to verification page
    logger.warn('Additional verification required', { methods });
  }

  private getAnomalySeverity(type: string): number {
    const severityMap: Record<string, number> = {
      'device_fingerprint_mismatch': 8,
      'location_anomaly': 6,
      'time_anomaly': 4,
      'behavioral_anomaly': 7,
      'rapid_requests': 9,
      'privilege_escalation': 10
    };
    
    return severityMap[type] || 5;
  }

  private calculateLocationDistance(loc1: any, loc2: any): number {
    if (!loc1.latitude || !loc2.latitude) return 0;
    
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(loc2.latitude - loc1.latitude);
    const dLon = this.toRadians(loc2.longitude - loc1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(loc1.latitude)) * Math.cos(this.toRadians(loc2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async updateTrustLevel(userId: string): Promise<void> {
    // Update trust level based on successful verifications
    const currentTrust = this.trustLevels.get(userId) || 50;
    // Gradually increase trust with successful verifications (max 100)
    this.trustLevels.set(userId, Math.min(100, currentTrust + 1));
  }
}

// Export singleton instance
export const zeroTrustManager = ZeroTrustManager.getInstance();
