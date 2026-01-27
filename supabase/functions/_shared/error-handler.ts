// Secure error handling utilities for Edge Functions
// CRITICAL: Never expose internal errors to clients

import { SecureLogger } from './secure-logger.ts';

const logger = new SecureLogger('error-handler');

export interface ErrorResponse {
  error: string;
  code?: string;
}

// Map internal errors to safe, generic messages
export const sanitizeError = (error: unknown): ErrorResponse => {
  // Log full error server-side using secure logger (sanitizes sensitive data)
  logger.error('Internal error occurred', error instanceof Error ? error : new Error(String(error)));
  
  const message = error instanceof Error ? error.message : String(error);
  
  // Map specific known errors to user-friendly messages
  if (message.includes('Unauthorized') || message.includes('authentication')) {
    return { 
      error: 'Authentication failed. Please log in again.',
      code: 'AUTH_FAILED'
    };
  }
  
  if (message.includes('permission') || message.includes('access') || message.includes('privileges')) {
    return { 
      error: 'You do not have permission to perform this action.',
      code: 'PERMISSION_DENIED'
    };
  }
  
  if (message.includes('Rate limit')) {
    return { 
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT'
    };
  }
  
  if (message.includes('MFA')) {
    return { 
      error: 'Multi-factor authentication verification failed.',
      code: 'MFA_FAILED'
    };
  }
  
  if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
    return { 
      error: 'Invalid input provided. Please check your data.',
      code: 'VALIDATION_ERROR'
    };
  }
  
  if (message.includes('not found')) {
    return { 
      error: 'The requested resource was not found.',
      code: 'NOT_FOUND'
    };
  }
  
  // Default generic error (never expose database/internal details)
  return { 
    error: 'An error occurred processing your request. Please try again or contact support.',
    code: 'INTERNAL_ERROR'
  };
};

// Create standardized error response
export const createErrorResponse = (
  error: unknown, 
  corsHeaders: Record<string, string>,
  statusCode: number = 500
): Response => {
  const sanitized = sanitizeError(error);
  
  return new Response(
    JSON.stringify(sanitized),
    {
      status: statusCode,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      }
    }
  );
};

// Create success response
export const createSuccessResponse = (
  data: any,
  corsHeaders: Record<string, string>
): Response => {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      }
    }
  );
};
