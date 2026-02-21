/**
 * Secure Encryption Service - Server-Side Key Management
 * 
 * This service provides encryption/decryption using keys derived server-side
 * to eliminate XSS vulnerabilities from client-side key storage.
 */

import { ibmDb } from '@/lib/ibm'

interface CachedKey {
  key: string
  expiresAt: number
}

class SecureEncryptionService {
  private keyCache: Map<string, CachedKey> = new Map()
  private readonly KEY_CACHE_DURATION = 3600000

  private async getServerDerivedKey(
    keyType: 'master' | 'field' | 'session',
    fieldIdentifier?: string
  ): Promise<string> {
    const cacheKey = `${keyType}:${fieldIdentifier || ''}`
    const now = Date.now()

    const cached = this.keyCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.key
    }

    try {
      const { data, error } = await ibmDb.rpc('encryption-key-service', {
        action: 'derive',
        keyType,
        fieldIdentifier
      })

      if (error) throw error
      const result = data as any
      if (!result.success) throw new Error(result.error || 'Key derivation failed')

      this.keyCache.set(cacheKey, {
        key: result.key,
        expiresAt: now + this.KEY_CACHE_DURATION
      })

      return result.key
    } catch (error) {
      console.error('Failed to get server-derived key:', error)
      throw new Error('Encryption service unavailable')
    }
  }

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

  async encrypt(
    data: string,
    fieldType: 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii'
  ): Promise<string> {
    if (!data || data === '') return ''

    try {
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

      const combined = new Uint8Array(iv.length + encrypted.byteLength)
      combined.set(iv, 0)
      combined.set(new Uint8Array(encrypted), iv.length)

      return btoa(String.fromCharCode(...combined))
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Encryption failed')
    }
  }

  async decrypt(
    encryptedData: string,
    fieldType: 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii'
  ): Promise<string> {
    if (!encryptedData || encryptedData === '') return ''

    try {
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
      return ''
    }
  }

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

  async decryptMultipleFields(
    data: Record<string, any>,
    fieldConfig: Record<string, 'ssn' | 'credit_score' | 'loan_amount' | 'financial' | 'pii'>
  ): Promise<Record<string, any>> {
    const decrypted = { ...data }

    for (const [field, type] of Object.entries(fieldConfig)) {
      if (data[field] && typeof data[field] === 'string') {
        const decryptedValue = await this.decrypt(data[field], type)

        if (type === 'credit_score' || type === 'loan_amount') {
          decrypted[field] = decryptedValue ? parseFloat(decryptedValue) : null
        } else {
          decrypted[field] = decryptedValue
        }
      }
    }

    return decrypted
  }

  clearCache(): void {
    this.keyCache.clear()
  }

  async rotateKeys(keyType: 'master' | 'field' | 'session'): Promise<void> {
    try {
      await ibmDb.rpc('encryption-key-service', {
        action: 'rotate',
        keyType
      })

      this.clearCache()
    } catch (error) {
      console.error('Key rotation failed:', error)
      throw error
    }
  }
}

export const secureEncryptionService = new SecureEncryptionService()

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

export const encryptLeadData = (leadData: any) =>
  secureEncryptionService.encryptMultipleFields(leadData, LEAD_ENCRYPTION_CONFIG)

export const decryptLeadData = (leadData: any) =>
  secureEncryptionService.decryptMultipleFields(leadData, LEAD_ENCRYPTION_CONFIG)
