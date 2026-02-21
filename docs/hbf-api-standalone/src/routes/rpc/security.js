/**
 * RPC Routes: Security
 * Implements: log_security_event, log_enhanced_security_event, create_audit_log,
 *             detect_suspicious_patterns, check_user_rate_limit_secure,
 *             validate_and_sanitize_input_enhanced, validate_critical_operation_access,
 *             is_system_shutdown
 */
const express = require('express');
const { query, uuidv4 } = require('../db');

const router = express.Router();

// POST /security/log-event
router.post('/log-event', async (req, res) => {
  try {
    const { p_event_type, p_severity, p_details, p_user_id } = req.body;
    const id = uuidv4();
    await query(
      `INSERT INTO security_events (id, event_type, severity, details, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [id, p_event_type || 'unknown', p_severity || 'low', JSON.stringify(p_details || {}), p_user_id || null]
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error('[security] log-event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /security/log-enhanced-event
router.post('/log-enhanced-event', async (req, res) => {
  try {
    const { p_user_id, p_event_type, p_severity, p_details, p_ip_address, p_user_agent } = req.body;
    const id = uuidv4();
    await query(
      `INSERT INTO security_events (id, event_type, severity, details, user_id, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [id, p_event_type || 'unknown', p_severity || 'low', JSON.stringify(p_details || {}), p_user_id || null, p_ip_address || '0.0.0.0', p_user_agent || null]
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error('[security] log-enhanced-event error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /audit/create
router.post('/create', async (req, res) => {
  try {
    const { action, table_name, record_id, old_values, new_values, user_id } = req.body;
    const id = uuidv4();
    await query(
      `INSERT INTO audit_logs (id, action, table_name, record_id, old_values, new_values, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [id, action, table_name, record_id, JSON.stringify(old_values || null), JSON.stringify(new_values || null), user_id || null]
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error('[audit] create error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /security/detect-patterns
router.post('/detect-patterns', async (req, res) => {
  try {
    // Detect suspicious patterns in recent security events
    const patterns = await query(`
      SELECT event_type, severity, COUNT(*) as event_count,
             MIN(created_at) as first_seen, MAX(created_at) as last_seen
      FROM security_events
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY event_type, severity
      HAVING COUNT(*) > 5
      ORDER BY event_count DESC
      LIMIT 20
    `);
    res.json(patterns);
  } catch (err) {
    console.error('[security] detect-patterns error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /security/check-rate-limit
router.post('/check-rate-limit', async (req, res) => {
  try {
    const { p_user_id, p_action, p_window_seconds, p_max_requests } = req.body;
    const windowSec = p_window_seconds || 60;
    const maxReq = p_max_requests || 100;

    const rows = await query(
      `SELECT COUNT(*) as cnt FROM api_request_analytics
       WHERE user_id = $1 AND endpoint = $2
       AND created_at > NOW() - ($3 || ' seconds')::INTERVAL`,
      [p_user_id, p_action, String(windowSec)]
    );
    const count = parseInt(rows[0]?.cnt || '0', 10);
    res.json({ allowed: count < maxReq, current_count: count, limit: maxReq });
  } catch (err) {
    console.error('[security] check-rate-limit error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /security/validate-input
router.post('/validate-input', async (req, res) => {
  try {
    const { p_input, p_field_type, p_max_length } = req.body;
    const maxLen = p_max_length || 10000;
    const errors = [];

    if (!p_input) return res.json({ valid: true, sanitized: '', errors: [] });

    const input = String(p_input);

    // Length check
    if (input.length > maxLen) errors.push(`Input exceeds maximum length of ${maxLen}`);

    // XSS detection
    const xssPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i, /eval\s*\(/i];
    for (const pattern of xssPatterns) {
      if (pattern.test(input)) errors.push('Input contains potentially malicious content');
    }

    // SQL injection detection
    const sqlPatterns = [/;\s*DROP\s/i, /;\s*DELETE\s/i, /UNION\s+SELECT/i, /'\s*OR\s+'1/i];
    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) errors.push('Input contains Invalid characters');
    }

    // Sanitize: strip HTML tags
    const sanitized = input.replace(/<[^>]*>/g, '').trim();

    res.json({ valid: errors.length === 0, sanitized, errors });
  } catch (err) {
    console.error('[security] validate-input error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /security/validate-critical-operation
router.post('/validate-critical-operation', async (req, res) => {
  try {
    const { p_user_id } = req.body;
    if (!p_user_id) return res.json(false);

    const rows = await query(
      `SELECT role FROM user_roles WHERE user_id = $1 AND is_active = true`,
      [p_user_id]
    );
    const adminRoles = ['admin', 'super_admin'];
    const hasAccess = rows.some(r => adminRoles.includes(r.role));
    res.json(hasAccess);
  } catch (err) {
    console.error('[security] validate-critical-operation error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /security/is-system-shutdown
router.post('/is-system-shutdown', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM emergency_shutdown WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
    );
    res.json(rows.length > 0 ? rows[0] : { is_active: false });
  } catch (err) {
    // Table may not exist yet
    res.json({ is_active: false });
  }
});

module.exports = router;
