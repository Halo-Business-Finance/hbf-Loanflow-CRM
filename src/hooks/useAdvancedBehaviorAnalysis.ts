import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BehaviorPattern {
  id: string;
  pattern_type: string;
  baseline_metrics: Record<string, any>;
  current_metrics: Record<string, any>;
  anomaly_score: number;
  is_anomalous: boolean;
  deviation_factors: string[];
  last_analysis: string;
}

interface SessionBehavior {
  login_hour: number;
  session_duration_minutes: number;
  country: string;
  device_fingerprint: string;
  click_patterns: number[];
  typing_patterns: number[];
  mouse_movement_variance: number;
  [key: string]: any; // Make it Json-compatible
}

interface AnomalyResult {
  is_anomalous: boolean;
  anomaly_score: number;
  deviation_factors: string[];
  requires_additional_verification: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export const useAdvancedBehaviorAnalysis = () => {
  const [behaviorPatterns, setBehaviorPatterns] = useState<BehaviorPattern[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionBehavior | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  // Initialize session tracking
  useEffect(() => {
    const initializeSession = () => {
      const sessionStart = Date.now();
      const loginHour = new Date().getHours();
      
      // Generate device fingerprint
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Fingerprint test', 2, 2);
      }
      
      const fingerprint = `${navigator.userAgent}_${screen.width}x${screen.height}_${navigator.language}_${canvas.toDataURL()}`.slice(0, 100);
      
      setCurrentSession({
        login_hour: loginHour,
        session_duration_minutes: 0,
        country: 'US', // This would normally come from IP geolocation
        device_fingerprint: fingerprint,
        click_patterns: [],
        typing_patterns: [],
        mouse_movement_variance: 0
      });
    };

    initializeSession();
  }, []);

  // Track user behavior patterns
  useEffect(() => {
    let clickTimes: number[] = [];
    let keyTimes: number[] = [];
    let mousePositions: { x: number; y: number; time: number }[] = [];

    const trackClick = (e: MouseEvent) => {
      clickTimes.push(Date.now());
      if (clickTimes.length > 10) clickTimes.shift();
    };

    const trackKeypress = (e: KeyboardEvent) => {
      keyTimes.push(Date.now());
      if (keyTimes.length > 20) keyTimes.shift();
    };

    const trackMouseMove = (e: MouseEvent) => {
      mousePositions.push({ x: e.clientX, y: e.clientY, time: Date.now() });
      if (mousePositions.length > 50) mousePositions.shift();
    };

    document.addEventListener('click', trackClick);
    document.addEventListener('keypress', trackKeypress);
    document.addEventListener('mousemove', trackMouseMove);

    // Update session metrics every 30 seconds
    const interval = setInterval(() => {
      if (currentSession) {
        const clickIntervals = clickTimes.slice(1).map((time, i) => time - clickTimes[i]);
        const keyIntervals = keyTimes.slice(1).map((time, i) => time - keyTimes[i]);
        
        // Calculate mouse movement variance
        const mouseVariance = mousePositions.length > 1 ? 
          mousePositions.reduce((acc, pos, i) => {
            if (i === 0) return acc;
            const prev = mousePositions[i - 1];
            const distance = Math.sqrt(Math.pow(pos.x - prev.x, 2) + Math.pow(pos.y - prev.y, 2));
            return acc + distance;
          }, 0) / mousePositions.length : 0;

        setCurrentSession(prev => prev ? {
          ...prev,
          session_duration_minutes: (Date.now() - (prev.login_hour * 60 * 60 * 1000)) / (1000 * 60),
          click_patterns: clickIntervals,
          typing_patterns: keyIntervals,
          mouse_movement_variance: mouseVariance
        } : null);
      }
    }, 30000);

    return () => {
      document.removeEventListener('click', trackClick);
      document.removeEventListener('keypress', trackKeypress);
      document.removeEventListener('mousemove', trackMouseMove);
      clearInterval(interval);
    };
  }, [currentSession?.login_hour]);

  // Fetch existing behavior patterns
  const fetchBehaviorPatterns = useCallback(async () => {
    try {
      // Use security_events table since user_behavior_patterns may not have the expected structure
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'behavioral_anomaly')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Transform security events to behavior patterns
      const transformedPatterns: BehaviorPattern[] = (data || []).map(record => ({
        id: record.id,
        pattern_type: 'behavioral_anomaly',
        baseline_metrics: (record.details as any)?.baseline_metrics || {},
        current_metrics: (record.details as any)?.current_session || {},
        anomaly_score: (record.details as any)?.anomaly_score || 0,
        is_anomalous: true,
        deviation_factors: (record.details as any)?.deviation_factors || [],
        last_analysis: record.created_at || ''
      }));

      setBehaviorPatterns(transformedPatterns);
    } catch (error) {
      console.error('Error fetching behavior patterns:', error);
    }
  }, []);

