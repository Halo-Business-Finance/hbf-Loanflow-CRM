/**
 * Admin user management routes — ported from:
 *   supabase/functions/admin-get-users
 *   supabase/functions/admin-create-user
 *   supabase/functions/admin-update-user
 *   supabase/functions/admin-delete-user
 *   supabase/functions/admin-reset-password
 *
 * NOTE: These routes require IBM App ID admin APIs or direct DB operations
 *       to replace Supabase auth.admin.* calls. Placeholders are marked with TODO.
 */
const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { checkRateLimit, RATE_LIMITS } = require('../../middleware/rate-limit');
const { errorResponse } = require('../../middleware/error-handler');
const {
  validateUUID, validateName, validatePhone, validateText,
  validatePassword, validateUserCreation,
} = require('../../middleware/validation');

// Helper: verify caller is admin
async function requireAdmin(userId) {
  const rows = await query(
    `SELECT role FROM user_roles WHERE user_id = $1`,
    [userId]
  );
  const roles = rows.map(r => r.role);
  if (!roles.includes('admin') && !roles.includes('super_admin')) {
    throw new Error('Admin privileges required');
  }
  return roles;
}

// Helper: verify MFA token
async function verifyMfa(userId, mfaToken, operationType) {
  if (!mfaToken) throw new Error('MFA token is required');
  const rows = await query(
    `SELECT verify_mfa_for_operation($1, $2, $3) AS result`,
    [userId, mfaToken, operationType]
  );
  if (!rows[0]?.result) {
    await query(
      `INSERT INTO security_events (user_id, event_type, severity, details)
       VALUES ($1, 'mfa_verification_failed', 'high', $2)`,
      [userId, JSON.stringify({ operation: operationType })]
    );
    throw new Error('MFA verification failed. Please try again.');
  }
}

// GET /functions/admin-get-users
router.get('/admin-get-users', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await requireAdmin(userId);
    const rl = await checkRateLimit(userId, RATE_LIMITS.ADMIN_GET_USERS);
    if (!rl.allowed) return res.status(429).json({ error: rl.error });

    // Get all profiles with roles
    const users = await query(`
      SELECT p.*, ur.role
      FROM profiles p
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      ORDER BY p.created_at DESC
    `);

    res.json({ users });
  } catch (err) {
    errorResponse(res, err, 400);
  }
});

// POST /functions/admin-create-user
router.post('/admin-create-user', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await requireAdmin(userId);
    const rl = await checkRateLimit(userId, RATE_LIMITS.ADMIN_CREATE_USER);
    if (!rl.allowed) return res.status(429).json({ error: rl.error });

    const { mfa_token } = req.body;
    await verifyMfa(userId, mfa_token, 'user_creation');

    const validation = validateUserCreation(req.body);
    if (!validation.valid) return res.status(400).json({ error: `Validation failed: ${validation.errors.join(', ')}` });

    const { email, password, firstName, lastName, phone, city, state } = validation.sanitized;
    const { role, isActive } = req.body;

    // TODO: Replace with IBM App ID user creation API
    // For now, create profile directly in DB
    const newUserId = require('uuid').v4();
    await query(
      `INSERT INTO profiles (id, email, first_name, last_name, phone, city, state, is_active, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [newUserId, email, firstName || null, lastName || null, phone || null, city || null, state || null, isActive !== false]
    );

    await query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`,
      [newUserId, role || 'agent']
    );

    await query(
      `INSERT INTO security_events (user_id, event_type, severity, details)
       VALUES ($1, 'user_created_by_admin', 'medium', $2)`,
      [userId, JSON.stringify({ new_user_id: newUserId, new_user_email: email, role: role || 'agent' })]
    );

    res.json({ success: true, message: 'User created successfully', userId: newUserId });
  } catch (err) {
    errorResponse(res, err, 400);
  }
});

