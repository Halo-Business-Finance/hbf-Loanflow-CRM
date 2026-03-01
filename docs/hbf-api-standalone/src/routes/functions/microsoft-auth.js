/**
 * Microsoft OAuth & email integration — ported from supabase/functions/microsoft-auth
 *
 * Requires env: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID
 */
const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const { checkRateLimit, RATE_LIMITS } = require('../../middleware/rate-limit');

const BASE_URL = process.env.API_BASE_URL || '';

// GET  /functions/microsoft-auth?code=...&state=...  (OAuth callback)
router.get('/microsoft-auth', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.send(authPopupHtml('microsoft_auth_error', { error }));
    if (!code || !state) return res.status(400).send('Missing code or state parameter');

    const tokens = await exchangeCodeForTokens(code, state);
    const profile = await getMicrosoftProfile(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await query(`
      INSERT INTO email_accounts (user_id, email_address, display_name, access_token, refresh_token, expires_at, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (user_id, email_address) DO UPDATE SET
        access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at, is_active = true
    `, [state, profile.mail || profile.userPrincipalName, profile.displayName, tokens.access_token, tokens.refresh_token, expiresAt.toISOString()]);

    res.send(authPopupHtml('microsoft_auth_success', { email: profile.mail || profile.userPrincipalName, name: profile.displayName }));
  } catch (err) {
    console.error('[microsoft-auth] callback error:', err.message);
    res.send(authPopupHtml('microsoft_auth_error', { error: 'Authentication failed' }));
  }
});

// POST /functions/microsoft-auth  (JSON API actions)
router.post('/microsoft-auth', async (req, res) => {
  try {
    const userId = req.jwtPayload?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { action, code, to, subject, body: emailBody, cc, bcc, recipientEmail, recipientName } = req.body;

    // Rate limiting
    let rlConfig = RATE_LIMITS.AUTH_LOGIN;
    if (action === 'exchange_code') rlConfig = RATE_LIMITS.AUTH_EXCHANGE_CODE;
    else if (action === 'send_email') rlConfig = RATE_LIMITS.SEND_EMAIL;
    else if (action === 'send_password_reset') rlConfig = RATE_LIMITS.SEND_PASSWORD_RESET;
    const rl = await checkRateLimit(userId, rlConfig);
    if (!rl.allowed) return res.status(429).json({ error: rl.error });

    switch (action) {
      case 'get_auth_url': {
        const clientId = process.env.MICROSOFT_CLIENT_ID;
        const tenantId = process.env.MICROSOFT_TENANT_ID || 'organizations';
        const redirectUri = `${BASE_URL}/api/v1/functions/microsoft-auth`;
        const scope = 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access';
        const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${userId}&response_mode=query&prompt=consent`;
        return res.json({ auth_url: authUrl });
      }

      case 'exchange_code': {
        const tokens = await exchangeCodeForTokens(code, userId);
        const profile = await getMicrosoftProfile(tokens.access_token);
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        await query(`
          INSERT INTO email_accounts (user_id, email_address, display_name, access_token, refresh_token, expires_at, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, true)
          ON CONFLICT (user_id) DO UPDATE SET
            email_address = EXCLUDED.email_address, access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at, is_active = true
        `, [userId, profile.mail || profile.userPrincipalName, profile.displayName, tokens.access_token, tokens.refresh_token, expiresAt.toISOString()]);
        return res.json({ success: true, profile: { email: profile.mail || profile.userPrincipalName, name: profile.displayName } });
      }

      case 'send_email': {
        const account = await getEmailAccount(userId);
        const emailData = {
          message: {
            subject,
            body: { contentType: 'HTML', content: emailBody },
            toRecipients: to.map(e => ({ emailAddress: { address: e } })),
            ...(cc?.length && { ccRecipients: cc.map(e => ({ emailAddress: { address: e } })) }),
            ...(bcc?.length && { bccRecipients: bcc.map(e => ({ emailAddress: { address: e } })) }),
          }
        };
        const sendRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${account.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(emailData),
        });
        if (!sendRes.ok) throw new Error('Failed to send email');
        return res.json({ success: true });
      }

      case 'send_password_reset': {
        const account = await getEmailAccount(userId);
        // TODO: Generate password reset link via IBM App ID
        const resetLink = '#password-reset-not-yet-implemented';
        const htmlContent = buildPasswordResetEmail(recipientName, resetLink);
        const sendRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${account.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { subject: 'Password Reset Request - LoanFlow CRM', body: { contentType: 'HTML', content: htmlContent }, toRecipients: [{ emailAddress: { address: recipientEmail } }] } }),
        });
        if (!sendRes.ok) throw new Error('Failed to send password reset email');
        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('[microsoft-auth] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ──────────────────────────────────────────────────

async function exchangeCodeForTokens(code) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'organizations';
  const redirectUri = `${BASE_URL}/api/v1/functions/microsoft-auth`;

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!tokenRes.ok) throw new Error('Failed to exchange code for tokens');
  return tokenRes.json();
}

async function getMicrosoftProfile(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error('Failed to get user profile');
  return res.json();
}

async function getEmailAccount(userId) {
  const rows = await query(`SELECT * FROM email_accounts WHERE user_id = $1 AND is_active = true LIMIT 1`, [userId]);
  if (!rows.length) throw new Error('No active email account found');
  if (new Date(rows[0].expires_at) <= new Date()) throw new Error('Email token expired. Please reconnect Microsoft 365.');
  return rows[0];
}

function authPopupHtml(type, data) {
  return `<html><body><script>window.opener.postMessage(${JSON.stringify({ type, ...data })}, '*');window.close();</script><p>You can close this window.</p></body></html>`;
}

function buildPasswordResetEmail(name, link) {
  return `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px 20px;border-radius:8px 8px 0 0;text-align:center}.content{background:#f9f9f9;padding:30px 20px;border-radius:0 0 8px 8px}.button{display:inline-block;background:#667eea;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;margin:20px 0}</style></head><body><div class="container"><div class="header"><h2>Password Reset Request</h2><p>LoanFlow CRM</p></div><div class="content"><p>Hello ${name || 'there'},</p><p>A password reset has been requested for your account.</p><div style="text-align:center"><a href="${link}" class="button">Reset Password</a></div><p style="word-break:break-all;color:#667eea">${link}</p></div></div></body></html>`;
}

module.exports = router;
