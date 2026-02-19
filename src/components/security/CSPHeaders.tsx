import React, { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { applyClientSecurityHeaders, getEnhancedSecurityHeaders } from '@/lib/security-headers';
import { getCurrentNonce } from '@/security/nonce';

interface SecurityHeader {
  header_name: string;
  header_value: string;
  is_active: boolean;
}

/**
 * Builds a strict Content Security Policy with nonce support
 * @param nonce - Cryptographically secure nonce for inline scripts/styles
 * @param customOverrides - Optional environment-specific overrides
 */
const buildStrictCSP = (nonce: string, customOverrides?: Record<string, string[]>): string => {
  // Get environment-specific configuration
  const isProduction = import.meta.env.PROD;
  const isDevelopment = import.meta.env.DEV;
  
  // Base strict policy - deny by default
  const basePolicy = {
    'default-src': ["'none'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // Allow essential third-party scripts in development
      ...(isDevelopment ? ["'unsafe-eval'", "https://cdn.jsdelivr.net"] : [])
    ],
    'style-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'unsafe-inline'", // Needed for CSS-in-JS libraries like styled-components
      "https://fonts.googleapis.com"
    ],
    'font-src': [
      "'self'",
      "https://fonts.gstatic.com"
    ],
    'img-src': [
      "'self'",
      "data:",
      "https:",
      "blob:"
    ],
    'connect-src': [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      // Add environment-specific API endpoints
      ...(import.meta.env.VITE_API_URL ? [import.meta.env.VITE_API_URL] : []),
      ...(import.meta.env.VITE_SUPABASE_URL ? [import.meta.env.VITE_SUPABASE_URL] : [])
    ],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'media-src': ["'self'"],
    'worker-src': ["'self'", "blob:"], // Allow Web Workers
    'manifest-src': ["'self'"]
  };

  // Apply custom overrides if provided
  if (customOverrides) {
    Object.keys(customOverrides).forEach(directive => {
      if (basePolicy[directive as keyof typeof basePolicy]) {
        basePolicy[directive as keyof typeof basePolicy] = [
          ...basePolicy[directive as keyof typeof basePolicy],
          ...customOverrides[directive]
        ];
      }
    });
  }

  // Add upgrade-insecure-requests in production
  const additionalDirectives = isProduction ? ['upgrade-insecure-requests'] : [];

  // Build CSP string
  const cspDirectives = Object.entries(basePolicy)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .concat(additionalDirectives);

  return cspDirectives.join('; ');
};

/**
 * Applies additional security headers via meta tags (development preview)
 * Production should set these via HTTP headers
 */
