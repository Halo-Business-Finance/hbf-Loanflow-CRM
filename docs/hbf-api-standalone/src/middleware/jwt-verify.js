/**
 * IBM App ID JWKS-based JWT Verification Middleware
 *
 * Fetches the public keys from the App ID JWKS endpoint,
 * verifies the RS256 signature, and validates standard claims
 * (exp, iss, aud). Caches JWKS keys for 1 hour.
 */
const crypto = require('crypto');

// ── JWKS cache ───────────────────────────────────────────────
let jwksCache = null;
let jwksCacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Derive the JWKS URI from the App ID discovery endpoint.
 * IBM App ID discovery endpoints look like:
 *   https://<region>.appid.cloud.ibm.com/oauth/v4/<tenantId>/.well-known/openid-configuration
 * The JWKS URI is at:
 *   https://<region>.appid.cloud.ibm.com/oauth/v4/<tenantId>/publickeys
 */
function getJwksUri() {
  const discovery = process.env.IBM_APPID_DISCOVERY_ENDPOINT || '';
  if (!discovery) throw new Error('IBM_APPID_DISCOVERY_ENDPOINT not configured');

  // Strip /.well-known/openid-configuration and append /publickeys
  const base = discovery.replace(/\/\.well-known\/openid-configuration\/?$/, '');
  return `${base}/publickeys`;
}

function getExpectedIssuer() {
  const discovery = process.env.IBM_APPID_DISCOVERY_ENDPOINT || '';
  // Issuer is the base URL without the well-known suffix
  return discovery.replace(/\/\.well-known\/openid-configuration\/?$/, '');
}

// ── Fetch & cache JWKS ───────────────────────────────────────
async function fetchJwks() {
  if (jwksCache && Date.now() < jwksCacheExpiry) return jwksCache;

  const uri = getJwksUri();
  console.log('[jwt] Fetching JWKS from', uri);

  const res = await fetch(uri);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status} ${res.statusText}`);

  const body = await res.json();
  jwksCache = body.keys || [];
  jwksCacheExpiry = Date.now() + CACHE_TTL_MS;
  console.log(`[jwt] Cached ${jwksCache.length} key(s)`);
  return jwksCache;
}

// ── Base64url helpers ────────────────────────────────────────
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// ── Build PEM from JWK RSA key ───────────────────────────────
function jwkToPem(jwk) {
  const key = crypto.createPublicKey({
    key: {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    },
    format: 'jwk',
  });
  return key.export({ type: 'spki', format: 'pem' });
}

// ── Core verify function ─────────────────────────────────────
/**
 * Verify a JWT access token against IBM App ID JWKS.
 * Returns the decoded payload on success, throws on failure.
 */
async function verifyToken(token) {
  if (!token) throw new Error('No token provided');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  // Decode header
  const header = JSON.parse(base64urlDecode(parts[0]).toString());
  if (header.alg !== 'RS256') throw new Error(`Unsupported algorithm: ${header.alg}`);

  // Find matching key
  const keys = await fetchJwks();
  const key = header.kid
    ? keys.find(k => k.kid === header.kid)
    : keys[0];

  if (!key) throw new Error(`No matching key found for kid: ${header.kid}`);

  // Verify signature
  const pem = jwkToPem(key);
  const signatureInput = `${parts[0]}.${parts[1]}`;
  const signature = base64urlDecode(parts[2]);

  const isValid = crypto.createVerify('RSA-SHA256')
    .update(signatureInput)
    .verify(pem, signature);

  if (!isValid) throw new Error('Invalid token signature');

  // Decode & validate payload
  const payload = JSON.parse(base64urlDecode(parts[1]).toString());

  // Check expiry
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('Token expired');
  }

  // Check issuer
  const expectedIssuer = getExpectedIssuer();
  if (expectedIssuer && payload.iss && payload.iss !== expectedIssuer) {
    throw new Error(`Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`);
  }

  // Check audience (App ID client ID)
  const expectedAud = process.env.IBM_APPID_CLIENT_ID;
  if (expectedAud && payload.aud) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(expectedAud)) {
      throw new Error(`Invalid audience: ${payload.aud}`);
    }
  }

  return payload;
}

// ── Express middleware ────────────────────────────────────────
/**
 * Express middleware that verifies the Bearer token (or access_token in body).
 * On success, sets req.jwtPayload with the decoded claims.
 */
function jwtMiddleware(req, res, next) {
  // Extract token from Authorization header or body
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.body && req.body.access_token) {
    token = req.body.access_token;
  }

  if (!token) {
    return res.status(401).json({
      error: { message: 'Missing authentication token', code: 'UNAUTHORIZED' }
    });
  }

  verifyToken(token)
    .then(payload => {
      req.jwtPayload = payload;
      next();
    })
    .catch(err => {
      console.warn('[jwt] Verification failed:', err.message);
      res.status(401).json({
        error: { message: `Authentication failed: ${err.message}`, code: 'UNAUTHORIZED' }
      });
    });
}

/**
 * Invalidate the JWKS cache (useful for key rotation events).
 */
function clearJwksCache() {
  jwksCache = null;
  jwksCacheExpiry = 0;
}

module.exports = { verifyToken, jwtMiddleware, clearJwksCache };
