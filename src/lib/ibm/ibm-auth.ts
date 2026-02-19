/**
 * IBM App ID Authentication Service
 * Replaces Supabase Auth for IBM Cloud deployment.
 */

import { IBM_CONFIG } from './ibm-config';

export interface IBMUser {
  id: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  roles?: string[];
  raw: Record<string, unknown>;
}

export interface IBMSession {
  accessToken: string;
  idToken: string;
  expiresAt: number;
  user: IBMUser;
}

const SESSION_KEY = 'ibm_crm_session';

// Type-only interface for IBM App ID SDK (loaded dynamically at runtime)
interface AppIDInstance {
  init: (config: { clientId: string; discoveryEndpoint: string }) => Promise<void>;
  signin: () => Promise<{ accessToken: string; idToken: string }>;
  signout: () => Promise<void>;
  silentSignin: () => Promise<{ accessToken: string; idToken: string }>;
  getUserInfo: (token: string) => Promise<Record<string, unknown>>;
}

class IBMAuthService {
  private appId: AppIDInstance | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import — ibmcloud-appid-js is loaded at runtime on IBM Cloud
      // Using fetch-based fallback to avoid bundler resolution errors in dev
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AppIDModule = await (Function('return import("ibmcloud-appid-js")')()) as any;
      const AppID = AppIDModule.default ?? AppIDModule;
      this.appId = new AppID() as AppIDInstance;

      await this.appId.init({
        clientId: IBM_CONFIG.appId.clientId,
        discoveryEndpoint: IBM_CONFIG.appId.discoveryEndpoint,
      });

      this.initialized = true;
    } catch (error) {
      console.error('[IBM Auth] Initialization failed:', error);
      throw error;
    }
  }

  async signIn(): Promise<IBMSession> {
    await this.initialize();
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
    return session;
  }

  async signOut(): Promise<void> {
    await this.initialize();
    try {
      await this.appId?.signout();
    } catch {
      // Best-effort
    }
    sessionStorage.removeItem(SESSION_KEY);
  }

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

  private async refreshSession(): Promise<IBMSession | null> {
    try {
      await this.initialize();
      if (!this.appId) return null;

      const tokens = await this.appId.silentSignin();
      const userInfo = await this.appId.getUserInfo(tokens.accessToken);

      const session: IBMSession = {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        expiresAt: Date.now() + 3600 * 1000,
        user: this.mapUser(userInfo),
      };
      this.storeSession(session);
      return session;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  private mapUser(userInfo: Record<string, unknown>): IBMUser {
    return {
      id: (userInfo.sub as string) || '',
      email: (userInfo.email as string) || '',
      name:
        (userInfo.name as string) ||
        `${userInfo.given_name ?? ''} ${userInfo.family_name ?? ''}`.trim(),
      given_name: userInfo.given_name as string | undefined,
      family_name: userInfo.family_name as string | undefined,
      roles: (userInfo['https://crm.hbf/roles'] as string[]) ?? [],
      raw: userInfo,
    };
  }

  private storeSession(session: IBMSession): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export const ibmAuth = new IBMAuthService();