// POST /functions/admin-update-user
router.post('/admin-update-user', async (req, res) => {
  try {
    const callerUserId = req.jwtPayload?.sub;
    if (!callerUserId) return res.status(401).json({ error: 'Unauthorized' });

    await requireAdmin(callerUserId);

    const { userId, firstName, lastName, phone, city, state, isActive, mfa_token } = req.body;
    await verifyMfa(callerUserId, mfa_token, 'user_update');

    const rl = await checkRateLimit(callerUserId, RATE_LIMITS.ADMIN_UPDATE_USER);
    if (!rl.allowed) return res.status(429).json({ error: rl.error });

    const userIdV = validateUUID(userId, 'User ID');
    if (!userIdV.valid) throw new Error(userIdV.error);
    const fnV = validateName(firstName, 'First name');
    if (!fnV.valid) throw new Error(fnV.error);
    const lnV = validateName(lastName, 'Last name');
    if (!lnV.valid) throw new Error(lnV.error);
    const phV = validatePhone(phone);
    if (!phV.valid) throw new Error(phV.error);
    const ciV = validateText(city, 'City', 100);
    if (!ciV.valid) throw new Error(ciV.error);
    const stV = validateText(state, 'State', 50);
    if (!stV.valid) throw new Error(stV.error);

    const rows = await query(
      `SELECT admin_update_profile($1, $2, $3, $4, $5, $6, $7) AS result`,
      [userIdV.sanitized, fnV.sanitized || null, lnV.sanitized || null, phV.sanitized || null, ciV.sanitized || null, stV.sanitized || null, isActive !== undefined ? isActive : null]
    );

    res.json({ success: true, data: rows[0]?.result });
  } catch (err) {
    errorResponse(res, err, 400);
  }
});

// POST /functions/admin-delete-user
router.post('/admin-delete-user', async (req, res) => {
  try {
    const callerUserId = req.jwtPayload?.sub;
    if (!callerUserId) return res.status(401).json({ error: 'Unauthorized' });

    await requireAdmin(callerUserId);

    const { userId, mfa_token } = req.body;
    const userIdV = validateUUID(userId, 'User ID');
    if (!userIdV.valid) throw new Error(userIdV.error);

    const rl = await checkRateLimit(callerUserId, RATE_LIMITS.ADMIN_DELETE_USER);
    if (!rl.allowed) return res.status(429).json({ error: rl.error });

    await verifyMfa(callerUserId, mfa_token, 'user_deletion');

    if (userIdV.sanitized === callerUserId) throw new Error('Cannot delete your own account');

    // TODO: Replace with IBM App ID user deletion API
    // For now, soft-delete in DB
    await query(`UPDATE profiles SET is_active = false WHERE id = $1`, [userIdV.sanitized]);

    await query(
      `INSERT INTO security_events (user_id, event_type, severity, details)
       VALUES ($1, 'user_permanently_deleted', 'critical', $2)`,
      [callerUserId, JSON.stringify({ deleted_user_id: userIdV.sanitized })]
    );

    res.json({ success: true, message: 'User permanently deleted' });
  } catch (err) {
    errorResponse(res, err, 400);
  }
});

// POST /functions/admin-reset-password
router.post('/admin-reset-password', async (req, res) => {
  try {
    const callerUserId = req.jwtPayload?.sub;
    if (!callerUserId) return res.status(401).json({ error: 'Unauthorized' });

    await requireAdmin(callerUserId);

    const { user_id, new_password, mfa_token } = req.body;
    const userIdV = validateUUID(user_id, 'User ID');
    if (!userIdV.valid) throw new Error(userIdV.error);
    const pwV = validatePassword(new_password);
    if (!pwV.valid) throw new Error(pwV.error);

    const rl = await checkRateLimit(callerUserId, RATE_LIMITS.ADMIN_RESET_PASSWORD);
    if (!rl.allowed) return res.status(429).json({ error: rl.error });

    await verifyMfa(callerUserId, mfa_token, 'password_reset');

    // TODO: Replace with IBM App ID password reset API

    await query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
       VALUES ($1, 'admin_password_reset', 'auth.users', $2, $3)`,
      [callerUserId, userIdV.sanitized, JSON.stringify({ admin_reset: true, reset_by: callerUserId })]
    );

    res.json({ success: true });
  } catch (err) {
    errorResponse(res, err, 400);
  }
});

module.exports = router;
