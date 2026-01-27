import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SecureLogger } from '../_shared/secure-logger.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/rate-limit.ts';

const logger = new SecureLogger('scan-document');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScanRequest {
  file_hash: string;
  file_name: string;
  file_size: number;
  document_id?: string;
}

interface ScanResult {
  is_safe: boolean;
  scan_id: string;
  threats_found: string[];
  scan_date: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(supabase, user.id, RATE_LIMITS.SCAN_DOCUMENT);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for document scan', { userId: user.id });
      return new Response(
        JSON.stringify({ error: rateLimitResult.error }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { file_hash, file_name, file_size, document_id } = await req.json() as ScanRequest;
    
    if (!file_hash) {
      return new Response(
        JSON.stringify({ error: 'File hash is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Document scan requested', { 
      fileName: file_name?.substring(0, 20),
      fileSize: file_size 
    });

    // Check if we have a cached scan result for this hash
    const { data: cachedScan } = await supabase
      .from('document_scan_results')
      .select('*')
      .eq('file_hash', file_hash)
      .gte('scanned_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24 hour cache
      .single();

    if (cachedScan) {
      logger.info('Using cached scan result', { scanId: cachedScan.scan_id });
      return new Response(
        JSON.stringify({
          is_safe: cachedScan.is_safe,
          scan_id: cachedScan.scan_id,
          threats_found: cachedScan.threats_found || [],
          scan_date: cachedScan.scanned_at,
          confidence: cachedScan.confidence,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check VirusTotal API if configured
    const VIRUSTOTAL_API_KEY = Deno.env.get('VIRUSTOTAL_API_KEY');
    
    let scanResult: ScanResult;
    
    if (VIRUSTOTAL_API_KEY) {
      // Query VirusTotal for file hash
      const vtResponse = await fetch(`https://www.virustotal.com/api/v3/files/${file_hash}`, {
        headers: {
          'x-apikey': VIRUSTOTAL_API_KEY,
        },
      });

      if (vtResponse.ok) {
        const vtData = await vtResponse.json();
        const stats = vtData.data?.attributes?.last_analysis_stats || {};
        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;
        const undetected = stats.undetected || 0;
        const harmless = stats.harmless || 0;
        
        const totalScans = malicious + suspicious + undetected + harmless;
        const threatCount = malicious + suspicious;
        
        // Calculate confidence based on number of engines that scanned
        const confidence = totalScans > 0 ? Math.min(100, (totalScans / 70) * 100) : 50;
        
        // Get threat names if any
        const threatNames: string[] = [];
        const results = vtData.data?.attributes?.last_analysis_results || {};
        for (const [engine, result] of Object.entries(results)) {
          const r = result as any;
          if (r.category === 'malicious' || r.category === 'suspicious') {
            threatNames.push(`${engine}: ${r.result || 'Threat detected'}`);
          }
        }

        scanResult = {
          is_safe: threatCount === 0,
          scan_id: vtData.data?.id || file_hash,
          threats_found: threatNames.slice(0, 10), // Limit to 10 threats
          scan_date: new Date().toISOString(),
          confidence: Math.round(confidence),
        };

        logger.info('VirusTotal scan complete', { 
          isSafe: scanResult.is_safe, 
          threatCount 
        });
      } else if (vtResponse.status === 404) {
        // File not found in VirusTotal - consider it unknown
        scanResult = {
          is_safe: true, // Assume safe if not in VT database
          scan_id: `unknown-${file_hash.substring(0, 16)}`,
          threats_found: [],
          scan_date: new Date().toISOString(),
          confidence: 30, // Low confidence since not scanned
        };
        
        logger.info('File not found in VirusTotal database', { fileHash: file_hash.substring(0, 16) });
      } else {
        logger.error('VirusTotal API error', new Error(`Status: ${vtResponse.status}`));
        throw new Error('Failed to scan file');
      }
    } else {
      // No VirusTotal API key - use basic heuristics
      logger.warn('VirusTotal API key not configured, using basic scan');
      
      // Basic file extension check
      const dangerousExtensions = ['.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jar', '.msi'];
      const fileName = file_name?.toLowerCase() || '';
      const hasDangerousExtension = dangerousExtensions.some(ext => fileName.endsWith(ext));
      
      // Check file size anomalies
      const fileSizeAnomaly = file_size > 100 * 1024 * 1024; // Over 100MB
      
      scanResult = {
        is_safe: !hasDangerousExtension && !fileSizeAnomaly,
        scan_id: `basic-${file_hash.substring(0, 16)}`,
        threats_found: hasDangerousExtension ? ['Potentially dangerous file extension'] : [],
        scan_date: new Date().toISOString(),
        confidence: 40, // Low confidence for basic scan
      };
    }

    // Cache the scan result
    await supabase
      .from('document_scan_results')
      .upsert({
        file_hash,
        file_name: file_name?.substring(0, 255),
        file_size,
        is_safe: scanResult.is_safe,
        scan_id: scanResult.scan_id,
        threats_found: scanResult.threats_found,
        confidence: scanResult.confidence,
        scanned_at: scanResult.scan_date,
        scanned_by: user.id,
        document_id,
      });

    // Log security event for threats
    if (!scanResult.is_safe) {
      await supabase
        .from('security_events')
        .insert({
          user_id: user.id,
          event_type: 'malware_detected',
          severity: 'critical',
          details: {
            file_hash,
            file_name: file_name?.substring(0, 100),
            threats: scanResult.threats_found,
            scan_id: scanResult.scan_id,
          }
        });
      
      logger.warn('Malware detected in uploaded document', { 
        scanId: scanResult.scan_id,
        threatCount: scanResult.threats_found.length 
      });
    }

    return new Response(
      JSON.stringify(scanResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Document scan error', error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ 
        error: 'Failed to scan document',
        is_safe: false,
        confidence: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
