/**
 * RPC Routes: Sessions
 * Implements: get_secure_session_data, store_secure_session_data,
 *             validate_enhanced_session, validate_session_with_security_checks
 */
const express = require('express');
const { query, uuidv4 } = require('../db');

const router = express.Router();

// POST /sessions/get-secure-data
router.post('/get-secure-data', async (req, res) => {
  try {
    const { p_key } = req.body;
    if (!p_key) return res.status(400).json({ error: 'Missing p_key' });

    // Store session data in active_sessions.risk_factors as a JSON KV store
    const rows = await query(
      `SELECT risk_factors FROM active_sessions
       WHERE is_active = true AND risk_factors ? $1
       ORDER BY last_activity DESC LIMIT 1`,
      [p_key]
    );

    if (rows.length > 0 && rows[0].risk_factors) {
      const data = rows[0].risk_factors;
      res.json(data[p_key] || null);
    } else {
      res.json(null);
    }
  } catch (err) {
    console.error('[sessions] get-secure-data error:', err.message);
    res.json(null); // Graceful fallback
  }
});

// POST /sessions/store-secure-data
router.post('/store-secure-data', async (req, res) => {
  try {
    const { p_key, p_value } = req.body;
    if (!p_key) return res.status(400).json({ error: 'Missing p_key' });

    // Upsert into the most recent active session's risk_factors
    await query(
      `UPDATE active_sessions
       SET risk_factors = COALESCE(risk_factors, '{}'::jsonb) || jsonb_build_object($1, $2),
           last_activity = NOW()
       WHERE is_active = true
       AND id = (SELECT id FROM active_sessions WHERE is_active = true ORDER BY last_activity DESC LIMIT 1)`,
      [p_key, p_value]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[sessions] store-secure-data error:', err.message);
    res.json({ success: false });
  }
});

// POST /sessions/validate-enhanced
router.post('/validate-enhanced', async (req, res) => {
  try {
    const { p_user_id, p_session_token, p_device_fingerprint } = req.body;
    if (!p_user_id) return res.status(400).json({ error: 'Missing p_user_id' });

    const rows = await query(
      `SELECT id, session_token, expires_at, device_fingerprint, is_active
       FROM active_sessions
       WHERE user_id = $1 AND is_active = true
       ORDER BY last_activity DESC LIMIT 1`,
      [p_user_id]
    );

    if (rows.length === 0) {
      return res.json({ valid: false, reason: 'no_active_session' });
    }

    const session = rows[0];
    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (now > expiresAt) {
      return res.json({ valid: false, reason: 'session_expired' });
    }

    // Update last activity
    await query(
      `UPDATE active_sessions SET last_activity = NOW() WHERE id = $1`,
      [session.id]
    );

    res.json({ valid: true, session_id: session.id });
  } catch (err) {
    console.error('[sessions] validate-enhanced error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /sessions/validate-with-security
router.post('/validate-with-security', async (req, res) => {
  try {
    const { p_user_id, p_session_token, p_ip_address, p_user_agent } = req.body;
    if (!p_user_id) return res.status(400).json({ error: 'Missing p_user_id' });

    const rows = await query(
      `SELECT id, session_token, expires_at, ip_address, user_agent, is_active, security_alerts_count
       FROM active_sessions
       WHERE user_id = $1 AND is_active = true
       ORDER BY last_activity DESC LIMIT 1`,
      [p_user_id]
    );

    if (rows.length === 0) {
      return res.json({ valid: false, reason: 'no_active_session', risk_level: 'high' });
    }

    const session = rows[0];
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    let riskLevel = 'low';

    if (now > expiresAt) {
      return res.json({ valid: false, reason: 'session_expired', risk_level: 'medium' });
    }

    // Check for IP/UA changes
    if (p_ip_address && session.ip_address && String(session.ip_address) !== String(p_ip_address)) {
      riskLevel = 'medium';
    }
    if (p_user_agent && session.user_agent && session.user_agent !== p_user_agent) {
      riskLevel = riskLevel === 'medium' ? 'high' : 'medium';
    }

    // Update last activity and security check
    await query(
      `UPDATE active_sessions SET last_activity = NOW(), last_security_check = NOW() WHERE id = $1`,
      [session.id]
    );

    res.json({ valid: true, session_id: session.id, risk_level: riskLevel });
  } catch (err) {
    console.error('[sessions] validate-with-security error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
