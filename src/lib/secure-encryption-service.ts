/**
 * Secure Encryption Service - Server-Side Key Management
 * 
 * This service provides encryption/decryption using keys derived server-side
 * to eliminate XSS vulnerabilities from client-side key storage.
 * 
 * Security Features:
 * - Keys derived server-side via Edge Function
 * - No client-side key persistence (not in localStorage or sessionStorage)
 * - Ephemeral in-memory cache with automatic expiry
 * - Audit logging for all key access
 */

import { supabase } from '@/integrations/supabase/client'

interface CachedKey {
  key: string
  expiresAt: number
}

class SecureEncryptionService {
  // Ephemeral in-memory cache only (cleared on page reload)
  private keyCache: Map<string, CachedKey> = new Map()
  private readonly KEY_CACHE_DURATION = 3600000 // 1 hour

  /**
   * Get encryption key from server (cached in memory only)
   */
  private async getServerDerivedKey(
    keyType: 'master' | 'field' | 'session',
    fieldIdentifier?: string
  ): Promise<string> {
    const cacheKey = `${keyType}:${fieldIdentifier || ''}`
    const now = Date.now()

    // Check ephemeral cache
    const cached = this.keyCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.key
    }

    try {
      // Fetch key from server-side Edge Function
      const { data, error } = await supabase.functions.invoke('encryption-key-service', {
        body: {
          action: 'derive',
          keyType,
          fieldIdentifier
        }
      })

      if (error) throw error
      if (!data.success) throw new Error(data.error || 'Key derivation failed')

      // Cache in memory only (never persisted)
      this.keyCache.set(cacheKey, {
        key: data.key,
        expiresAt: now + this.KEY_CACHE_DURATION
      })

      return data.key
    } catch (error) {
      console.error('Failed to get server-derived key:', error)
      throw new Error('Encryption service unavailable')
    }
  }

  /**
   * Convert base64 string to CryptoKey
   */
  private async importKey(keyBase64: string): Promise<CryptoKey> {
    const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
    
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Encrypt data using server-derived key
   */
  async encrypt(
    data: string,
    fieldType: 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii'
  ): Promise<string> {
    if (!data || data === '') return ''

    try {
      // Get server-derived key
      const keyBase64 = await this.getServerDerivedKey('field', fieldType)
      const key = await this.importKey(keyBase64)

      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(data)

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBuffer
      )

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength)
      combined.set(iv, 0)
      combined.set(new Uint8Array(encrypted), iv.length)

      return btoa(String.fromCharCode(...combined))
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Encryption failed')
    }
  }

  /**
   * Decrypt data using server-derived key
   */
  async decrypt(
    encryptedData: string,
    fieldType: 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii'
  ): Promise<string> {
    if (!encryptedData || encryptedData === '') return ''

    try {
      // Get server-derived key
      const keyBase64 = await this.getServerDerivedKey('field', fieldType)
      const key = await this.importKey(keyBase64)

      const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
      const iv = combined.slice(0, 12)
      const encrypted = combined.slice(12)

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      )

      const decoder = new TextDecoder()
      return decoder.decode(decrypted)
    } catch (error) {
      console.error('Decryption failed:', error)
      return '' // Return empty for corrupted data
    }
  }

  /**
   * Encrypt multiple fields
   */
  async encryptMultipleFields(
    data: Record<string, any>,
    fieldConfig: Record<string, 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii'>
  ): Promise<Record<string, any>> {
    const encrypted = { ...data }

    for (const [field, type] of Object.entries(fieldConfig)) {
      if (data[field]) {
        const value = typeof data[field] === 'string' ? data[field] : data[field].toString()
        encrypted[field] = await this.encrypt(value, type)
      }
    }

    return encrypted
  }

  /**
   * Decrypt multiple fields
   */
  async decryptMultipleFields(
    data: Record<string, any>,
    fieldConfig: Record<string, 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii'>
  ): Promise<Record<string, any>> {
    const decrypted = { ...data }

    for (const [field, type] of Object.entries(fieldConfig)) {
      if (data[field] && typeof data[field] === 'string') {
        const decryptedValue = await this.decrypt(data[field], type)

        // Convert back to number if needed
        if (type === 'credit_score' || type === 'loan_amount') {
          decrypted[field] = decryptedValue ? parseFloat(decryptedValue) : null
        } else {
          decrypted[field] = decryptedValue
        }
      }
    }

    return decrypted
  }

  /**
   * Clear all cached keys (security measure)
   */
  clearCache(): void {
    this.keyCache.clear()
  }

  /**
   * Request key rotation from server
   */
  async rotateKeys(keyType: 'master' | 'field' | 'session'): Promise<void> {
    try {
      await supabase.functions.invoke('encryption-key-service', {
        body: {
          action: 'rotate',
          keyType
        }
      })

      // Clear cache to force re-fetch
      this.clearCache()
    } catch (error) {
      console.error('Key rotation failed:', error)
      throw error
    }
  }
}

// Export singleton instance
export const secureEncryptionService = new SecureEncryptionService()

// Export lead encryption config
export const LEAD_ENCRYPTION_CONFIG = {
  credit_score: 'credit_score' as const,
  loan_amount: 'loan_amount' as const,
  annual_revenue: 'financial' as const,
  net_operating_income: 'financial' as const,
  existing_loan_amount: 'financial' as const,
  income: 'financial' as const,
  property_payment_amount: 'financial' as const,
  interest_rate: 'financial' as const,
  phone: 'pii' as const,
  bdo_telephone: 'pii' as const,
  business_address: 'pii' as const,
  location: 'pii' as const
}

// Utility functions
export const encryptLeadData = (leadData: any) =>
  secureEncryptionService.encryptMultipleFields(leadData, LEAD_ENCRYPTION_CONFIG)

export const decryptLeadData = (leadData: any) =>
  secureEncryptionService.decryptMultipleFields(leadData, LEAD_ENCRYPTION_CONFIG)