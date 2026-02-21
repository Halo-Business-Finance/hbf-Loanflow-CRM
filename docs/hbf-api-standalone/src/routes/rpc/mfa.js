/**
 * RPC Routes: MFA & Role Change Verification
 * Implements: generate_role_change_mfa_verification, verify_role_change_mfa
 */
const express = require('express');
const { query, uuidv4 } = require('../db');

const router = express.Router();

// POST /mfa/generate-role-change-verification
router.post('/generate-role-change-verification', async (req, res) => {
  try {
    // Generate a 6-digit OTP-style token
    const token = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Store token in audit_logs (or a dedicated MFA table if one exists)
    const id = uuidv4();
    await query(
      `INSERT INTO audit_logs (id, action, table_name, new_values, created_at)
       VALUES ($1, 'mfa_token_generated', 'mfa_verification', $2, NOW())`,
      [id, JSON.stringify({ token_hash: require('crypto').createHash('sha256').update(token).digest('hex'), expires_at: expiresAt })]
    );

    // In production, send via email/SMS. Here we return it for dev.
    res.json({
      success: true,
      verification_id: id,
      token, // In production: remove this and send via secure channel
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('[mfa] generate-verification error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /mfa/verify-role-change
router.post('/verify-role-change', async (req, res) => {
  try {
    const { p_token } = req.body;
    if (!p_token) return res.status(400).json({ error: 'Missing p_token' });

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(p_token).digest('hex');

    // Find matching unexpired token
    const rows = await query(
      `SELECT id, new_values FROM audit_logs
       WHERE action = 'mfa_token_generated' AND table_name = 'mfa_verification'
       AND (new_values->>'token_hash') = $1
       AND created_at > NOW() - INTERVAL '10 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.json(false);
    }

    // Mark token as used
    await query(
      `UPDATE audit_logs SET action = 'mfa_token_used' WHERE id = $1`,
      [rows[0].id]
    );

    res.json(true);
  } catch (err) {
    console.error('[mfa] verify-role-change error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
