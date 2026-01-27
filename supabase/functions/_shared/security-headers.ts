// Enhanced security headers for edge functions
export const getSecurityHeaders = (additionalHeaders: Record<string, string> = {}) => {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'none'; object-src 'none';",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    ...additionalHeaders
  };
};

export const handleSecureOptions = () => {
  return new Response(null, { 
    headers: getSecurityHeaders(),
    status: 200
  });
};

// HTML escaping utility
export const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Input validation utilities
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

export const validatePhoneNumber = (phone: string): boolean => {
  // Remove all non-digit characters and validate format
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 15;
};

export const sanitizeString = (input: string, maxLength: number = 1000): string => {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
};