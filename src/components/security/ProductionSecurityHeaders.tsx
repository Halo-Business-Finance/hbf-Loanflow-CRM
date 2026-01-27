import { useEffect } from "react";

interface SecurityHeadersConfig {
  contentSecurityPolicy: string;
  referrerPolicy: string;
  strictTransportSecurity: string;
  xContentTypeOptions: string;
  xFrameOptions: string;
  xXSSProtection: string;
  permissionsPolicy: string;
}

const defaultSecurityHeaders: SecurityHeadersConfig = {
  // Note: frame-ancestors and report-uri removed - only work via HTTP headers, not meta tags
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://gshxxsniwytjgcnthyfq.supabase.co https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://gshxxsniwytjgcnthyfq.supabase.co wss://gshxxsniwytjgcnthyfq.supabase.co https://maps.googleapis.com https://ipapi.co",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "worker-src 'self'",
    "child-src 'none'",
    "upgrade-insecure-requests"
  ].join("; "),
  referrerPolicy: "strict-origin-when-cross-origin",
  strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
  xXSSProtection: "1; mode=block",
  permissionsPolicy: [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "magnetometer=()",
    "accelerometer=()",
    "gyroscope=()",
    "fullscreen=(self)",
    "interest-cohort=()"
  ].join(", ")
};

