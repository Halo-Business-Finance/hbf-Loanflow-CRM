/**
 * IBM Cloud Authentication Service
 *
 * Supports two flows:
 *   1. Email/password via hbf-api /auth/login and /auth/register
 *   2. IBM App ID popup SSO (fallback / enterprise flow)
 *
 * The frontend never touches the database directly for auth —
 * hbf-api handles credential validation, token issuance, and session creation.
 */

import { IBM_CONFIG } from './ibm-config';

// ── Public types ───────────────────────────────────────────────────────────

export interface IBMUser {
  id: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  roles?: string[];
  raw: Record<string, unknown>;
  /** Compatibility shim — mirrors Supabase User.user_metadata */
  user_metadata: Record<string, any>;
  /** Email verification status */
  email_confirmed_at?: string | null;
}

export interface IBMSession {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
  user: IBMUser;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SESSION_KEY = 'ibm_crm_session';
const AUTH_EVENT_KEY = 'ibm_auth_event';

// ── Event system for auth state changes ────────────────────────────────────

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION';
type AuthListener = (event: AuthEvent, session: IBMSession | null) => void;

// ── App ID SDK types (loaded dynamically) ──────────────────────────────────

interface AppIDInstance {
  init: (config: { clientId: string; discoveryEndpoint: string }) => Promise<void>;
  signin: () => Promise<{ accessToken: string; idToken: string }>;
  signout: () => Promise<void>;
  silentSignin: () => Promise<{ accessToken: string; idToken: string }>;
  getUserInfo: (token: string) => Promise<Record<string, unknown>>;
}

// ── Helper: build API base URL ─────────────────────────────────────────────

function getApiBaseUrl(): string {
  const base = (IBM_CONFIG.database.functionsBaseUrl || '').replace(/\/$/, '');
  if (base) return base;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/**
 * Make an authenticated request to hbf-api directly.
 */
async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (IBM_CONFIG.database.apiKey) {
    headers['x-api-key'] = IBM_CONFIG.database.apiKey;
  }

  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('No API endpoint available for authentication');
  }

  // Auth routes are mounted under /api/v1 on hbf-api
  const prefix = path.startsWith('/api') ? '' : '/api/v1';
  return fetch(`${base}${prefix}${path}`, { ...options, headers });
}

// ── Auth Service ───────────────────────────────────────────────────────────

class IBMAuthService {
  private appId: AppIDInstance | null = null;
  private initialized = false;
  private listeners: Set<AuthListener> = new Set();

  // ── Event subscription (mirrors supabase.auth.onAuthStateChange) ──

  onAuthStateChange(listener: AuthListener): { unsubscribe: () => void } {
    this.listeners.add(listener);

    // Fire initial session check asynchronously
    setTimeout(async () => {
      const session = await this.getSession();
      listener('INITIAL_SESSION', session);
    }, 0);

    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private notifyListeners(event: AuthEvent, session: IBMSession | null) {
    for (const listener of this.listeners) {
      try {
        listener(event, session);
      } catch (e) {
        console.error('[IBM Auth] Listener error:', e);
      }
    }
  }

  // ── Email/Password authentication via hbf-api ──

  async signInWithPassword(email: string, password: string): Promise<IBMSession> {
    const resp = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || body.message || `Authentication failed (${resp.status})`);
    }

