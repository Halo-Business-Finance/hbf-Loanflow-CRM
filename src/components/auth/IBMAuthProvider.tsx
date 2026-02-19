/**
 * IBM App ID Auth Provider
 * Drop-in replacement for src/components/auth/AuthProvider.tsx
 * on IBM Cloud deployments.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ibmAuth } from '@/lib/ibm/ibm-auth';
import type { IBMUser, IBMSession } from '@/lib/ibm/ibm-auth';
import { isIBMConfigured } from '@/lib/ibm/ibm-config';

interface IBMAuthContextType {
  user: IBMUser | null;
  session: IBMSession | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const IBMAuthContext = createContext<IBMAuthContextType | undefined>(undefined);

export function IBMAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IBMUser | null>(null);
  const [session, setSession] = useState<IBMSession | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isIBMConfigured();

  const refreshSession = useCallback(async () => {
    const s = await ibmAuth.getSession();
    setSession(s);
    setUser(s?.user ?? null);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        if (!configured) {
          console.warn('[IBM Auth] Not configured — missing VITE_IBM_APPID_CLIENT_ID or VITE_IBM_APPID_DISCOVERY_ENDPOINT');
          return;
        }
        await refreshSession();
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [configured, refreshSession]);

  const signIn = useCallback(async () => {
    setLoading(true);
    try {
      const s = await ibmAuth.signIn();
      setSession(s);
      setUser(s.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await ibmAuth.signOut();
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <IBMAuthContext.Provider
      value={{ user, session, loading, isConfigured: configured, signIn, signOut, refreshSession }}
    >
      {children}
    </IBMAuthContext.Provider>
  );
}

export function useIBMAuth(): IBMAuthContextType {
  const ctx = useContext(IBMAuthContext);
  if (!ctx) throw new Error('useIBMAuth must be used inside <IBMAuthProvider>');
  return ctx;
}
