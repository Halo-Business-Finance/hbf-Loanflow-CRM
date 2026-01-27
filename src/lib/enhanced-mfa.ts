/**
 * Enhanced Multi-Factor Authentication Implementation
 * Provides multiple layers of authentication security
 * 
 * SECURITY: Uses server-side encryption via Edge Functions
 */

import { supabase } from "@/integrations/supabase/client";
import { SecurityManager } from "./security";
import { encryptData, decryptData } from "./server-encryption";
import { logger } from "./logger";

export class EnhancedMFA {
  private static totpSecrets = new Map<string, string>();
  private static backupCodes = new Map<string, string[]>();

  // Generate TOTP secret for authenticator apps
  static async generateTOTPSecret(userId: string): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  }> {
    // Generate base32 secret for TOTP
    const secret = this.generateBase32Secret();
    
    // Store encrypted secret using server-side encryption
    const encryptResult = await encryptData(secret, 'totp_secret');
    if (encryptResult.success && encryptResult.encrypted) {
      this.totpSecrets.set(userId, encryptResult.encrypted);
    }
    
    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    );
    
    // Store encrypted backup codes using server-side encryption
    const encryptedBackupCodes: string[] = [];
    for (const code of backupCodes) {
      const result = await encryptData(code, 'backup_code');
      if (result.success && result.encrypted) {
        encryptedBackupCodes.push(result.encrypted);
      }
    }
    this.backupCodes.set(userId, encryptedBackupCodes);
    
    // Generate QR code data
    const appName = 'LoanFlow';
    const qrCodeData = `otpauth://totp/${appName}:${userId}?secret=${secret}&issuer=${appName}`;
    
    return {
      secret,
      qrCode: qrCodeData,
      backupCodes
    };
  }

  // Verify TOTP code from authenticator app
  static async verifyTOTP(userId: string, code: string): Promise<boolean> {
    const encryptedSecret = this.totpSecrets.get(userId);
    if (!encryptedSecret) return false;
    
    try {
      const decryptResult = await decryptData(encryptedSecret, 'totp_secret');
      if (!decryptResult.success || !decryptResult.decrypted) return false;
      return await this.validateTOTPCode(decryptResult.decrypted, code);
    } catch (error) {
      logger.error('TOTP verification failed');
      return false;
    }
  }

  // Generate backup codes
  static async generateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = Array.from({ length: 10 }, () => 
      Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    );
    
    const encryptedBackupCodes: string[] = [];
    for (const code of backupCodes) {
      const result = await encryptData(code, 'backup_code');
      if (result.success && result.encrypted) {
        encryptedBackupCodes.push(result.encrypted);
      }
    }
    
    this.backupCodes.set(userId, encryptedBackupCodes);
    
    return backupCodes;
  }

  // Verify backup code
  static async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const encryptedBackupCodes = this.backupCodes.get(userId);
    if (!encryptedBackupCodes) return false;
    
    try {
      const decryptedCodes: string[] = [];
      for (const encrypted of encryptedBackupCodes) {
        const result = await decryptData(encrypted, 'backup_code');
        if (result.success && result.decrypted) {
          decryptedCodes.push(result.decrypted);
        }
      }
      
      const codeIndex = decryptedCodes.indexOf(code.toUpperCase());
      if (codeIndex === -1) return false;
      
      // Remove used backup code
      encryptedBackupCodes.splice(codeIndex, 1);
      this.backupCodes.set(userId, encryptedBackupCodes);
      
      return true;
    } catch (error) {
      logger.error('Backup code verification failed');
      return false;
    }
  }

  // Biometric authentication (if available)
  static async enableBiometricAuth(): Promise<boolean> {
    if (!('credentials' in navigator)) return false;
    
    try {
      // Check if WebAuthn is supported
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'LoanFlow',
            id: window.location.hostname
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(64)),
            name: 'user@loanflow.com',
            displayName: 'LoanFlow User'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000,
          attestation: 'direct'
        }
      });
      
      if (credential) {
        // Store biometric credential securely via server-side encryption
        const pkCredential = credential as PublicKeyCredential;
        const credentialData = {
          id: credential.id,
          rawId: Array.from(new Uint8Array(pkCredential.rawId)),
          type: credential.type
        };
        
        const encryptResult = await encryptData(credentialData, 'biometric');
        if (encryptResult.success && encryptResult.encrypted) {
          await supabase.rpc('store_secure_session_data', {
            p_key: 'biometric_credential',
            p_value: encryptResult.encrypted
          });
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Biometric authentication setup failed');
      return false;
    }
  }

  // Verify biometric authentication
  static async verifyBiometricAuth(): Promise<boolean> {
    if (!('credentials' in navigator)) return false;
    
    try {
      const { data: encryptedData } = await supabase.rpc('get_secure_session_data', {
        p_key: 'biometric_credential'
      });
      if (!encryptedData) return false;
      
      const decryptResult = await decryptData(encryptedData as string, 'biometric');
      if (!decryptResult.success || !decryptResult.decrypted) return false;
      
      const storedCredential = decryptResult.decrypted;
      if (!storedCredential) return false;
      
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{
            id: new Uint8Array(storedCredential.rawId),
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60000
        }
      });
      
      return !!assertion;
    } catch (error) {
      logger.error('Biometric authentication failed');
      return false;
    }
  }

  // SMS verification
  static async sendSMSVerification(phoneNumber: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
      // In production, integrate with SMS service
      await supabase.functions.invoke('secure-external-api', {
        body: {
          service: 'sms',
          action: 'send_verification',
          phone: phoneNumber,
          code
        }
      });
      
      // Store encrypted code using server-side encryption
      const encryptResult = await encryptData(code, 'sms_code');
      if (encryptResult.success && encryptResult.encrypted) {
        await supabase.rpc('store_secure_session_data', {
          p_key: `_sms_code_${phoneNumber}`,
          p_value: encryptResult.encrypted,
        });
      }
      
      // Auto-expire in 5 minutes
      setTimeout(() => {
        supabase.rpc('remove_secure_session_data', { p_key: `_sms_code_${phoneNumber}` });
      }, 300000);
      
      return code; // In production, don't return the actual code
    } catch (error) {
      logger.error('SMS verification failed');
      throw error;
    }
  }

  // Verify SMS code
  static async verifySMSCode(phoneNumber: string, code: string): Promise<boolean> {
    // Retrieve encrypted code from server-side session storage
    const { data: storedEncrypted, error } = await supabase.rpc('get_secure_session_data', {
      p_key: `_sms_code_${phoneNumber}`,
    });
    if (error || !storedEncrypted) return false;
    
    try {
      const decryptResult = await decryptData(storedEncrypted as string, 'sms_code');
      if (!decryptResult.success || !decryptResult.decrypted) return false;
      
      const isValid = SecurityManager.secureCompare(code, decryptResult.decrypted);
      
      if (isValid) {
        await supabase.rpc('remove_secure_session_data', { p_key: `_sms_code_${phoneNumber}` });
      }
      
      return isValid;
    } catch (error) {
      logger.error('SMS code verification failed');
      return false;
    }
  }

  // Email verification with enhanced security
  static async sendEmailVerification(email: string): Promise<void> {
    const token = SecurityManager.generateSecureToken(32);
    const timestamp = Date.now();
    
    // Create secure verification package
    const verificationData = {
      email,
      token,
      timestamp,
      expiresAt: timestamp + (15 * 60 * 1000) // 15 minutes
    };
    
    const encryptResult = await encryptData(verificationData, 'email_verification');
    if (encryptResult.success && encryptResult.encrypted) {
      await supabase.rpc('store_secure_session_data', {
        p_key: `_email_verification_${email}`,
        p_value: encryptResult.encrypted,
      });
    }
    
    // Auto-expire in 15 minutes (client-side cleanup; server TTL is handled separately)
    setTimeout(() => {
      supabase.rpc('remove_secure_session_data', { p_key: `_email_verification_${email}` });
    }, 15 * 60 * 1000);
    
    try {
      await supabase.functions.invoke('secure-external-api', {
        body: {
          service: 'email',
          action: 'send_verification',
          email,
          token
        }
      });
    } catch (error) {
      logger.error('Email verification failed');
      throw error;
    }
  }

  // Verify email token
  static async verifyEmailToken(email: string, token: string): Promise<boolean> {
    // Retrieve verification package from server-side session storage
    const { data: storedEncrypted, error } = await supabase.rpc('get_secure_session_data', {
      p_key: `_email_verification_${email}`,
    });
    if (error || !storedEncrypted) return false;
    
    try {
      const decryptResult = await decryptData(storedEncrypted as string, 'email_verification');
      if (!decryptResult.success || !decryptResult.decrypted) return false;
      
      const verificationData = decryptResult.decrypted;
      
      const isValidToken = SecurityManager.secureCompare(token, verificationData.token);
      const isNotExpired = Date.now() < verificationData.expiresAt;
      
      if (isValidToken && isNotExpired) {
        await supabase.rpc('remove_secure_session_data', { p_key: `_email_verification_${email}` });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Email token verification failed');
      return false;
    }
  }

  // Hardware security key authentication
  static async registerSecurityKey(): Promise<boolean> {
    if (!('credentials' in navigator)) return false;
    
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'LoanFlow Security',
            id: window.location.hostname
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(64)),
            name: 'security-key-user',
            displayName: 'Security Key User'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'cross-platform',
            userVerification: 'discouraged',
            requireResidentKey: false
          },
          timeout: 60000,
          attestation: 'direct'
        }
      });
      
      if (credential) {
        const pkCredential = credential as PublicKeyCredential;
        const credentialData = {
          id: credential.id,
          rawId: Array.from(new Uint8Array(pkCredential.rawId)),
          type: credential.type
        };
        
        const encryptResult = await encryptData(credentialData, 'security_key');
        if (encryptResult.success && encryptResult.encrypted) {
          await supabase.rpc('store_secure_session_data', {
            p_key: 'security_key',
            p_value: encryptResult.encrypted
          });
          return true;
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Security key registration failed');
      return false;
    }
  }

  // Verify hardware security key
  static async verifySecurityKey(): Promise<boolean> {
    if (!('credentials' in navigator)) return false;
    
    try {
      const { data: encryptedData } = await supabase.rpc('get_secure_session_data', {
        p_key: 'security_key'
      });
      if (!encryptedData) return false;
      
      const decryptResult = await decryptData(encryptedData as string, 'security_key');
      if (!decryptResult.success || !decryptResult.decrypted) return false;
      
      const storedCredential = decryptResult.decrypted;
      if (!storedCredential) return false;
      
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{
            id: new Uint8Array(storedCredential.rawId),
            type: 'public-key'
          }],
          userVerification: 'discouraged',
          timeout: 60000
        }
      });
      
      return !!assertion;
    } catch (error) {
      logger.error('Security key verification failed');
      return false;
    }
  }

  // Adaptive authentication based on risk assessment
  static async getRequiredAuthMethods(riskLevel: number): Promise<string[]> {
    const methods = ['password'];
    
    if (riskLevel >= 30) methods.push('email');
    if (riskLevel >= 50) methods.push('sms');
    if (riskLevel >= 70) methods.push('totp');
    if (riskLevel >= 85) methods.push('biometric');
    if (riskLevel >= 95) methods.push('security_key');
    
    return methods;
  }

  // Private helper methods
  private static generateBase32Secret(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    let secret = '';
    
    for (let i = 0; i < bytes.length; i++) {
      secret += alphabet[bytes[i] % alphabet.length];
    }
    
    return secret;
  }

  private static async validateTOTPCode(secret: string, code: string): Promise<boolean> {
    const time = Math.floor(Date.now() / 30000);
    
    // Check current time window and adjacent windows for clock drift
    for (let window = -1; window <= 1; window++) {
      const timeCode = await this.generateTOTPCode(secret, time + window);
      if (SecurityManager.secureCompare(code, timeCode)) {
        return true;
      }
    }
    
    return false;
  }

  private static async generateTOTPCode(secret: string, time: number): Promise<string> {
    // RFC 6238 (TOTP): HMAC-SHA1 with 30s time step and 6 digits
    // 1) Base32-decode the shared secret
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = secret.replace(/\s+/g, '').toUpperCase();

    const bytes: number[] = [];
    let bits = 0;
    let value = 0;
    for (let i = 0; i < clean.length; i++) {
      const idx = alphabet.indexOf(clean[i]);
      if (idx === -1) continue; // skip padding or invalid chars
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    const keyBytes = new Uint8Array(bytes);

    // 2) Create 8-byte time counter (big-endian)
    const counter = new ArrayBuffer(8);
    const view = new DataView(counter);
    // high 4 bytes stay 0, set low 4 bytes
    view.setUint32(4, time, false);

    // 3) HMAC-SHA1(counter, key)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const hmac = await crypto.subtle.sign('HMAC', cryptoKey, counter);
    const h = new Uint8Array(hmac);

    // 4) Dynamic truncation
    const offset = h[h.length - 1] & 0x0f;
    const binary = ((h[offset] & 0x7f) << 24) |
                   ((h[offset + 1] & 0xff) << 16) |
                   ((h[offset + 2] & 0xff) << 8) |
                   (h[offset + 3] & 0xff);

    // 5) Modulo to get 6 digits
    const totpCode = (binary % 1_000_000).toString().padStart(6, '0');
    return totpCode;
  }
}
