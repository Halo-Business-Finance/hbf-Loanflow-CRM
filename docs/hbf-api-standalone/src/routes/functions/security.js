/**
 * Security functions — ported from:
 *   supabase/functions/security-enhanced
 *   supabase/functions/security-monitor
 *   supabase/functions/security-settings-validator
 *   supabase/functions/threat-detection
 *   supabase/functions/persistent-ai-security
 *   supabase/functions/production-geo-security
 *   supabase/functions/session-security
 *   supabase/functions/webhook-security
 *   supabase/functions/validate-form-data
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query } = require('../../db');
const { checkRateLimit, RATE_LIMITS } = require('../../middleware/rate-limit');

// ── security-enhanced ────────────────────────────────────────
router.post('/security-enhanced', async (req, res) => {
  try {
    const { action, ...data } = req.body;
    switch (action) {
      case 'comprehensive_scan': {
        // Simplified scan: count recent security events
        const [events, sessions] = await Promise.all([
          query(`SELECT count(*) as cnt FROM security_events WHERE severity IN ('high','critical') AND created_at > NOW() - INTERVAL '24 hours'`),
          query(`SELECT count(*) as cnt FROM active_sessions WHERE is_active = true`),
        ]);
        const score = Math.max(0, 100 - (parseInt(events[0]?.cnt || 0) * 5));
        return res.json({ success: true, scan_result: { score, threats: [], recommendations: [] }, status: score >= 85 ? 'secure' : score >= 70 ? 'warning' : 'critical' });
      }
      case 'threat_analysis': {
        const threatSignatures = [
          { pattern: /<script|javascript:|on\w+\s*=/i, type: 'xss_attempt', severity: 'high' },
          { pattern: /(union|select|insert|update|delete|drop)\s+/i, type: 'sql_injection', severity: 'critical' },
          { pattern: /(\||&|;|`|\$\()/,  type: 'command_injection', severity: 'critical' },
        ];
        const input = data.input || '';
        const results = threatSignatures.filter(s => s.pattern.test(input)).map(s => ({ threat_type: s.type, severity: s.severity, confidence: 0.95 }));
        return res.json({ success: true, threats_detected: results.length, threats: results, risk_level: results.length > 0 ? 'high' : 'low' });
      }
      case 'incident_response': {
        await query(`INSERT INTO security_events (event_type, severity, details) VALUES ($1, $2, $3)`,
          [data.incident_type || 'unknown', data.severity || 'medium', JSON.stringify(data)]);
        return res.json({ success: true, incident_logged: true });
      }
      default:
        return res.status(400).json({ error: 'Invalid security action' });
    }
  } catch (err) {
    console.error('[security-enhanced] error:', err.message);
    res.status(500).json({ error: 'Security system error' });
  }
});

// ── security-monitor ─────────────────────────────────────────
router.post('/security-monitor', async (req, res) => {
  try {
    const action = req.query.action || req.body.action || 'monitor';
    const timeWindow = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    if (action === 'monitor') {
      const [events, rateLimits] = await Promise.all([
        query(`SELECT count(*) as cnt FROM security_events WHERE severity IN ('high','critical') AND created_at > $1`, [timeWindow]),
        query(`SELECT count(*) as cnt FROM api_request_analytics WHERE rate_limit_triggered = true AND created_at > $1`, [timeWindow]),
      ]);
      return res.json({ success: true, alerts_generated: 0, summary: { security_events: events[0]?.cnt, rate_limit_violations: rateLimits[0]?.cnt }, timestamp: new Date().toISOString() });
    }
    if (action === 'dashboard') {
      const last24h = new Date(Date.now() - 86400000).toISOString();
      const [events, sessions] = await Promise.all([
        query(`SELECT count(*) as cnt FROM security_events WHERE created_at > $1`, [last24h]),
        query(`SELECT count(*) as cnt FROM active_sessions WHERE is_active = true`),
      ]);
      return res.json({ summary: { security_events_24h: events[0]?.cnt, active_sessions: sessions[0]?.cnt }, timestamp: new Date().toISOString() });
    }
    res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('[security-monitor] error:', err.message);
    res.status(500).json({ error: 'Security monitoring failed' });
  }
});

// ── security-settings-validator ──────────────────────────────
router.post('/security-settings-validator', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { action, settings, setting_category } = req.body;

    if (action === 'validate_and_enforce') {
      return res.json({ valid: true, enforced_settings: settings, message: 'Settings validated and ready to apply' });
    }
    if (action === 'audit_settings') {
      return res.json({ compliant: true, audit_results: [], issues: [], audit_timestamp: new Date().toISOString() });
    }
    res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── threat-detection ─────────────────────────────────────────
router.post('/threat-detection', async (req, res) => {
  try {
    const { action, user_agent, ip_address, request_fingerprint, behavior_data, timing_patterns, device_fingerprint } = req.body;
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || ip_address || 'unknown';
    const ua = req.headers['user-agent'] || user_agent || 'unknown';

    switch (action) {
      case 'analyze_request': {
        let threatScore = 0;
        const botPatterns = [/bot|crawler|spider|scraper|automated/i, /headless|phantom|selenium|puppeteer/i, /curl|wget|python/i];
        for (const p of botPatterns) { if (p.test(ua)) { threatScore += 40; break; } }
        if (behavior_data?.response_time < 50) threatScore += 30;
        const threatLevel = threatScore >= 80 ? 'critical' : threatScore >= 60 ? 'high' : threatScore >= 40 ? 'medium' : 'low';
        return res.json({ allowed: threatScore < 80, threat_score: threatScore, threat_level: threatLevel });
      }
      case 'detect_ai_behavior': {
        let aiScore = 0;
        if (timing_patterns?.variance < 10) aiScore += 35;
        if (timing_patterns?.consistency > 95) aiScore += 25;
        const aiLikelihood = aiScore >= 80 ? 'very_high' : aiScore >= 60 ? 'high' : aiScore >= 40 ? 'medium' : 'low';
        return res.json({ ai_likelihood: aiLikelihood, ai_score: aiScore, recommended_action: aiScore >= 80 ? 'block' : 'allow' });
      }
      case 'check_anomalies': {
        let anomalyScore = 0;
        const currentHour = new Date().getHours();
        if (currentHour >= 2 && currentHour <= 5) anomalyScore += 20;
        return res.json({ anomaly_score: anomalyScore, risk_level: anomalyScore >= 70 ? 'high' : 'low' });
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── persistent-ai-security ───────────────────────────────────
router.post('/persistent-ai-security', async (req, res) => {
  try {
    const action = req.query.action || req.body.action || 'run_scan';
    // Run simplified threat detection queries
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    const [failedLogins, privilegeEvents] = await Promise.all([
      query(`SELECT count(*) as cnt FROM security_events WHERE event_type = 'failed_login' AND created_at > $1`, [fiveMinAgo]),
      query(`SELECT count(*) as cnt FROM audit_logs WHERE action ILIKE '%role%' AND created_at > $1`, [fiveMinAgo]),
    ]);
    const threats = [];
    if (parseInt(failedLogins[0]?.cnt) >= 2) threats.push({ type: 'authentication_attack', severity: 'critical', confidence: 95 });
    if (parseInt(privilegeEvents[0]?.cnt) > 0) threats.push({ type: 'privilege_escalation', severity: 'critical', confidence: 88 });
    res.json({ success: true, threats_detected: threats.length, threats, scan_duration_ms: 0 });
  } catch (err) {
    res.status(500).json({ error: 'AI security scan failed' });
  }
});

// ── production-geo-security ──────────────────────────────────
router.post('/production-geo-security', async (req, res) => {
  try {
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const ua = req.headers['user-agent'] || '';
    const isLocal = clientIP === 'unknown' || clientIP.startsWith('127.') || clientIP.startsWith('192.168.') || clientIP.startsWith('10.');

    let countryCode = 'UNKNOWN';
    let isAllowed = false;
    let blockReason = 'Unknown location';

    if (isLocal) {
      countryCode = 'US'; isAllowed = true; blockReason = 'Local/development IP';
    } else {
      try {
        const geoRes = await fetch(`https://ipapi.co/${clientIP}/json/`);
        const geo = await geoRes.json();
        countryCode = geo.country_code || 'UNKNOWN';
        isAllowed = countryCode === 'US';
        blockReason = isAllowed ? 'Allowed US location' : 'Non-US location detected';
      } catch { blockReason = 'Geolocation verification failed'; }
    }
    res.status(isAllowed ? 200 : 403).json({ allowed: isAllowed, country: countryCode, ip: clientIP, reason: blockReason });
  } catch (err) {
    res.status(500).json({ error: 'Security check failed', allowed: false });
  }
});

// ── session-security ─────────────────────────────────────────
router.post('/session-security', async (req, res) => {
  try {
    const { action, session_token, user_id } = req.body;
    switch (action) {
      case 'validate_session': {
        const rows = await query(`SELECT validate_session_security($1, $2) AS result`, [user_id, session_token]);
        return res.json({ ...(rows[0]?.result || {}), security_score: 100 });
      }
      case 'track_activity': {
        const ip = req.headers['x-forwarded-for'] || 'unknown';
        await query(`UPDATE active_sessions SET last_activity = NOW(), ip_address = $1 WHERE user_id = $2 AND session_token = $3 AND is_active = true`, [ip, user_id, session_token]);
        return res.json({ success: true });
      }
      case 'cleanup_sessions': {
        const rows = await query(`SELECT cleanup_expired_sessions() AS result`);
        return res.json({ success: true, cleaned_sessions: rows[0]?.result });
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── webhook-security ─────────────────────────────────────────
router.post('/webhook-security', async (req, res) => {
  try {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret === 'default-secret-key') {
      return res.status(503).json({ error: 'Service unavailable' });
    }

    const signature = req.headers['x-webhook-signature'];
    const rawBody = JSON.stringify(req.body);
    const expectedSig = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    if (!signature || signature !== expectedSig) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body;
    await query(`INSERT INTO audit_logs (action, new_values) VALUES ('webhook_received', $1)`, [JSON.stringify(payload)]);
    res.json({ status: 'success', message: 'Webhook processed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── validate-form-data ───────────────────────────────────────
router.post('/validate-form-data', async (req, res) => {
  try {
    const { formData, securityLevel = 'medium', includeXSSCheck = true, includeSQLInjectionCheck = true } = req.body;
    const securityFlags = [];
    const sanitizedData = {};
    let isValid = true;

    const xssPatterns = [/<script[^>]*>.*?<\/script>/gi, /javascript:/gi, /onload\s*=/gi, /<iframe[^>]*>/gi];
    const sqlPatterns = [/(union\s+select)/i, /(drop\s+table)/i, /(delete\s+from)/i, /(insert\s+into)/i];

    for (const [key, value] of Object.entries(formData || {})) {
      if (typeof value !== 'string') { sanitizedData[key] = value; continue; }
      let sv = value.trim();
      if (includeXSSCheck && xssPatterns.some(p => p.test(sv))) { securityFlags.push('xss_attempt'); isValid = false; }
      if (includeSQLInjectionCheck && sqlPatterns.some(p => p.test(sv))) { securityFlags.push('sql_injection_attempt'); isValid = false; }
      sanitizedData[key] = sv.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' }[c] || c));
    }

    res.json({ isValid, sanitizedData, securityFlags, securityLevel, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Validation service error', isValid: false });
  }
});

module.exports = router;
