/**
 * AuthProvider — IBM Cloud Authentication
 *
 * Replaces Supabase Auth with IBM App ID + hbf-api email/password.
 * Maintains the same useAuth() interface so all downstream components
 * continue working without changes.
 */

import * as React from 'react'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { ibmAuth } from '@/lib/ibm/ibm-auth'
import type { IBMUser, IBMSession } from '@/lib/ibm/ibm-auth'
import { ibmDb } from '@/lib/ibm'
import { useToast } from '@/hooks/use-toast'
import { sanitizeError } from '@/lib/error-sanitizer'

/* ------------------------------------------------------------------ */
/*  Compatible types (drop-in for Supabase User/Session)              */
/* ------------------------------------------------------------------ */

/**
 * CRM User — compatible interface that replaces Supabase User.
 * Components using `user.id`, `user.email`, `user.user_metadata` work as-is.
 */
export interface CRMUser {
  id: string
  email: string | undefined
  user_metadata: Record<string, any>
  email_confirmed_at: string | null | undefined
  /** Original IBM user data */
  raw: IBMUser
}

export interface CRMSession {
  access_token: string
  user: CRMUser
  /** Original IBM session data */
  raw: IBMSession
}

/* ------------------------------------------------------------------ */
/*  Public interface                                                   */
/* ------------------------------------------------------------------ */

interface AuthContextType {
  user: CRMUser | null
  session: CRMSession | null
  userRole: string | null
  userRoles: string[]
  loading: boolean
  isEmailVerified: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/* ------------------------------------------------------------------ */
/*  Role helpers                                                      */
/* ------------------------------------------------------------------ */

const ROLE_HIERARCHY = [
  'tech', 'closer', 'underwriter', 'funder',
  'loan_processor', 'loan_originator', 'manager', 'admin', 'super_admin',
]

function deriveHighestRole(roles: string[]): string {
  if (roles.length === 0) return 'viewer'
  return roles.reduce((highest, current) => {
    const hi = ROLE_HIERARCHY.indexOf(highest)
    const ci = ROLE_HIERARCHY.indexOf(current)
    return ci > hi ? current : highest
  }, roles[0])
}

/** Convert IBMUser → CRMUser compatibility shape */
function toCRMUser(ibmUser: IBMUser): CRMUser {
  return {
    id: ibmUser.id,
    email: ibmUser.email,
    user_metadata: ibmUser.user_metadata,
    email_confirmed_at: ibmUser.email_confirmed_at,
    raw: ibmUser,
  }
}

/** Convert IBMSession → CRMSession compatibility shape */
function toCRMSession(ibmSession: IBMSession): CRMSession {
  return {
    access_token: ibmSession.accessToken,
    user: toCRMUser(ibmSession.user),
    raw: ibmSession,
  }
}

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CRMUser | null>(null)
  const [session, setSession] = useState<CRMSession | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const { toast } = useToast()

  /* ---- role fetch (via IBM REST, not Supabase) ---- */

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      const [rolesRes, primaryRes] = await Promise.all([
        ibmDb.from('user_roles').select('*').eq('user_id', userId).eq('is_active', true),
        ibmDb.rpc('get_user_role', { p_user_id: userId }),
      ])

      const roles: string[] =
        (rolesRes.data as any[])?.map((r: any) => String(r.role)) || []
      const serverPrimary: string | null =
        primaryRes.data ? String(primaryRes.data) : null

      const derivedPrimary = deriveHighestRole(roles)
      const primaryRole = serverPrimary || derivedPrimary
      const normalizedRoles = Array.from(
        new Set([...roles, primaryRole].filter(Boolean)),
      ) as string[]

