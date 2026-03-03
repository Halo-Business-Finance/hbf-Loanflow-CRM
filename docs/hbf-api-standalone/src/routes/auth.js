/**
 * Authentication Routes — bcrypt + JWT
 *
 * Provides email/password registration, login, token refresh,
 * and password reset request endpoints.
 *
 * Uses a `users` table in PostgreSQL with columns:
 *   id, email, password_hash, first_name, last_name, display_name,
 *   roles, email_verified, created_at, updated_at
 *
 * Routes:
 *   POST /auth/register        — Create account
 *   POST /auth/login            — Authenticate & issue tokens
 *   POST /auth/refresh          — Refresh an access token
 *   POST /auth/reset-password   — Request password reset
 *   POST /auth/update-password  — Set new password with reset token
 */

const express = require('express');
const crypto = require('crypto');
const { query, uuidv4 } = require('../db');

const router = express.Router();

// ── Config ──────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const ACCESS_TOKEN_TTL = 3600;       // 1 hour in seconds
const REFRESH_TOKEN_TTL = 30 * 24 * 3600; // 30 days

// ── Lightweight JWT helpers (HS256) ─────────────────────────────

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function signJwt(payload, secret, expiresInSec) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };

  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(body)),
  ];

  const sig = crypto
    .createHmac('sha256', secret)
    .update(segments.join('.'))
    .digest();

  segments.push(base64url(sig));
  return segments.join('.');
}

function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();

  const expectedSig = base64url(sig);
  if (expectedSig !== parts[2]) throw new Error('Invalid signature');

  const payload = JSON.parse(base64urlDecode(parts[1]).toString());
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}

// ── bcrypt-compatible hashing (using Node crypto, no native dep) ─
// Uses PBKDF2 with 100k iterations as a portable bcrypt alternative.

