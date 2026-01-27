/**
 * Enhanced security headers for edge functions and client-side security
 */

export interface SecurityHeadersConfig {
  enableCSP?: boolean;
  enableXFrameOptions?: boolean;
  enableHSTS?: boolean;
  enableXContentTypeOptions?: boolean;
  enableReferrerPolicy?: boolean;
  customCSP?: string;
}

export const getEnhancedSecurityHeaders = (config: SecurityHeadersConfig = {}) => {
  const {
    enableCSP = true,
    enableXFrameOptions = true,
    enableHSTS = true,
    enableXContentTypeOptions = true,
    enableReferrerPolicy = true,
    customCSP
  } = config;

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };

  if (enableCSP) {
    const defaultCSP = customCSP || [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://acrobatservices.adobe.com https://documentservices.adobe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://acrobatservices.adobe.com https://documentservices.adobe.com",
      "font-src 'self' https://fonts.gstatic.com https://acrobatservices.adobe.com https://documentservices.adobe.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.github.com https://acrobatservices.adobe.com https://documentservices.adobe.com https://*.adobe.io https://*.adobe.com https://login.microsoftonline.com https://*.microsoftonline.com https://graph.microsoft.com",
      "frame-src 'self' https://acrobatservices.adobe.com https://documentservices.adobe.com https://login.microsoftonline.com https://*.microsoftonline.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // frame-ancestors removed - only works via HTTP header, not meta tag
      "manifest-src 'self'",
      "media-src 'self'",
      "worker-src 'self' blob: https://acrobatservices.adobe.com https://documentservices.adobe.com",
      "child-src 'self' https://acrobatservices.adobe.com https://documentservices.adobe.com",
      // report-uri removed - only works via HTTP header, not meta tag
      "upgrade-insecure-requests"
    ].join('; ');

    headers['Content-Security-Policy'] = defaultCSP;
  }

  if (enableXFrameOptions) {
    headers['X-Frame-Options'] = 'DENY';
  }

  if (enableHSTS) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  if (enableXContentTypeOptions) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  if (enableReferrerPolicy) {
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
  }

  // Additional security headers
  headers['X-XSS-Protection'] = '1; mode=block';
  headers['X-Permitted-Cross-Domain-Policies'] = 'none';
  headers['X-Download-Options'] = 'noopen';
  headers['X-DNS-Prefetch-Control'] = 'off';
  headers['Expect-CT'] = 'max-age=86400, enforce';
  headers['Feature-Policy'] = "geolocation 'none'; microphone 'none'; camera 'none'";
  headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=(), payment=(), usb=()';
  headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private';
  headers['Pragma'] = 'no-cache';
  headers['Expires'] = '0';

  return headers;
};

/**
 * Apply security headers to client-side
 */
export const applyClientSecurityHeaders = () => {
  // Create CSP meta tag if not exists
  if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    const csp = document.createElement('meta');
    csp.setAttribute('http-equiv', 'Content-Security-Policy');
    csp.setAttribute('content', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://acrobatservices.adobe.com https://documentservices.adobe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://acrobatservices.adobe.com https://documentservices.adobe.com",
      "font-src 'self' https://fonts.gstatic.com https://acrobatservices.adobe.com https://documentservices.adobe.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://acrobatservices.adobe.com https://documentservices.adobe.com https://*.adobe.io https://*.adobe.com https://login.microsoftonline.com https://*.microsoftonline.com https://graph.microsoft.com",
      "frame-src 'self' https://acrobatservices.adobe.com https://documentservices.adobe.com https://login.microsoftonline.com https://*.microsoftonline.com",
      "object-src 'none'",
      "manifest-src 'self'",
      "media-src 'self'",
      "worker-src 'self' blob: https://acrobatservices.adobe.com https://documentservices.adobe.com",
      "child-src 'self' https://acrobatservices.adobe.com https://documentservices.adobe.com"
    ].join('; '));
    document.head.appendChild(csp);
  }

  // Set additional security measures
  try {
    // Disable right-click context menu on production
    if (import.meta.env.PROD) {
      document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Disable F12, Ctrl+Shift+I, Ctrl+U on production
    if (import.meta.env.PROD) {
      document.addEventListener('keydown', (e) => {
        if (
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.key === 'u')
        ) {
          e.preventDefault();
        }
      });
    }
  } catch (error) {
    // Silently fail in production to avoid exposing security implementation details
  }
};

/**
 * Enhanced CORS headers for edge functions
 */
export const enhancedCorsHeaders = getEnhancedSecurityHeaders();

/**
 * Validate security headers in responses
 */
export const validateSecurityHeaders = (response: Response): boolean => {
  const requiredHeaders = [
    'x-frame-options',
    'x-content-type-options',
    'x-xss-protection'
  ];

  return requiredHeaders.every(header => 
    response.headers.has(header)
  );
};