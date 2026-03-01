/**
 * Rate limiting utilities — ported from supabase/functions/_shared/rate-limit.ts
 */
const { query } = require('../db');

const RATE_LIMITS = {
  ADMIN_CREATE_USER:    { action: 'admin_create_user',    maxAttempts: 10,  windowMinutes: 60 },
  ADMIN_UPDATE_USER:    { action: 'admin_update_user',    maxAttempts: 20,  windowMinutes: 60 },
  ADMIN_DELETE_USER:    { action: 'admin_delete_user',    maxAttempts: 5,   windowMinutes: 60 },
  ADMIN_RESET_PASSWORD: { action: 'admin_reset_password', maxAttempts: 10,  windowMinutes: 60 },
  ADMIN_GET_USERS:      { action: 'admin_get_users',      maxAttempts: 100, windowMinutes: 60 },
  ENCRYPT_DATA:         { action: 'encrypt_data',         maxAttempts: 50,  windowMinutes: 60 },
  DECRYPT_DATA:         { action: 'decrypt_data',         maxAttempts: 30,  windowMinutes: 60 },
  SEND_EMAIL:           { action: 'send_email',           maxAttempts: 50,  windowMinutes: 60 },
  SEND_PASSWORD_RESET:  { action: 'send_password_reset',  maxAttempts: 5,   windowMinutes: 15 },
  SCAN_DOCUMENT:        { action: 'scan_document',        maxAttempts: 100, windowMinutes: 60 },
  SESSION_VALIDATE:     { action: 'session_validate',     maxAttempts: 200, windowMinutes: 60 },
  SESSION_TRACK:        { action: 'session_track',        maxAttempts: 500, windowMinutes: 60 },
  AUTH_LOGIN:           { action: 'auth_login',           maxAttempts: 10,  windowMinutes: 15 },
  AUTH_EXCHANGE_CODE:   { action: 'auth_exchange_code',   maxAttempts: 10,  windowMinutes: 15 },
  AUDIT_LOG:            { action: 'audit_log',            maxAttempts: 100, windowMinutes: 60 },
  BLOCKCHAIN_HASH:      { action: 'blockchain_hash',      maxAttempts: 50,  windowMinutes: 60 },
};

async function checkRateLimit(userId, config) {
  try {
    const identifier = `${userId}:${config.action}`;
    const rows = await query(
      `SELECT check_rate_limit($1, $2, $3, $4) AS result`,
      [config.action, identifier, config.maxAttempts, config.windowMinutes]
    );
    const result = rows[0]?.result;
    if (!result || !result.allowed) {
      return { allowed: false, error: `Rate limit exceeded. Maximum ${config.maxAttempts} requests per ${config.windowMinutes} minutes.` };
    }
    return { allowed: true };
  } catch (err) {
    console.error('[rate-limit] check failed:', err.message);
    return { allowed: true }; // Fail open
  }
}

module.exports = { checkRateLimit, RATE_LIMITS };
