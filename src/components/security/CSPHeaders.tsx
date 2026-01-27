import React, { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { applyClientSecurityHeaders, getEnhancedSecurityHeaders } from '@/lib/security-headers';

interface SecurityHeader {
  header_name: string;
  header_value: string;
  is_active: boolean;
}

export const CSPHeaders: React.FC = () => {
  useEffect(() => {
    // Always apply baseline client-side measures
    applyClientSecurityHeaders();

    // Skip dynamic CSP when in development or embedded in an iframe (Lovable preview)
    const isIframe = window.self !== window.top;
    if (import.meta.env.DEV || isIframe) {
      return; // Prevent preview blank screens caused by restrictive dynamic CSP
    }
    
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

              // Create new dynamic CSP meta tag
              const metaCSP = document.createElement('meta');
              metaCSP.setAttribute('http-equiv', 'Content-Security-Policy');
              metaCSP.setAttribute('content', header.header_value);
              metaCSP.setAttribute('data-dynamic', 'true');
              document.head.appendChild(metaCSP);
            }
          });
        }
      } catch (error) {
        console.error('Failed to apply dynamic security headers:', error);
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