const HASH_ITERATIONS = 100_000;
const HASH_KEYLEN = 64;
const HASH_DIGEST = 'sha512';

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(`pbkdf2:${salt}:${key.toString('hex')}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [algo, salt, hash] = stored.split(':');
    if (algo !== 'pbkdf2') return resolve(false);

    crypto.pbkdf2(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), key));
    });
  });
}

// ── Helpers ─────────────────────────────────────────────────────

function buildUserResponse(row) {
  return {
    id: row.id,
    email: row.email,
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    name: row.display_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    display_name: row.display_name || '',
    roles: row.roles || ['viewer'],
    emailVerified: !!row.email_verified,
    email_confirmed_at: row.email_verified ? row.updated_at : null,
  };
}

function issueTokens(user) {
  const payload = { sub: user.id, email: user.email, roles: user.roles };
  const accessToken = signJwt(payload, JWT_SECRET, ACCESS_TOKEN_TTL);
  const refreshToken = signJwt({ sub: user.id, type: 'refresh' }, JWT_SECRET, REFRESH_TOKEN_TTL);
  return {
    access_token: accessToken,
    id_token: accessToken, // Same for now; split when App ID is wired
    refresh_token: refreshToken,
    expires_in: ACCESS_TOKEN_TTL,
    user,
  };
}

// ── POST /auth/register ─────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check duplicate
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const id = uuidv4();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const displayName = `${first_name || ''} ${last_name || ''}`.trim() || email.split('@')[0];

    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, roles, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $8)`,
      [id, email.toLowerCase(), passwordHash, first_name || '', last_name || '', displayName, JSON.stringify(['viewer']), now],
    );

    const user = buildUserResponse({
      id, email: email.toLowerCase(), first_name, last_name,
      display_name: displayName, roles: ['viewer'], email_verified: false, updated_at: now,
    });

    const tokens = issueTokens(user);

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (id, action, user_id, table_name, record_id, created_at)
         VALUES ($1, 'register', $2, 'users', $2, $3)`,
        [uuidv4(), id, now],
      );
    } catch { /* best-effort */ }

    res.status(201).json(tokens);
  } catch (err) {
    console.error('[auth/register] error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /auth/login (IBM App ID ROPC) ──────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // ── 1. Discover App ID token endpoint ───────────────────────
    const discoveryUrl = process.env.IBM_APPID_DISCOVERY_ENDPOINT;
    const clientId = process.env.IBM_APPID_CLIENT_ID;

    if (!discoveryUrl || !clientId) {
      console.error('[auth/login] IBM_APPID_DISCOVERY_ENDPOINT or IBM_APPID_CLIENT_ID not set');
      return res.status(500).json({ error: 'Authentication service not configured' });
    }

    // Cache-friendly: in production you'd cache this, but for correctness we fetch each time
    const discoResp = await fetch(discoveryUrl);
    if (!discoResp.ok) {
      console.error('[auth/login] App ID discovery failed:', discoResp.status);
      return res.status(502).json({ error: 'Authentication service unavailable' });
    }
    const disco = await discoResp.json();
    const tokenEndpoint = disco.token_endpoint;

    // ── 2. Resource Owner Password flow ─────────────────────────
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', email);
    params.append('password', password);
    params.append('client_id', clientId);

    const tokenResp = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenResp.ok) {
      const errBody = await tokenResp.json().catch(() => ({}));
      console.error('[auth/login] App ID ROPC failed:', tokenResp.status, errBody);

      // Log failed attempt
      const rows = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]).catch(() => []);
      if (rows.length) {
        try {
          await query(
            `INSERT INTO audit_logs (id, action, user_id, table_name, new_values, created_at)
             VALUES ($1, 'login_failed', $2, 'users', '{"reason":"appid_rejected"}', $3)`,
            [uuidv4(), rows[0].id, new Date().toISOString()],
          );
        } catch { /* best-effort */ }
      }

      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const appIdTokens = await tokenResp.json();

    // ── 3. Decode id_token to extract user info ─────────────────
    let idPayload = {};
    try {
      const idParts = appIdTokens.id_token.split('.');
      idPayload = JSON.parse(base64urlDecode(idParts[1]).toString());
    } catch { /* proceed with defaults */ }

    // ── 4. Upsert local user record ─────────────────────────────
    const sub = idPayload.sub || email.toLowerCase();
    const firstName = idPayload.given_name || idPayload.name || '';
    const lastName = idPayload.family_name || '';
    const displayName = idPayload.name || `${firstName} ${lastName}`.trim() || email.split('@')[0];
    const now = new Date().toISOString();

    let userRows = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (!userRows.length) {
      // First App ID login — create local record (no password_hash needed)
      const id = uuidv4();
      await query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, display_name, roles, email_verified, created_at, updated_at)
         VALUES ($1, $2, 'appid', $3, $4, $5, $6, true, $7, $7)`,
        [id, email.toLowerCase(), firstName, lastName, displayName, JSON.stringify(['viewer']), now],
      );
      userRows = await query('SELECT * FROM users WHERE id = $1', [id]);
    } else {
      // Update last login timestamp
      await query('UPDATE users SET updated_at = $1 WHERE id = $2', [now, userRows[0].id]);
    }

    const row = userRows[0];
    const user = buildUserResponse(row);

    // ── 5. Create active session ────────────────────────────────
    const sessionId = uuidv4();
    try {
      await query(
        `INSERT INTO active_sessions (id, user_id, session_token, is_active, created_at, last_activity, expires_at, ip_address)
         VALUES ($1, $2, $3, true, $4, $4, $5, $6)`,
        [
          sessionId, row.id, appIdTokens.access_token.slice(-40),
          now,
          new Date(Date.now() + (appIdTokens.expires_in || ACCESS_TOKEN_TTL) * 1000).toISOString(),
          req.ip || '0.0.0.0',
        ],
      );
    } catch { /* best-effort */ }

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (id, action, user_id, table_name, record_id, session_id, created_at)
         VALUES ($1, 'login', $2, 'users', $2, $3, $4)`,
        [uuidv4(), row.id, sessionId, now],
      );
    } catch { /* best-effort */ }

    // ── 6. Return App ID tokens + user info ─────────────────────
    res.json({
      access_token: appIdTokens.access_token,
      id_token: appIdTokens.id_token,
      refresh_token: appIdTokens.refresh_token || null,
      expires_in: appIdTokens.expires_in || ACCESS_TOKEN_TTL,
      user,
    });
  } catch (err) {
    console.error('[auth/login] error:', err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ── POST /auth/refresh ──────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    const payload = verifyJwt(refresh_token, JWT_SECRET);
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const rows = await query('SELECT * FROM users WHERE id = $1', [payload.sub]);
    if (!rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = buildUserResponse(rows[0]);
    const tokens = issueTokens(user);
    res.json(tokens);
  } catch (err) {
    console.error('[auth/refresh] error:', err.message);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// ── POST /auth/reset-password ───────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const rows = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    // Always return success to prevent email enumeration
    if (!rows.length) {
      return res.json({ message: 'If an account exists, a reset link has been sent' });
    }

    // Generate reset token (valid 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    await query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2, updated_at = $3 WHERE id = $4`,
      [resetToken, expiresAt, new Date().toISOString(), rows[0].id],
    );

    // TODO: Send email with reset link containing the token
    // For now, log it (production would use IBM SES or SendGrid)
    console.log(`[auth] Password reset token for ${email}: ${resetToken}`);

    res.json({ message: 'If an account exists, a reset link has been sent' });
  } catch (err) {
    console.error('[auth/reset-password] error:', err.message);
    res.status(500).json({ error: 'Password reset request failed' });
  }
});

// ── POST /auth/update-password ──────────────────────────────────
router.post('/update-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const rows = await query(
      `SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > $2`,
      [token, new Date().toISOString()],
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await hashPassword(password);
    await query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = $2 WHERE id = $3`,
      [passwordHash, new Date().toISOString(), rows[0].id],
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[auth/update-password] error:', err.message);
    res.status(500).json({ error: 'Password update failed' });
  }
});

module.exports = router;
