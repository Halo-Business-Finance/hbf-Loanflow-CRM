/**
 * Auth Utilities — IBM App ID
 *
 * Drop-in replacements for direct `supabase.auth.*` calls.
 * Import these instead of reaching for the Supabase client.
 */

import { ibmAuth } from '@/lib/ibm/ibm-auth';
import type { IBMUser, IBMSession } from '@/lib/ibm/ibm-auth';

/** Get the current authenticated user (or null). */
export async function getAuthUser(): Promise<IBMUser | null> {
  return ibmAuth.getUser();
}

/** Get the current session (or null). */
export async function getAuthSession(): Promise<IBMSession | null> {
  return ibmAuth.getSession();
}

/**
 * Synchronous access to the current access token.
 * Returns null if no session is stored.
 */
export function getAccessToken(): string | null {
  const raw = sessionStorage.getItem('ibm_crm_session');
  if (!raw) return null;
  try {
    const session: IBMSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) return null;
    return session.accessToken;
  } catch {
    return null;
  }
}

/**
 * Get the current user id synchronously (from sessionStorage).
 * Returns null if not authenticated.
 */
export function getAuthUserId(): string | null {
  const raw = sessionStorage.getItem('ibm_crm_session');
  if (!raw) return null;
  try {
    const session: IBMSession = JSON.parse(raw);
    return session.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Sign out the current user. */
export async function authSignOut(): Promise<void> {
  return ibmAuth.signOut();
}