const applySecurityMetaTags = (): void => {
  const securityHeaders = [
    { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
    { name: 'X-Content-Type-Options', content: 'nosniff' },
    { name: 'X-Frame-Options', content: 'DENY' },
    { name: 'X-XSS-Protection', content: '1; mode=block' }
  ];

  securityHeaders.forEach(({ name, content }) => {
    const existingMeta = document.querySelector(`meta[http-equiv="${name}"]`);
    if (!existingMeta) {
      const meta = document.createElement('meta');
      meta.setAttribute('http-equiv', name);
      meta.setAttribute('content', content);
      meta.setAttribute('data-source', 'csp-headers-component');
      document.head.appendChild(meta);
    }
  });

  // Add Permissions-Policy placeholder (prepare for future restrictions)
  const existingPermissions = document.querySelector('meta[http-equiv="Permissions-Policy"]');
  if (!existingPermissions) {
    const permissionsMeta = document.createElement('meta');
    permissionsMeta.setAttribute('http-equiv', 'Permissions-Policy');
    permissionsMeta.setAttribute('content', 'camera=(), microphone=(), geolocation=()');
    permissionsMeta.setAttribute('data-source', 'csp-headers-component');
    document.head.appendChild(permissionsMeta);
  }
};

export const CSPHeaders: React.FC = () => {
  useEffect(() => {
    // Generate nonce once per page load
    const nonce = getCurrentNonce();
    
    // Apply enhanced client-side security headers (backward compatibility)
    // Always apply baseline client-side measures
    applyClientSecurityHeaders();

    // Skip dynamic CSP when in development or embedded in an iframe (Lovable preview)
    const isIframe = window.self !== window.top;
    if (import.meta.env.DEV || isIframe) {
      return; // Prevent preview blank screens caused by restrictive dynamic CSP
    }
    
    // Apply additional security meta tags for development preview
    applySecurityMetaTags();
    
    // Build and apply strict CSP with nonce
    const applyStrictCSP = () => {
      // Remove existing CSP meta tags to avoid conflicts
      const existingCSPs = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
      existingCSPs.forEach(csp => {
        if (csp.getAttribute('data-source') === 'csp-headers-component') {
          csp.remove();
        }
      });

      // Create strict CSP with nonce
      const strictCSP = buildStrictCSP(nonce);
      const metaCSP = document.createElement('meta');
      metaCSP.setAttribute('http-equiv', 'Content-Security-Policy');
      metaCSP.setAttribute('content', strictCSP);
      metaCSP.setAttribute('data-source', 'csp-headers-component');
      metaCSP.setAttribute('data-nonce', nonce);
      document.head.appendChild(metaCSP);
      
      console.log('Applied strict CSP with nonce:', nonce.substring(0, 8) + '...');
      if (import.meta.env.DEV) {
        console.log('Full CSP:', strictCSP);
      }
    };

    // Apply strict CSP initially
    applyStrictCSP();
    
    // Fetch and apply dynamic security headers from database (preserve existing functionality)
    // Fetch and apply dynamic security headers from database (production only, not embedded)
    const applyDynamicSecurityHeaders = async () => {
      try {
        const { data: headers } = await supabase
          .from('security_headers')
          .select('*')
          .eq('is_active', true);

        if (headers) {
          headers.forEach((header: SecurityHeader) => {
            if (header.header_name === 'Content-Security-Policy') {
              // Remove existing dynamic CSP meta tag
              const existingCSP = document.querySelector(
                'meta[http-equiv="Content-Security-Policy"][data-dynamic="true"]'
              );
              if (existingCSP) {
                existingCSP.remove();
              }
              
              // Enhance dynamic CSP with nonce if not present
              let cspContent = header.header_value;
              if (!cspContent.includes(`'nonce-${nonce}'`)) {
                // Add nonce to script-src and style-src if they exist
                cspContent = cspContent
                  .replace(/(script-src[^;]*)/i, `$1 'nonce-${nonce}'`)
                  .replace(/(style-src[^;]*)/i, `$1 'nonce-${nonce}'`);
              }
              

              // Create new dynamic CSP meta tag
              const metaCSP = document.createElement('meta');
              metaCSP.setAttribute('http-equiv', 'Content-Security-Policy');
              metaCSP.setAttribute('content', cspContent);
              metaCSP.setAttribute('data-dynamic', 'true');
              metaCSP.setAttribute('data-nonce', nonce);
              document.head.appendChild(metaCSP);
              
              console.log('Applied dynamic CSP with nonce enhancement');
            }
          });
        }
      } catch (error) {
        console.error('Failed to apply dynamic security headers:', error);
        // Fallback to strict CSP if database fetch fails
        applyStrictCSP();
      }
    };

    // Defer security headers fetch until after page load to avoid blocking critical rendering path
    // Only fetch after window load event completes
    const loadHandler = () => {
      setTimeout(() => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => applyDynamicSecurityHeaders(), { timeout: 5000 });
        } else {
          applyDynamicSecurityHeaders();
        }
      }, 2000);
    };

    if (document.readyState === 'complete') {
      loadHandler();
    } else {
      window.addEventListener('load', loadHandler, { once: true });
    }

    // Refresh dynamic headers every 60 seconds (reduced frequency, also deferred)
    const interval = setInterval(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => applyDynamicSecurityHeaders(), { timeout: 5000 });
      } else {
        applyDynamicSecurityHeaders();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return null; // This component doesn't render anything
};

/**
 * Export helper function for other modules needing the current nonce
 * Useful for dynamic inline scripts, Web Worker bootstrap, etc.
 */
export { getCurrentNonce };