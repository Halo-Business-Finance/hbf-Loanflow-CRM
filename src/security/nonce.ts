/**
 * Cryptographically secure nonce generation utility
 * Provides isolated crypto functionality for CSP nonce generation and future rotation logic
 */

let currentNonce: string | null = null;

/**
 * Generates a cryptographically secure random nonce
 * @returns Base64-encoded random nonce string
 */
export const generateNonce = (): string => {
  // Use Web Crypto API for cryptographically secure random values
  const array = new Uint8Array(16); // 128 bits of entropy
  crypto.getRandomValues(array);
  
  // Convert to base64 for use in CSP
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Gets or generates the current page nonce
 * Ensures single nonce per page load for consistency
 * @returns Current nonce string
 */
export const getCurrentNonce = (): string => {
  if (!currentNonce) {
    currentNonce = generateNonce();
  }
  return currentNonce;
};

/**
 * Resets the current nonce (useful for testing or SPA navigation)
 */
export const resetNonce = (): void => {
  currentNonce = null;
};

/**
 * Validates if a nonce meets minimum security requirements
 * @param nonce - Nonce to validate
 * @returns True if nonce is valid
 */
export const validateNonce = (nonce: string): boolean => {
  // Check minimum length (should be at least 16 characters base64)
  if (!nonce || nonce.length < 16) {
    return false;
  }
  
  // Check if it's valid base64url format
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  return base64UrlRegex.test(nonce);
};

/**
 * Future-ready: Nonce rotation configuration
 * Can be extended for automatic nonce rotation strategies
 */
export interface NonceRotationConfig {
  rotationInterval?: number; // milliseconds
  maxAge?: number; // milliseconds
  enabled?: boolean;
}

/**
 * Future-ready: Implement nonce rotation logic
 * @param config - Rotation configuration
 */
export const configureNonceRotation = (config: NonceRotationConfig): void => {
  // Placeholder for future nonce rotation implementation
  console.debug('Nonce rotation configured:', config);
  // TODO: Implement automatic rotation when needed
};