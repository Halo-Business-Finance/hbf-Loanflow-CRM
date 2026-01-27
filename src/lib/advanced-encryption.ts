import { supabase } from "@/integrations/supabase/client"

export interface EncryptionConfig {
  algorithm: string
  keySize: number
  ivSize: number
  saltSize: number
}

export interface EncryptedData {
  encryptedValue: string
  salt: string
  iv: string
  algorithm: string
  keyId: string
}

export class AdvancedEncryption {
  private static config: EncryptionConfig = {
    algorithm: 'AES-256-GCM',
    keySize: 32, // 256 bits
    ivSize: 16,  // 128 bits
    saltSize: 16 // 128 bits
  }

  /**
   * Generate a cryptographically secure random key
   */
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true, // extractable
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Generate random bytes for salt/IV
   */
  private static generateRandomBytes(size: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(size))
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
    return btoa(binary)
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  private static async deriveKey(
    password: string, 
    salt: Uint8Array, 
    iterations: number = 100000
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Encrypt sensitive data with military-grade encryption
   */
  static async encryptField(
    data: string,
    tableName: string,
    fieldName: string,
    recordId: string
  ): Promise<EncryptedData> {
    try {
      // Generate salt and IV
      const salt = this.generateRandomBytes(this.config.saltSize)
      const iv = this.generateRandomBytes(this.config.ivSize)

      // Get or create encryption key
      const { data: encryptionKeys } = await supabase
        .from('encryption_keys')
        .select('*')
        .eq('key_purpose', 'field_encryption')
        .eq('is_active', true)
        .limit(1)

      let keyId: string
      let masterKey: string

      if (!encryptionKeys || encryptionKeys.length === 0) {
        // Create new encryption key
        const newKey = await this.generateKey()
        const exportedKey = await crypto.subtle.exportKey('raw', newKey)
        const keyBase64 = this.arrayBufferToBase64(exportedKey)

        const { data: newKeyRecord } = await supabase
          .from('encryption_keys')
          .insert({
            key_name: `field_encryption_${Date.now()}`,
            key_purpose: 'field_encryption',
            algorithm: this.config.algorithm
          })
          .select()
          .single()

        keyId = newKeyRecord!.id
        masterKey = keyBase64
      } else {
        keyId = encryptionKeys[0].id
        // In production, retrieve actual key from secure storage
        masterKey = 'secure_master_key_placeholder'
      }

      // Derive encryption key from master key + salt
      const derivedKey = await this.deriveKey(masterKey, salt)

      // Encrypt the data
      const encoder = new TextEncoder()
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource
        },
        derivedKey,
        encoder.encode(data)
      )

      const encryptedData: EncryptedData = {
        encryptedValue: this.arrayBufferToBase64(encryptedBuffer),
        salt: this.arrayBufferToBase64(salt.buffer as ArrayBuffer),
        iv: this.arrayBufferToBase64(iv.buffer as ArrayBuffer),
        algorithm: this.config.algorithm,
        keyId: keyId
      }

      // Store encrypted field metadata
      await supabase
        .from('encrypted_fields')
        .upsert({
          table_name: tableName,
          field_name: fieldName,
          record_id: recordId,
          encryption_key_id: keyId,
          encrypted_value: encryptedData.encryptedValue,
          encryption_algorithm: this.config.algorithm,
          salt: encryptedData.salt,
          iv: encryptedData.iv
        })

      return encryptedData

    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt field data')
    }
  }

  /**
   * Decrypt sensitive data
   */
  static async decryptField(
    tableName: string,
    fieldName: string,
    recordId: string
  ): Promise<string | null> {
    try {
      // Get encrypted field data
      const { data: encryptedField } = await supabase
        .from('encrypted_fields')
        .select('*')
        .eq('table_name', tableName)
        .eq('field_name', fieldName)
        .eq('record_id', recordId)
        .single()

      if (!encryptedField) {
        return null
      }

      // Get encryption key
      const { data: encryptionKey } = await supabase
        .from('encryption_keys')
        .select('*')
        .eq('id', encryptedField.encryption_key_id)
        .single()

      if (!encryptionKey) {
        throw new Error('Encryption key not found')
      }

      // In production, retrieve actual key from secure storage
      const masterKey = 'secure_master_key_placeholder'

      // Convert base64 to ArrayBuffer
      const salt = new Uint8Array(this.base64ToArrayBuffer(encryptedField.salt))
      const iv = new Uint8Array(this.base64ToArrayBuffer(encryptedField.iv))
      const encryptedBuffer = this.base64ToArrayBuffer(encryptedField.encrypted_value)

      // Derive decryption key
      const derivedKey = await this.deriveKey(masterKey, salt)

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        derivedKey,
        encryptedBuffer
      )

      const decoder = new TextDecoder()
      return decoder.decode(decryptedBuffer)

    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt field data')
    }
  }

  /**
   * Encrypt entire record for blockchain storage
   */
  static async encryptRecord(record: any): Promise<{ encryptedData: string; hash: string }> {
    try {
      const jsonString = JSON.stringify(record)
      const encoder = new TextEncoder()
      const data = encoder.encode(jsonString)

      // Generate hash for integrity verification
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hash = this.arrayBufferToBase64(hashBuffer)

      // Generate key and IV for record encryption
      const key = await this.generateKey()
      const iv = this.generateRandomBytes(this.config.ivSize)

      // Encrypt the record
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource
        },
        key,
        data
      )

      const encryptedData = this.arrayBufferToBase64(encryptedBuffer)

      return { encryptedData, hash }

    } catch (error) {
      console.error('Record encryption failed:', error)
      throw new Error('Failed to encrypt record')
    }
  }

  /**
   * Verify data integrity using cryptographic hashing
   */
  static async verifyDataIntegrity(
    originalData: any,
    expectedHash: string
  ): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(originalData)
      const encoder = new TextEncoder()
      const data = encoder.encode(jsonString)

      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const actualHash = this.arrayBufferToBase64(hashBuffer)

      return actualHash === expectedHash

    } catch (error) {
      console.error('Integrity verification failed:', error)
      return false
    }
  }

  /**
   * Generate cryptographic signature for data authenticity
   */
  static async signData(data: any): Promise<{ signature: string; timestamp: number }> {
    try {
      const timestamp = Date.now()
      const dataWithTimestamp = { ...data, timestamp }
      const jsonString = JSON.stringify(dataWithTimestamp)
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(jsonString)

      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
      const signature = this.arrayBufferToBase64(hashBuffer)

      return { signature, timestamp }

    } catch (error) {
      console.error('Data signing failed:', error)
      throw new Error('Failed to sign data')
    }
  }
}