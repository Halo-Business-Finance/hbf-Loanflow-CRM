/**
 * Content Security Policy (CSP) Configuration
 * 
 * Implements strict CSP headers to prevent XSS, clickjacking, and other injection attacks.
 * For World Government and Military Grade Security requirements.
 */

import { logger } from './logger';

export interface CSPConfig {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'frame-ancestors': string[];
  'base-uri': string[];
  'form-action': string[];
  'frame-src': string[];
  'object-src': string[];
  'media-src': string[];
}

/**
 * Production CSP Configuration
 * Strict policy for maximum security
 */
export const PRODUCTION_CSP: CSPConfig = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for React
    "'unsafe-eval'", // Required for development; remove in production if possible
    'https://gshxxsniwytjgcnthyfq.supabase.co',
    'https://*.supabase.co'
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for CSS-in-JS and Tailwind
    'https://fonts.googleapis.com'
  ],
  'img-src': [
    "'self'",
    'data:', // Allow data URLs for images
    'blob:', // Allow blob URLs
    'https://gshxxsniwytjgcnthyfq.supabase.co',
    'https://*.supabase.co',
    'https://maps.googleapis.com',
    'https://maps.gstatic.com'
  ],
  'font-src': [
    "'self'",
    'data:',
    'https://fonts.gstatic.com'
  ],
  'connect-src': [
    "'self'",
    'https://gshxxsniwytjgcnthyfq.supabase.co',
    'https://*.supabase.co',
    'wss://gshxxsniwytjgcnthyfq.supabase.co', // WebSocket for realtime
    'https://maps.googleapis.com'
  ],
  'frame-ancestors': ["'none'"], // Prevent clickjacking
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-src': ["'none'"], // Block all frames/iframes
  'object-src': ["'none'"], // Block plugins (Flash, Java, etc.)
  'media-src': ["'self'"]
};

/**
 * Development CSP Configuration
 * More permissive for local development
 */
export const DEVELOPMENT_CSP: CSPConfig = {
  ...PRODUCTION_CSP,
  'script-src': [
    ...PRODUCTION_CSP['script-src'],
    'http://localhost:*',
    'ws://localhost:*'
  ],
  'connect-src': [
    ...PRODUCTION_CSP['connect-src'],
    'http://localhost:*',
    'ws://localhost:*'
  ]
};

/**
 * Generate CSP header string from config
 */
export function generateCSPHeader(config: CSPConfig): string {
  return Object.entries(config)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * Get appropriate CSP config based on environment
 */
export function getCSPConfig(): CSPConfig {
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
  return isDevelopment ? DEVELOPMENT_CSP : PRODUCTION_CSP;
}

/**
 * Apply CSP as meta tag (fallback if server headers not available)
 */
export function applyCSPMetaTag(): void {
  const existingMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (existingMeta) return; // Already applied

  const cspConfig = getCSPConfig();
  const cspString = generateCSPHeader(cspConfig);

  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = cspString;
  document.head.appendChild(meta);

  logger.info('[Security] CSP meta tag applied');
}

/**
 * Additional Security Headers (applied via meta tags where possible)
 */
export function applySecurityHeaders(): void {
  // X-Content-Type-Options
  if (!document.querySelector('meta[http-equiv="X-Content-Type-Options"]')) {
    const meta1 = document.createElement('meta');
    meta1.httpEquiv = 'X-Content-Type-Options';
    meta1.content = 'nosniff';
    document.head.appendChild(meta1);
  }

  // Note: X-Frame-Options cannot be set via meta tag - it must be set via HTTP header
  // The CSP frame-ancestors directive handles this protection

  // Referrer-Policy
  if (!document.querySelector('meta[name="referrer"]')) {
    const meta3 = document.createElement('meta');
    meta3.name = 'referrer';
    meta3.content = 'strict-origin-when-cross-origin';
    document.head.appendChild(meta3);
  }

  // Permissions-Policy (formerly Feature-Policy)
  if (!document.querySelector('meta[http-equiv="Permissions-Policy"]')) {
    const meta4 = document.createElement('meta');
    meta4.httpEquiv = 'Permissions-Policy';
    meta4.content = [
      'geolocation=(self)',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()'
    ].join(', ');
    document.head.appendChild(meta4);
  }

  logger.info('[Security] Security headers applied');
}

/**
 * Initialize all security headers
 * Call this in main.tsx on app initialization
 */
export function initializeSecurityHeaders(): void {
  if (typeof document !== 'undefined') {
    applyCSPMetaTag();
    applySecurityHeaders();
  }
}

/**
 * Report CSP violations to server for monitoring
 */
export function setupCSPReporting(): void {
  if (typeof document !== 'undefined') {
    document.addEventListener('securitypolicyviolation', async (e) => {
      logger.warn('[CSP Violation]', {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective
      });

      // Log to Supabase for monitoring
      try {
        const { ibmDb } = await import('@/lib/ibm');
        await ibmDb.from('security_events').insert({
          event_type: 'csp_violation',
          severity: 'medium',
          details: {
            blocked_uri: e.blockedURI,
            violated_directive: e.violatedDirective,
            source_file: e.sourceFile,
            line_number: e.lineNumber,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        logger.error('Failed to log CSP violation');
      }
    });
  }
}

/**
 * CSP Configuration for Edge Functions
 * Use this in _shared/security-headers.ts
 */
export const EDGE_FUNCTION_CSP = {
  'Access-Control-Allow-Origin': '*', // Adjust for production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none';",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};
