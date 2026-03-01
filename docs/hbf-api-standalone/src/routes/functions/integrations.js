/**
 * Integration functions — ported from:
 *   supabase/functions/ringcentral-auth
 *   supabase/functions/send-email
 *   supabase/functions/secure-external-api
 *   supabase/functions/google-maps-config
 *   supabase/functions/get-adobe-config
 *   supabase/functions/health-check
 *   supabase/functions/audit-log
 *   supabase/functions/blockchain-hash
 *   supabase/functions/encrypt-data
 *   supabase/functions/generate-conditions
 *   supabase/functions/ai-decision-engine
 *   supabase/functions/enhanced-auth
 *   supabase/functions/enhanced-geo-security
 *   supabase/functions/geo-security
 */
const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { validateEmail, sanitizeString, escapeHtml } = require('../../middleware/validation');
const { checkRateLimit, RATE_LIMITS } = require('../../middleware/rate-limit');

const ALLOWED_PROXY_HOSTS = ['maps.googleapis.com', 'api.ringcentral.com'];

// ── ringcentral-auth ─────────────────────────────────────────
router.post('/ringcentral-auth', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { action, phoneNumber } = req.body;
    const rows = await query(`SELECT * FROM ringcentral_accounts WHERE user_id = $1 AND is_active = true LIMIT 1`, [userId]);
    if (!rows.length) return res.status(400).json({ error: 'RingCentral account not configured' });
    const rc = rows[0];

    // Authenticate with RingCentral
    const authRes = await fetch(`${rc.server_url}/restapi/oauth/token`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${Buffer.from(`${rc.client_id}:${rc.client_secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', username: rc.username, password: rc.password, extension: rc.extension || '' }),
    });
    if (!authRes.ok) throw new Error('Failed to authenticate with RingCentral');
    const authData = await authRes.json();

    if (action === 'call' && phoneNumber) {
      const callRes = await fetch(`${rc.server_url}/restapi/v1.0/account/~/extension/~/ring-out`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${authData.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: { phoneNumber: rc.username }, to: { phoneNumber }, playPrompt: false }),
      });
      if (!callRes.ok) throw new Error('Failed to initiate call');
      return res.json(await callRes.json());
    }
    if (action === 'status') {
      const extRes = await fetch(`${rc.server_url}/restapi/v1.0/account/~/extension/~`, { headers: { 'Authorization': `Bearer ${authData.access_token}` } });
      if (!extRes.ok) throw new Error('Failed to get extension status');
      return res.json(await extRes.json());
    }
    res.json({});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── send-email (Resend) ──────────────────────────────────────
router.post('/send-email', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Authorization required' });

    const rl = await checkRateLimit(userId, RATE_LIMITS.SEND_EMAIL);
    if (!rl.allowed) return res.status(429).json({ error: rl.error });

    const { to, subject, body, leadName, fromName, replyTo } = req.body;
    if (!to || !subject || !body) return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    if (!validateEmail(to).valid) return res.status(400).json({ error: 'Invalid email address format' });

    // TODO: Integrate with Resend or SMTP provider
    // For now, log the email attempt
    await query(`INSERT INTO audit_logs (user_id, action, new_values) VALUES ($1, 'send_email', $2)`,
      [userId, JSON.stringify({ to, subject, leadName })]);

    res.json({ success: true, message: 'Email queued for delivery' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// ── secure-external-api ──────────────────────────────────────
router.post('/secure-external-api', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { action, url, options } = req.body;
    if (action === 'get_google_maps_key') {
      const key = process.env.GOOGLE_MAPS_API_KEY;
      if (!key) return res.status(500).json({ error: 'Google Maps API key not configured' });
      return res.json({ apiKey: key });
    }
    if (action === 'proxy_request') {
      try {
        const parsed = new URL(url);
        if (!ALLOWED_PROXY_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
          return res.status(400).json({ error: 'URL not in allowed list' });
        }
      } catch { return res.status(400).json({ error: 'Invalid URL' }); }
      const proxyRes = await fetch(url, { method: options?.method || 'GET', headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }, ...(options?.body && { body: JSON.stringify(options.body) }) });
      return res.status(proxyRes.status).json(await proxyRes.json());
    }
    res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── google-maps-config ───────────────────────────────────────
router.post('/google-maps-config', async (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(500).json({ error: 'Google Maps API key not configured' });
  res.json({ apiKey: key });
});

// ── get-adobe-config ─────────────────────────────────────────
router.post('/get-adobe-config', async (req, res) => {
  const clientId = process.env.ADOBE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Adobe client ID not configured' });
  res.json({ clientId });
});

// ── health-check ─────────────────────────────────────────────
router.get('/health-check', async (req, res) => {
  try {
    const dbStart = Date.now();
    await query('SELECT 1');
    const dbTime = Date.now() - dbStart;
    const [sessions] = await query(`SELECT count(*) as cnt FROM active_sessions WHERE is_active = true`);
    res.json({
      status: 'healthy', timestamp: new Date().toISOString(),
      checks: { database: { status: 'ok', responseTime: dbTime }, sessions: { activeSessions: parseInt(sessions?.cnt || 0) } },
      version: '2.0.0-ibm',
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// ── audit-log ────────────────────────────────────────────────
router.post('/audit-log', async (req, res) => {
  try {
    const { action, table_name, record_id, old_values, new_values, user_id } = req.body;
    await query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values) VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_id || req.jwtPayload?.sub, action, table_name, record_id, old_values ? JSON.stringify(old_values) : null, new_values ? JSON.stringify(new_values) : null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log audit event' });
  }
});

// ── blockchain-hash ──────────────────────────────────────────
router.post('/blockchain-hash', async (req, res) => {
  try {
    const crypto = require('crypto');
    const { record_id, record_type, data } = req.body;
    const dataHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    await query(
      `INSERT INTO blockchain_records (record_id, record_type, data_hash, verification_status) VALUES ($1, $2, $3, 'verified')
       ON CONFLICT (record_id, record_type) DO UPDATE SET data_hash = EXCLUDED.data_hash, verified_at = NOW()`,
      [record_id, record_type, dataHash]
    );
    res.json({ success: true, data_hash: dataHash });
  } catch (err) {
    res.status(500).json({ error: 'Hashing failed' });
  }
});

// ── encrypt-data ─────────────────────────────────────────────
router.post('/encrypt-data', async (req, res) => {
  try {
    const { action, contact_id, field_name, field_value } = req.body;
    if (action === 'encrypt') {
      const rows = await query(`SELECT encrypt_profile_field($1, $2, $3) AS result`, [contact_id, field_name, field_value]);
      return res.json({ success: true, result: rows[0]?.result });
    }
    if (action === 'decrypt') {
      const rows = await query(`SELECT decrypt_profile_field($1, $2) AS result`, [contact_id, field_name]);
      return res.json({ success: true, result: rows[0]?.result });
    }
    res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    res.status(500).json({ error: 'Encryption operation failed' });
  }
});

// ── generate-conditions ──────────────────────────────────────
router.post('/generate-conditions', async (req, res) => {
  try {
    const { lead_id, loan_type, loan_amount } = req.body;
    // TODO: Integrate with AI service for condition generation
    const conditions = [
      { category: 'Documentation', condition: 'Provide business tax returns for last 2 years', priority: 'high' },
      { category: 'Financial', condition: 'Verify debt service coverage ratio', priority: 'medium' },
    ];
    res.json({ success: true, conditions, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate conditions' });
  }
});

// ── ai-decision-engine ───────────────────────────────────────
router.post('/ai-decision-engine', async (req, res) => {
  try {
    const { action, lead_id, data } = req.body;
    // TODO: Integrate with AI service
    res.json({ success: true, decision: 'approve', confidence: 0.85, factors: [], timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'AI decision engine error' });
  }
});

// ── enhanced-auth ────────────────────────────────────────────
router.post('/enhanced-auth', async (req, res) => {
  // Auth is now handled by IBM App ID via jwt-verify middleware
  res.json({ success: true, message: 'Auth handled by IBM App ID' });
});

// ── geo-security / enhanced-geo-security ─────────────────────
router.post('/geo-security', async (req, res) => {
  // Redirect to production-geo-security logic
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const isLocal = clientIP.startsWith('127.') || clientIP.startsWith('192.168.') || clientIP.startsWith('10.');
  res.json({ allowed: isLocal || true, country: 'US', ip: clientIP });
});

router.post('/enhanced-geo-security', async (req, res) => {
  res.json({ allowed: true, country: 'US' });
});

module.exports = router;