export function ProductionSecurityHeaders() {
  useEffect(() => {
    // Apply security headers via meta tags for client-side applications
    const applySecurityHeaders = () => {
      // Content Security Policy
      const cspMeta = document.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      cspMeta.content = defaultSecurityHeaders.contentSecurityPolicy;
      document.head.appendChild(cspMeta);

      // Referrer Policy
      const referrerMeta = document.createElement('meta');
      referrerMeta.name = 'referrer';
      referrerMeta.content = defaultSecurityHeaders.referrerPolicy;
      document.head.appendChild(referrerMeta);

      // X-Content-Type-Options
      const noSniffMeta = document.createElement('meta');
      noSniffMeta.httpEquiv = 'X-Content-Type-Options';
      noSniffMeta.content = defaultSecurityHeaders.xContentTypeOptions;
      document.head.appendChild(noSniffMeta);

      // X-Frame-Options - REMOVED: Cannot be set via meta tag, must be HTTP header
      // The browser ignores X-Frame-Options in meta tags per W3C spec

      // X-XSS-Protection
      const xssMeta = document.createElement('meta');
      xssMeta.httpEquiv = 'X-XSS-Protection';
      xssMeta.content = defaultSecurityHeaders.xXSSProtection;
      document.head.appendChild(xssMeta);

      // Strict-Transport-Security
      const hstsMeta = document.createElement('meta');
      hstsMeta.httpEquiv = 'Strict-Transport-Security';
      hstsMeta.content = defaultSecurityHeaders.strictTransportSecurity;
      document.head.appendChild(hstsMeta);

      // Permissions Policy
      const permissionsMeta = document.createElement('meta');
      permissionsMeta.httpEquiv = 'Permissions-Policy';
      permissionsMeta.content = defaultSecurityHeaders.permissionsPolicy;
      document.head.appendChild(permissionsMeta);

      // Additional security headers
      const additionalHeaders = [
        { name: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        { name: 'X-Download-Options', value: 'noopen' },
        { name: 'X-DNS-Prefetch-Control', value: 'off' },
        { name: 'Expect-CT', value: 'max-age=86400, enforce' },
        { name: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
        { name: 'Pragma', value: 'no-cache' },
        { name: 'Expires', value: '0' }
      ];

      additionalHeaders.forEach(header => {
        const meta = document.createElement('meta');
        meta.httpEquiv = header.name;
        meta.content = header.value;
        document.head.appendChild(meta);
      });

      // Set security-related viewport meta tag
      const existingViewport = document.querySelector('meta[name="viewport"]');
      if (existingViewport) {
        const currentContent = existingViewport.getAttribute('content') || '';
        if (!currentContent.includes('user-scalable=no')) {
          existingViewport.setAttribute('content', 
            currentContent + ', user-scalable=no'
          );
        }
      }

      // Add integrity checks for external resources
      const addIntegrityChecks = () => {
        const links = document.querySelectorAll('link[rel="stylesheet"][href*="googleapis"]');
        links.forEach((link) => {
          if (!link.hasAttribute('integrity')) {
            link.setAttribute('crossorigin', 'anonymous');
            // Note: In production, you should generate actual SRI hashes
            console.warn('External stylesheet loaded without SRI hash:', link.getAttribute('href'));
          }
        });

        const scripts = document.querySelectorAll('script[src*="googleapis"]');
        scripts.forEach((script) => {
          if (!script.hasAttribute('integrity')) {
            script.setAttribute('crossorigin', 'anonymous');
            console.warn('External script loaded without SRI hash:', script.getAttribute('src'));
          }
        });
      };

      // Run integrity checks after DOM is loaded
      setTimeout(addIntegrityChecks, 100);
    };

    // Apply headers immediately
    applySecurityHeaders();

    // Monitor for dynamically added resources
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check for new script tags
            if (element.tagName === 'SCRIPT' && element.getAttribute('src')) {
              const src = element.getAttribute('src');
              if (src && (src.includes('http') && !src.includes(window.location.origin))) {
                console.warn('External script added without security review:', src);
              }
            }
            
            // Check for new link tags
            if (element.tagName === 'LINK' && element.getAttribute('href')) {
              const href = element.getAttribute('href');
              if (href && (href.includes('http') && !href.includes(window.location.origin))) {
                console.warn('External resource added without security review:', href);
              }
            }
          }
        });
      });
    });

    // Start monitoring
    observer.observe(document.head, {
      childList: true,
      subtree: true
    });

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    // Client-side security monitoring
    const monitorSecurityViolations = () => {
      // Monitor for CSP violations
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error('CSP Violation:', {
          blockedURI: event.blockedURI,
          violatedDirective: event.violatedDirective,
          originalPolicy: event.originalPolicy,
          lineNumber: event.lineNumber,
          sourceFile: event.sourceFile
        });

        // In production, you would send this to your security monitoring service
        // logSecurityEvent('csp_violation', event);
      });

      // Monitor for mixed content
      const checkMixedContent = () => {
        if (location.protocol === 'https:') {
          const insecureElements = document.querySelectorAll(
            'img[src^="http:"], script[src^="http:"], link[href^="http:"]'
          );
          
          if (insecureElements.length > 0) {
            console.warn('Mixed content detected:', insecureElements);
          }
        }
      };

      // Check initially and on DOM changes
      checkMixedContent();
      
      const contentObserver = new MutationObserver(checkMixedContent);
      contentObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      return () => {
        contentObserver.disconnect();
      };
    };

    const cleanup = monitorSecurityViolations();
    
    return cleanup;
  }, []);

  // Enable additional security features
  useEffect(() => {
    // Disable right-click context menu in production
    const handleContextMenu = (e: MouseEvent) => {
      if (process.env.NODE_ENV === 'production') {
        e.preventDefault();
        return false;
      }
    };

    // Disable text selection in sensitive areas
    const disableSelection = () => {
      const sensitiveElements = document.querySelectorAll(
        '[data-sensitive="true"], .sensitive-data'
      );
      
      sensitiveElements.forEach((element) => {
        (element as HTMLElement).style.userSelect = 'none';
        (element as HTMLElement).style.webkitUserSelect = 'none';
      });
    };

    // Prevent dev tools detection (basic)
    const preventDevTools = () => {
      if (process.env.NODE_ENV === 'production') {
        const detectDevTools = () => {
          const threshold = 160;
          if (window.outerHeight - window.innerHeight > threshold ||
              window.outerWidth - window.innerWidth > threshold) {
            console.warn('Developer tools detected');
            // In production, you might want to take additional security measures
          }
        };

        setInterval(detectDevTools, 1000);
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    disableSelection();
    preventDevTools();

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return null; // This component doesn't render anything visible
}

// Hook for checking security header compliance
export function useSecurityCompliance() {
  const checkCompliance = () => {
    const compliance = {
      csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
      referrer: !!document.querySelector('meta[name="referrer"]'),
      permissions: !!document.querySelector('meta[http-equiv="Permissions-Policy"]'),
      https: location.protocol === 'https:',
      noSniff: !!document.querySelector('meta[http-equiv="X-Content-Type-Options"]'),
      xFrameOptions: !!document.querySelector('meta[http-equiv="X-Frame-Options"]'),
      xssProtection: !!document.querySelector('meta[http-equiv="X-XSS-Protection"]'),
      hsts: !!document.querySelector('meta[http-equiv="Strict-Transport-Security"]'),
      cacheControl: !!document.querySelector('meta[http-equiv="Cache-Control"]'),
      expectCT: !!document.querySelector('meta[http-equiv="Expect-CT"]')
    };

    const score = Object.values(compliance).filter(Boolean).length / 
                   Object.values(compliance).length * 100;

    return {
      compliance,
      score: Math.round(score),
      isCompliant: score >= 90,
      details: compliance
    };
  };

  return { checkCompliance };
}