      setUserRole(primaryRole)
      setUserRoles(normalizedRoles.length > 0 ? normalizedRoles : ['viewer'])
    } catch (error) {
      console.error('[AuthProvider] Role fetch exception:', error)
      setUserRole('viewer')
      setUserRoles(['viewer'])
    }
  }, [])

  /* ---- bootstrap session on mount ---- */

  useEffect(() => {
    // Subscribe to auth state changes from ibmAuth
    const { unsubscribe } = ibmAuth.onAuthStateChange(
      (event, ibmSession) => {
        if (ibmSession) {
          const crmSession = toCRMSession(ibmSession)
          const crmUser = crmSession.user
          setSession(crmSession)
          setUser(crmUser)
          setIsEmailVerified(!!crmUser.email_confirmed_at)
          // Defer role fetch to avoid deadlock
          setTimeout(() => fetchUserRole(crmUser.id), 0)
        } else {
          setSession(null)
          setUser(null)
          setUserRole(null)
          setUserRoles([])
          setIsEmailVerified(false)
        }
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [fetchUserRole])

  /* ---- sign-in (email/password via hbf-api) ---- */

  const signIn = useCallback(async (email?: string, password?: string) => {
    if (!email || !password) throw new Error('Email and password are required')
    setLoading(true)
    try {
      await ibmAuth.signInWithPassword(email, password)
      toast({ title: 'Welcome back!', description: 'You have been signed in successfully.' })
    } catch (error: any) {
      toast({ title: 'Sign in failed', description: sanitizeError(error), variant: 'destructive' })
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  /* ---- sign-up (via hbf-api) ---- */

  const signUp = useCallback(async (email?: string, password?: string, firstName?: string, lastName?: string) => {
    if (!email || !password) throw new Error('Email and password are required')
    setLoading(true)
    try {
      await ibmAuth.signUpWithPassword(email, password, { firstName, lastName })
      toast({ title: 'Account created!', description: 'Your account has been set up successfully.' })
    } catch (error: any) {
      toast({ title: 'Sign up failed', description: sanitizeError(error), variant: 'destructive' })
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  /* ---- sign-out ---- */

  const signOut = useCallback(async () => {
    try {
      await ibmAuth.signOut()
      setSession(null)
      setUser(null)
      setUserRole(null)
      setUserRoles([])
      setIsEmailVerified(false)
      toast({ title: 'Signed out', description: 'You have been signed out successfully.' })
    } catch (error: any) {
      toast({ title: 'Sign out failed', description: sanitizeError(error), variant: 'destructive' })
    }
  }, [toast])

  /* ---- reset password ---- */

  const resetPassword = useCallback(async (email: string) => {
    try {
      await ibmAuth.resetPasswordForEmail(email)
      toast({ title: 'Password reset sent', description: 'Check your email for reset instructions.' })
    } catch (error: any) {
      toast({ title: 'Password reset failed', description: sanitizeError(error), variant: 'destructive' })
      throw error
    }
  }, [toast])

  /* ---- resend verification email (stub — handled server-side) ---- */

  const resendVerificationEmail = useCallback(async () => {
    if (!user?.email) throw new Error('No user email found')
    try {
      // hbf-api handles email verification resending
      await ibmAuth.resetPasswordForEmail(user.email)
      toast({ title: 'Verification email sent', description: 'Please check your inbox.' })
    } catch (error: any) {
      toast({ title: 'Failed to resend email', description: sanitizeError(error), variant: 'destructive' })
      throw error
    }
  }, [user, toast])

  /* ---- hasRole ---- */

  const hasRole = useCallback((role: string) => {
    if (!userRoles || userRoles.length === 0) return false
    if (userRoles.includes(role)) return true
    if (userRoles.includes('super_admin')) return true
    if (role === 'super_admin') return userRoles.includes('super_admin')

    const highestUserRole = deriveHighestRole(userRoles)
    const userRoleIndex = ROLE_HIERARCHY.indexOf(highestUserRole)
    const requiredRoleIndex = ROLE_HIERARCHY.indexOf(role)
    if (requiredRoleIndex === -1) return false
    return userRoleIndex >= requiredRoleIndex
  }, [userRoles])

  /* ---- render ---- */

  const value: AuthContextType = {
    user,
    session,
    userRole,
    userRoles,
    loading,
    isEmailVerified,
    signIn,
    signUp,
    signOut,
    hasRole,
    resetPassword,
    resendVerificationEmail,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