  // Analyze current session for anomalies
  const analyzeCurrentSession = useCallback(async (): Promise<AnomalyResult> => {
    if (!currentSession) {
      return {
        is_anomalous: false,
        anomaly_score: 0,
        deviation_factors: [],
        requires_additional_verification: false,
        risk_level: 'low'
      };
    }

    setIsAnalyzing(true);
    
    try {
      // Get user's baseline behavior pattern
      const userBaseline = behaviorPatterns.find(p => p.pattern_type === 'session_behavior');
      
      let anomalyScore = 0;
      const deviationFactors: string[] = [];

      if (userBaseline) {
        const baseline = userBaseline.baseline_metrics;
        
        // Analyze login time deviation
        const typicalLoginHours = baseline.typical_login_hours || [];
        if (!typicalLoginHours.includes(currentSession.login_hour)) {
          anomalyScore += 25;
          deviationFactors.push('unusual_login_time');
        }

        // Analyze session duration
        const avgDuration = baseline.avg_session_duration || 60;
        if (currentSession.session_duration_minutes > avgDuration * 2) {
          anomalyScore += 20;
          deviationFactors.push('extended_session');
        }

        // Analyze click patterns
        const avgClickInterval = baseline.avg_click_interval || 2000;
        const currentAvgClick = currentSession.click_patterns.length > 0 
          ? currentSession.click_patterns.reduce((a, b) => a + b, 0) / currentSession.click_patterns.length 
          : 2000;
        
        if (Math.abs(currentAvgClick - avgClickInterval) > 1000) {
          anomalyScore += 15;
          deviationFactors.push('unusual_click_pattern');
        }

        // Analyze typing patterns
        const avgTypingInterval = baseline.avg_typing_interval || 150;
        const currentAvgTyping = currentSession.typing_patterns.length > 0
          ? currentSession.typing_patterns.reduce((a, b) => a + b, 0) / currentSession.typing_patterns.length
          : 150;

        if (Math.abs(currentAvgTyping - avgTypingInterval) > 100) {
          anomalyScore += 15;
          deviationFactors.push('unusual_typing_pattern');
        }

        // Analyze mouse movement
        const avgMouseVariance = baseline.avg_mouse_variance || 50;
        if (Math.abs(currentSession.mouse_movement_variance - avgMouseVariance) > 30) {
          anomalyScore += 10;
          deviationFactors.push('unusual_mouse_behavior');
        }

        // Check for bot-like behavior (too consistent patterns)
        const clickVariance = currentSession.click_patterns.length > 1 
          ? Math.sqrt(currentSession.click_patterns.reduce((acc, val) => {
              const mean = currentAvgClick;
              return acc + Math.pow(val - mean, 2);
            }, 0) / currentSession.click_patterns.length) : 100;

        if (clickVariance < 10) { // Too consistent, might be a bot
          anomalyScore += 30;
          deviationFactors.push('bot_like_consistency');
        }
      }

      const isAnomalous = anomalyScore > 50;
      let riskLevel: AnomalyResult['risk_level'] = 'low';
      
      if (anomalyScore >= 80) riskLevel = 'critical';
      else if (anomalyScore >= 60) riskLevel = 'high';
      else if (anomalyScore >= 30) riskLevel = 'medium';

      // Log anomaly if detected
      if (isAnomalous) {
        await supabase.from('security_events').insert({
          event_type: 'behavioral_anomaly',
          severity: riskLevel === 'critical' ? 'critical' : riskLevel === 'high' ? 'high' : 'medium',
          details: {
            anomaly_score: anomalyScore,
            deviation_factors: deviationFactors,
            current_session: currentSession as any
          } as any
        });

        toast({
          title: "Behavioral Anomaly Detected",
          description: `Anomaly score: ${anomalyScore}. Additional verification may be required.`,
          variant: riskLevel === 'critical' ? 'destructive' : 'default',
        });
      }

      const result: AnomalyResult = {
        is_anomalous: isAnomalous,
        anomaly_score: anomalyScore,
        deviation_factors: deviationFactors,
        requires_additional_verification: anomalyScore > 70,
        risk_level: riskLevel
      };

      setIsAnalyzing(false);
      return result;
    } catch (error) {
      console.error('Error analyzing behavior:', error);
      setIsAnalyzing(false);
      
      return {
        is_anomalous: false,
        anomaly_score: 0,
        deviation_factors: ['analysis_error'],
        requires_additional_verification: false,
        risk_level: 'low'
      };
    }
  }, [currentSession, behaviorPatterns, toast]);

  // Update baseline patterns
  const updateBaseline = useCallback(async () => {
    if (!currentSession) return;

    try {
      const avgClickInterval = currentSession.click_patterns.length > 0
        ? currentSession.click_patterns.reduce((a, b) => a + b, 0) / currentSession.click_patterns.length
        : 2000;
      
      const avgTypingInterval = currentSession.typing_patterns.length > 0
        ? currentSession.typing_patterns.reduce((a, b) => a + b, 0) / currentSession.typing_patterns.length
        : 150;

      const baselineMetrics = {
        typical_login_hours: [currentSession.login_hour],
        avg_session_duration: currentSession.session_duration_minutes,
        avg_click_interval: avgClickInterval,
        avg_typing_interval: avgTypingInterval,
        avg_mouse_variance: currentSession.mouse_movement_variance,
        device_pattern: currentSession.device_fingerprint.slice(0, 20),
        typical_country: currentSession.country
      };

      // Log baseline update as security event for now
      const { error } = await supabase
        .from('security_events')
        .insert({
          event_type: 'behavior_baseline_update',
          severity: 'low',
          details: {
            baseline_metrics: baselineMetrics,
            current_session: currentSession
          } as any
        });

      if (error) throw error;
      
      await fetchBehaviorPatterns();
    } catch (error) {
      console.error('Error updating baseline:', error);
    }
  }, [currentSession, fetchBehaviorPatterns]);

  useEffect(() => {
    fetchBehaviorPatterns();
  }, [fetchBehaviorPatterns]);

  return {
    behaviorPatterns,
    currentSession,
    isAnalyzing,
    analyzeCurrentSession,
    updateBaseline,
    fetchBehaviorPatterns
  };
};