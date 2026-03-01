/**
 * Secure error handler — ported from supabase/functions/_shared/error-handler.ts
 * Never exposes internal errors to clients.
 */

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[error-handler] Internal error:', message);

  if (message.includes('Unauthorized') || message.includes('authentication'))
    return { error: 'Authentication failed. Please log in again.', code: 'AUTH_FAILED' };
  if (message.includes('permission') || message.includes('access') || message.includes('privileges'))
    return { error: 'You do not have permission to perform this action.', code: 'PERMISSION_DENIED' };
  if (message.includes('Rate limit'))
    return { error: 'Too many requests. Please try again later.', code: 'RATE_LIMIT' };
  if (message.includes('MFA'))
    return { error: 'Multi-factor authentication verification failed.', code: 'MFA_FAILED' };
  if (message.includes('validation') || message.includes('invalid') || message.includes('required'))
    return { error: 'Invalid input provided. Please check your data.', code: 'VALIDATION_ERROR' };
  if (message.includes('not found'))
    return { error: 'The requested resource was not found.', code: 'NOT_FOUND' };

  return { error: 'An error occurred processing your request. Please try again or contact support.', code: 'INTERNAL_ERROR' };
}

function errorResponse(res, error, statusCode = 500) {
  const sanitized = sanitizeError(error);
  return res.status(statusCode).json(sanitized);
}

module.exports = { sanitizeError, errorResponse };
