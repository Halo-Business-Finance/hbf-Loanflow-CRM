/**
 * ENHANCED SECURITY HEADERS - Standardized across all edge functions
 * Implements military-grade security headers with comprehensive protection
 */

export interface EnhancedSecurityConfig {
  enableHSTS?: boolean;
  enableCSP?: boolean;
  enableAdditionalHeaders?: boolean;
  customCSP?: string;
  environment?: 'development' | 'production';
}

/**
 * Get comprehensive security headers for edge functions
 */
export const getSecureEdgeFunctionHeaders = (config: EnhancedSecurityConfig = {}) => {
  const {
    enableHSTS = true,
    enableCSP = true,
    enableAdditionalHeaders = true,
    customCSP,
    environment = 'production'
  } = config;

  const headers: Record<string, string> = {
    // CORS Headers (required for web app communication)
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token, x-request-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    
    // Content Security Headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Cache Control (prevent sensitive data caching)
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  // HSTS for HTTPS enforcement
  if (enableHSTS && environment === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  // Content Security Policy
  if (enableCSP) {
    const csp = customCSP || [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ');
    
    headers['Content-Security-Policy'] = csp;
  }

  // Additional Security Headers
  if (enableAdditionalHeaders) {
    headers['X-Permitted-Cross-Domain-Policies'] = 'none';
    headers['X-Download-Options'] = 'noopen';
    headers['X-DNS-Prefetch-Control'] = 'off';
    headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()';
    headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    headers['Cross-Origin-Resource-Policy'] = 'same-origin';
  }

  return headers;
};

/**
 * Enhanced CORS headers with security
 */
export const getSecureCorsHeaders = () => getSecureEdgeFunctionHeaders();

/**
 * Validation for edge function security
 */
export const validateEdgeFunctionSecurity = (headers: Record<string, string>): boolean => {
  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection',
    'Access-Control-Allow-Origin'
  ];

  return requiredHeaders.every(header => 
    headers[header] !== undefined
  );
};

/**
 * Edge function response wrapper with security headers
 */
export const createSecureResponse = (
  data: any, 
  status: number = 200, 
  additionalHeaders: Record<string, string> = {}
) => {
  const securityHeaders = getSecureEdgeFunctionHeaders();
  
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...securityHeaders,
        'Content-Type': 'application/json',
        ...additionalHeaders
      }
    }
  );
};

/**
 * Handle OPTIONS requests with security headers
 */
export const handleSecureOptions = () => {
  return new Response(null, {
    status: 200,
    headers: getSecureEdgeFunctionHeaders()
  });
};