    const data = await resp.json();
    const session = this.buildSessionFromApiResponse(data);
    this.storeSession(session);
    this.notifyListeners('SIGNED_IN', session);
    return session;
  }

  async signUpWithPassword(
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string },
  ): Promise<IBMSession> {
    const resp = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        first_name: metadata?.firstName || '',
        last_name: metadata?.lastName || '',
      }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || body.message || `Registration failed (${resp.status})`);
    }

    const data = await resp.json();
    const session = this.buildSessionFromApiResponse(data);
    this.storeSession(session);
    this.notifyListeners('SIGNED_IN', session);
    return session;
  }

  async resetPasswordForEmail(email: string): Promise<void> {
    const resp = await apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || body.message || 'Password reset failed');
    }
  }

  // ── IBM App ID popup flow (enterprise SSO) ──

  async initializeAppId(): Promise<void> {
    if (this.initialized) return;

    try {
      const AppIDModule = await (Function('return import("ibmcloud-appid-js")')()) as any;
      const AppID = AppIDModule.default ?? AppIDModule;
      this.appId = new AppID() as AppIDInstance;

      await this.appId.init({
        clientId: IBM_CONFIG.appId.clientId,
        discoveryEndpoint: IBM_CONFIG.appId.discoveryEndpoint,
      });

      this.initialized = true;
    } catch (error) {
      console.error('[IBM Auth] App ID initialization failed:', error);
      throw error;
    }
  }

  /** IBM App ID popup-based sign in (SSO) */
  async signIn(): Promise<IBMSession> {
    await this.initializeAppId();
    if (!this.appId) throw new Error('IBM App ID not initialized');

    const tokens = await this.appId.signin();
    const userInfo = await this.appId.getUserInfo(tokens.accessToken);

    const session: IBMSession = {
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      expiresAt: Date.now() + 3600 * 1000,
      user: this.mapUser(userInfo),
    };

    this.storeSession(session);
    this.notifyListeners('SIGNED_IN', session);
    return session;
  }

  // ── Sign out ──

  async signOut(): Promise<void> {
    // Try App ID signout if initialized
    if (this.initialized && this.appId) {
      try { await this.appId.signout(); } catch { /* best-effort */ }
    }

    sessionStorage.removeItem(SESSION_KEY);
    this.notifyListeners('SIGNED_OUT', null);
  }

  // ── Session management ──

  async getSession(): Promise<IBMSession | null> {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    try {
      const session: IBMSession = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        return await this.refreshSession();
      }
      return session;
    } catch {
      return null;
    }
  }

  async getUser(): Promise<IBMUser | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  }

  // ── Token refresh ──

  private async refreshSession(): Promise<IBMSession | null> {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    try {
      const oldSession: IBMSession = JSON.parse(raw);

      // Try refreshing via hbf-api
      if (oldSession.refreshToken) {
        const resp = await apiRequest('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: oldSession.refreshToken }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const session = this.buildSessionFromApiResponse(data);
          this.storeSession(session);
          this.notifyListeners('TOKEN_REFRESHED', session);
          return session;
        }
      }

      // Try App ID silent sign-in
      if (this.initialized && this.appId) {
        const tokens = await this.appId.silentSignin();
        const userInfo = await this.appId.getUserInfo(tokens.accessToken);
        const session: IBMSession = {
          accessToken: tokens.accessToken,
          idToken: tokens.idToken,
          expiresAt: Date.now() + 3600 * 1000,
          user: this.mapUser(userInfo),
        };
        this.storeSession(session);
        this.notifyListeners('TOKEN_REFRESHED', session);
        return session;
      }
    } catch {
      // Refresh failed — clear session
    }

    sessionStorage.removeItem(SESSION_KEY);
    this.notifyListeners('SIGNED_OUT', null);
    return null;
  }

  // ── Helpers ──

  private buildSessionFromApiResponse(data: any): IBMSession {
    const user: IBMUser = {
      id: data.user?.id || data.userId || data.sub || '',
      email: data.user?.email || data.email || '',
      name: data.user?.name || data.user?.display_name ||
            `${data.user?.first_name || ''} ${data.user?.last_name || ''}`.trim() || '',
      given_name: data.user?.first_name || data.user?.given_name,
      family_name: data.user?.last_name || data.user?.family_name,
      roles: data.user?.roles || [],
      raw: data.user || {},
      user_metadata: {
        first_name: data.user?.first_name || '',
        last_name: data.user?.last_name || '',
        display_name: data.user?.display_name || data.user?.name || '',
      },
      email_confirmed_at: data.user?.email_confirmed_at || data.user?.emailVerified ? new Date().toISOString() : null,
    };

    return {
      accessToken: data.accessToken || data.access_token || data.token || '',
      idToken: data.idToken || data.id_token || '',
      refreshToken: data.refreshToken || data.refresh_token,
      expiresAt: data.expiresAt || (Date.now() + (data.expires_in || 3600) * 1000),
      user,
    };
  }

  private mapUser(userInfo: Record<string, unknown>): IBMUser {
    const given_name = userInfo.given_name as string | undefined;
    const family_name = userInfo.family_name as string | undefined;
    return {
      id: (userInfo.sub as string) || '',
      email: (userInfo.email as string) || '',
      name:
        (userInfo.name as string) ||
        `${given_name ?? ''} ${family_name ?? ''}`.trim(),
      given_name,
      family_name,
      roles: (userInfo['https://crm.hbf/roles'] as string[]) ?? [],
      raw: userInfo,
      user_metadata: {
        first_name: given_name || '',
        last_name: family_name || '',
        display_name: (userInfo.name as string) || '',
        phone_number: (userInfo.phone_number as string) || '',
        time_zone: (userInfo.zoneinfo as string) || '',
      },
      email_confirmed_at: userInfo.email_verified ? new Date().toISOString() : null,
    };
  }

  private storeSession(session: IBMSession): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export const ibmAuth = new IBMAuthService();
