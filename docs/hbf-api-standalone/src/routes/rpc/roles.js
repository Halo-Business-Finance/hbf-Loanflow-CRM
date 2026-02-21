/**
 * RPC Routes: Roles & Auth
 * Implements: get_user_role, assign_user_role, revoke_user_role,
 *             ensure_default_viewer_role, is_email_verified,
 *             check_mfa_requirement, mark_mfa_completed
 */
const express = require('express');
const { query } = require('../db');

const router = express.Router();

// POST /roles/get-user-role
router.post('/get-user-role', async (req, res) => {
  try {
    const { p_user_id } = req.body;
    if (!p_user_id) return res.status(400).json({ error: 'Missing p_user_id' });
    const rows = await query(
      `SELECT role FROM user_roles WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`,
      [p_user_id]
    );
    res.json(rows.length ? rows[0].role : 'viewer');
  } catch (err) {
    console.error('[roles] get-user-role error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /roles/assign
router.post('/assign', async (req, res) => {
  try {
    const { p_target_user_id, p_new_role, p_reason, p_mfa_verified } = req.body;
    if (!p_target_user_id || !p_new_role) return res.status(400).json({ error: 'Missing required fields' });

    // Deactivate existing roles
    await query(`UPDATE user_roles SET is_active = false WHERE user_id = $1`, [p_target_user_id]);

    // Insert new role
    const id = require('uuid').v4();
    await query(
      `INSERT INTO user_roles (id, user_id, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, true, NOW(), NOW())`,
      [id, p_target_user_id, p_new_role]
    );

    // Log the change
    await query(
      `INSERT INTO audit_logs (id, action, table_name, record_id, new_values, created_at) VALUES ($1, 'role_assigned', 'user_roles', $2, $3, NOW())`,
      [require('uuid').v4(), p_target_user_id, JSON.stringify({ role: p_new_role, reason: p_reason, mfa_verified: p_mfa_verified })]
    );

    res.json({ success: true, role: p_new_role });
  } catch (err) {
    console.error('[roles] assign error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /roles/revoke
router.post('/revoke', async (req, res) => {
  try {
    const { p_target_user_id, p_reason, p_mfa_verified } = req.body;
    if (!p_target_user_id) return res.status(400).json({ error: 'Missing p_target_user_id' });

    await query(`UPDATE user_roles SET is_active = false, updated_at = NOW() WHERE user_id = $1`, [p_target_user_id]);

    await query(
      `INSERT INTO audit_logs (id, action, table_name, record_id, new_values, created_at) VALUES ($1, 'role_revoked', 'user_roles', $2, $3, NOW())`,
      [require('uuid').v4(), p_target_user_id, JSON.stringify({ reason: p_reason, mfa_verified: p_mfa_verified })]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[roles] revoke error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /roles/ensure-default
router.post('/ensure-default', async (req, res) => {
  try {
    const { p_user_id } = req.body;
    const userId = p_user_id || req.body.user_id;
    if (!userId) return res.status(400).json({ error: 'Missing user_id' });

    const existing = await query(`SELECT id FROM user_roles WHERE user_id = $1 AND is_active = true LIMIT 1`, [userId]);
    if (existing.length > 0) return res.json({ role: 'existing' });

    const id = require('uuid').v4();
    await query(
      `INSERT INTO user_roles (id, user_id, role, is_active, created_at, updated_at) VALUES ($1, $2, 'viewer', true, NOW(), NOW()) ON CONFLICT DO NOTHING`,
      [id, userId]
    );
    res.json({ role: 'viewer' });
  } catch (err) {
    console.error('[roles] ensure-default error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/is-email-verified
router.post('/is-email-verified', async (req, res) => {
  try {
    const { p_user_id } = req.body;
    if (!p_user_id) return res.status(400).json({ error: 'Missing p_user_id' });
    // Check auth.users email_confirmed_at (if accessible), otherwise assume true for IBM App ID users
    try {
      const rows = await query(`SELECT email_confirmed_at FROM auth.users WHERE id = $1`, [p_user_id]);
      res.json(rows.length > 0 && rows[0].email_confirmed_at != null);
    } catch {
      // auth.users may not exist in IBM PostgreSQL — IBM App ID handles verification
      res.json(true);
    }
  } catch (err) {
    console.error('[auth] is-email-verified error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/check-mfa-requirement
router.post('/check-mfa-requirement', async (req, res) => {
  try {
    const { p_user_id } = req.body;
    if (!p_user_id) return res.status(400).json({ error: 'Missing p_user_id' });
    // Check if user role requires MFA
    const rows = await query(
      `SELECT role FROM user_roles WHERE user_id = $1 AND is_active = true`,
      [p_user_id]
    );
    const mfaRequiredRoles = ['admin', 'super_admin', 'manager'];
    const requiresMfa = rows.some(r => mfaRequiredRoles.includes(r.role));
    res.json({ requires_mfa: requiresMfa, user_id: p_user_id });
  } catch (err) {
    console.error('[auth] check-mfa error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/mark-mfa-completed
router.post('/mark-mfa-completed', async (req, res) => {
  try {
    const { p_user_id } = req.body;
    if (!p_user_id) return res.status(400).json({ error: 'Missing p_user_id' });
    // Store MFA completion in active_sessions or a flag
    await query(
      `UPDATE active_sessions SET last_security_check = NOW() WHERE user_id = $1 AND is_active = true`,
      [p_user_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[auth] mark-mfa error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
