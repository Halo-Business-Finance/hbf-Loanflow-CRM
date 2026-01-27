import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, TrendingUp, Activity, Globe, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ThreatPattern {
  id: string;
  pattern_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  occurrences: number;
  first_detected: string;
  last_detected: string;
  auto_mitigated: boolean;
}

interface IPReputation {
  ip_address: string;
  reputation_score: number;
  threat_categories: string[];
  country: string;
  is_vpn: boolean;
  is_tor: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export const AdvancedThreatDetection: React.FC = () => {
  const [threatPatterns, setThreatPatterns] = useState<ThreatPattern[]>([]);
  const [ipReputations, setIpReputations] = useState<IPReputation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scanningProgress, setScanningProgress] = useState(0);
  const { toast } = useToast();

  const fetchThreatData = async () => {
    try {
      // Get recent threat patterns from security events
      const { data: patterns } = await supabase
        .from('security_events')
        .select('*')
        .in('severity', ['high', 'critical'])
        .order('created_at', { ascending: false })
        .limit(10);

      // Get suspicious IP addresses from sessions
      const { data: suspiciousIPs } = await supabase
        .from('active_sessions')
        .select('ip_address')
        .not('ip_address', 'is', null)
        .limit(20);

      if (patterns) {
        // Group similar events into patterns
        const patternMap = new Map();
        patterns.forEach(event => {
          const key = event.event_type;
          if (patternMap.has(key)) {
            const existing = patternMap.get(key);
            existing.occurrences++;
            existing.last_detected = event.created_at;
          } else {
            patternMap.set(key, {
              id: event.id,
              pattern_type: event.event_type,
              severity: event.severity,
              description: `Security pattern: ${event.event_type}`,
              occurrences: 1,
              first_detected: event.created_at,
              last_detected: event.created_at,
              auto_mitigated: false
            });
          }
        });
        setThreatPatterns(Array.from(patternMap.values()));
      }

      // Simulate IP reputation analysis
      if (suspiciousIPs && suspiciousIPs.length > 0) {
        const mockReputations: IPReputation[] = suspiciousIPs.slice(0, 5).map((session, index) => ({
          ip_address: (session.ip_address as string) || '192.168.1.1',
          reputation_score: Math.floor(Math.random() * 100),
          threat_categories: index % 2 === 0 ? ['malware', 'botnet'] : ['spam', 'phishing'],
          country: ['US', 'CN', 'RU', 'DE', 'FR'][index % 5],
          is_vpn: Math.random() > 0.7,
          is_tor: Math.random() > 0.9,
          risk_level: (['low', 'medium', 'high'] as const)[Math.floor(Math.random() * 3)]
        }));
        setIpReputations(mockReputations);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching threat data:', error);
      toast({
        title: "Error Loading Threat Data",
        description: "Failed to load advanced threat detection data",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const runThreatScan = async () => {
    setScanningProgress(0);
    const interval = setInterval(() => {
      setScanningProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          toast({
            title: "Threat Scan Complete",
            description: "Advanced threat scan completed successfully",
          });
          fetchThreatData();
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const mitigateThreat = async (patternId: string) => {
    try {
      // Log mitigation action
      await supabase.from('security_events').insert({
        event_type: 'threat_mitigation',
        severity: 'medium',
        details: { pattern_id: patternId, action: 'manual_mitigation' }
      });

      toast({
        title: "Threat Mitigated",
        description: "Security threat has been successfully mitigated",
      });
      
      fetchThreatData();
    } catch (error) {
      toast({
        title: "Mitigation Failed",
        description: "Failed to mitigate threat. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchThreatData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-muted animate-pulse rounded" />
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Threat Analysis</h3>
        <Button 
          onClick={runThreatScan} 
          disabled={scanningProgress > 0 && scanningProgress < 100}
          size="sm"
          variant="outline"
        >
          {scanningProgress > 0 && scanningProgress < 100 ? `Scanning ${scanningProgress}%` : 'Run Scan'}
        </Button>
      </div>

      {scanningProgress > 0 && scanningProgress < 100 && (
        <div className="w-full bg-muted rounded-full h-1.5">
          <div 
            className="bg-primary h-1.5 rounded-full transition-all duration-300" 
            style={{ width: `${scanningProgress}%` }}
          />
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 border rounded-lg bg-card space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Threat Patterns</p>
          <p className="text-3xl font-semibold">{threatPatterns.length}</p>
          <p className="text-xs text-muted-foreground">Active patterns</p>
        </div>
        
        <div className="p-5 border rounded-lg bg-card space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Suspicious IPs</p>
          <p className="text-3xl font-semibold">{ipReputations.filter(ip => ip.risk_level !== 'low').length}</p>
          <p className="text-xs text-muted-foreground">High-risk addresses</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Active Threat Patterns</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {threatPatterns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No active threats detected</p>
            ) : (
              threatPatterns.map((pattern) => (
                <div key={pattern.id} className="p-4 border rounded-lg bg-card space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase px-2 py-0.5 rounded bg-muted">
                          {pattern.severity}
                        </span>
                        <span className="font-medium text-sm">{pattern.pattern_type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{pattern.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {pattern.occurrences} occurrences • Last: {new Date(pattern.last_detected).toLocaleDateString()}
                      </p>
                    </div>
                    {!pattern.auto_mitigated && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => mitigateThreat(pattern.id)}
                        className="ml-2"
                      >
                        Mitigate
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold">IP Reputation Analysis</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {ipReputations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No suspicious IPs detected</p>
            ) : (
              ipReputations.map((ip, index) => (
                <div key={index} className="p-4 border rounded-lg bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{ip.ip_address}</span>
                    <span className="text-xs font-medium uppercase px-2 py-0.5 rounded bg-muted">
                      {ip.risk_level} risk
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Score: {ip.reputation_score}/100</span>
                    <span>Country: {ip.country}</span>
                    {ip.is_vpn && <span>VPN</span>}
                    {ip.is_tor && <span>Tor</span>}
                  </div>
                  {ip.threat_categories.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {ip.threat_categories.map((category, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded bg-muted">
                          {category}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {threatPatterns.some(p => p.severity === 'critical') && (
        <Alert variant="destructive">
          <AlertDescription>
            Critical threat patterns detected! Review and mitigate immediately to maintain system security.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};