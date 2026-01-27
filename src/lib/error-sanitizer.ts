// Production-safe error sanitizer for security
// Prevents sensitive information leakage while maintaining user experience

const SENSITIVE_PATTERNS = [
  /password/gi,
  /token/gi,
  /secret/gi,
  /key/gi,
  /bearer/gi,
  /authorization/gi,
  /session/gi,
  /cookie/gi,
  /duplicate key value violates unique constraint/gi,
  /foreign key constraint/gi,
  /relation.*does not exist/gi,
  /column.*does not exist/gi,
]

const ERROR_MAPPINGS: Record<string, string> = {
  'Invalid login credentials': 'Invalid email or password. Please check your credentials.',
  'Email not confirmed': 'Please verify your email address before signing in.',
  'User already registered': 'An account with this email already exists.',
  'duplicate key': 'This record already exists in the system.',
  'foreign key': 'This operation cannot be completed due to related data.',
  'violates check constraint': 'The provided data does not meet requirements.',
  'not found': 'The requested resource was not found.',
  'permission denied': 'You do not have permission to perform this action.',
  'unauthorized': 'Authentication required. Please sign in.',
  'Network request failed': 'Network error. Please check your connection and try again.',
}

export const sanitizeError = (error: any): string => {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error?.message || 'An unexpected error occurred'

  // Check for mapped errors first
  for (const [pattern, userMessage] of Object.entries(ERROR_MAPPINGS)) {
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return userMessage
    }
  }

  // Check if error contains sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return 'An error occurred. Please try again or contact support if the issue persists.'
    }
  }

  // For production, return generic message for unknown errors
  if (import.meta.env.PROD) {
    return 'An error occurred. Please try again or contact support if the issue persists.'
  }

  // In development, show more details but still sanitized
  return errorMessage.substring(0, 150) + (errorMessage.length > 150 ? '...' : '')
}

export const logSecureError = async (
  error: any,
  context: string,
  supabaseClient?: any
) => {
  // Only log to server in production, console in development
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error)
  }

  // Log to security events table if supabase client available
  if (supabaseClient) {
    try {
      await supabaseClient.rpc('log_security_event', {
        p_event_type: 'application_error',
        p_severity: 'medium',
        p_details: {
          context,
          error: error?.message || String(error),
          timestamp: new Date().toISOString(),
        }
      })
    } catch (logError) {
      // Silently fail logging to avoid cascading errors
      if (import.meta.env.DEV) {
        console.error('Failed to log security event:', logError)
      }
    }
  }
}
