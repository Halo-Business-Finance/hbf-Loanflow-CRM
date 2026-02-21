/**
 * AuthProvider — IBM App ID implementation
 *
 * Full swap from Supabase Auth to IBM App ID.
 * Exposes the same useAuth() hook & AuthContextType interface so
 * consuming components require zero changes.
 */

import * as React from 'react'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { ibmAuth } from '@/lib/ibm/ibm-auth'
import type { IBMUser, IBMSession } from '@/lib/ibm/ibm-auth'
import { ibmDb } from '@/lib/ibm'
import { useToast } from '@/hooks/use-toast'
import { sanitizeError, logSecureError } from '@/lib/error-sanitizer'

/* ------------------------------------------------------------------ */
/*  Public interface (unchanged from Supabase version)                */
/* ------------------------------------------------------------------ */

interface AuthContextType {
  user: IBMUser | null
  session: IBMSession | null
  userRole: string | null
  userRoles: string[]
  loading: boolean
  isEmailVerified: boolean
  signIn: (email?: string, password?: string) => Promise<void>
  signUp: (email?: string, password?: string, firstName?: string, lastName?: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (role: string) => boolean
  resetPassword: (email: string) => Promise<void>
  resendVerificationEmail: () => Promise<void>
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

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IBMUser | null>(null)
  const [session, setSession] = useState<IBMSession | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const { toast } = useToast()

  /* ---- role + email-verification fetch ---- */

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      console.log('[AuthProvider] Fetching roles for user:', userId)

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

      console.log('[AuthProvider] Final roles:', normalizedRoles, 'Primary:', primaryRole)
      setUserRole(primaryRole)
      setUserRoles(normalizedRoles.length > 0 ? normalizedRoles : ['viewer'])
    } catch (error) {
      console.error('[AuthProvider] Role fetch exception:', error)
      setUserRole('viewer')
      setUserRoles(['viewer'])
    }
  }, [])

  const checkEmailVerification = useCallback(async (userId: string) => {
    try {
      const { data } = await ibmDb.rpc('is_email_verified', { p_user_id: userId })
      setIsEmailVerified(data === true)
    } catch {
      setIsEmailVerified(false)
    }
  }, [])

  /* ---- bootstrap session on mount ---- */

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const s = await ibmAuth.getSession()
        if (!mounted) return

        setSession(s)
        setUser(s?.user ?? null)

        if (s?.user) {
          try {
            await fetchUserRole(s.user.id)
            await checkEmailVerification(s.user.id)
          } catch {
            setUserRole('viewer')
            setUserRoles(['viewer'])
          }
        } else {
          setUserRole(null)
          setUserRoles([])
          setIsEmailVerified(false)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()
    return () => { mounted = false }
  }, [fetchUserRole, checkEmailVerification])

  /* ---- sign-in (IBM App ID popup) ---- */

  const signIn = useCallback(async (_email?: string, _password?: string) => {
    setLoading(true)
    try {
      const s = await ibmAuth.signIn()
      setSession(s)
      setUser(s.user)

      await fetchUserRole(s.user.id)
      await checkEmailVerification(s.user.id)

      // audit log
      try {
        await ibmDb.rpc('create_audit_log', {
          p_action: 'user_login',
          p_table_name: 'auth.users',
        })
      } catch { /* best-effort */ }

      toast({ title: 'Welcome back!', description: 'You have been signed in successfully.' })
    } catch (error: any) {
      console.error('[AuthProvider] Sign-in error:', error)
      toast({ title: 'Sign in failed', description: sanitizeError(error), variant: 'destructive' })
      throw error
    } finally {
      setLoading(false)
    }
  }, [fetchUserRole, checkEmailVerification, toast])

  /* ---- sign-up (IBM App ID popup / Cloud Directory) ---- */

  const signUp = useCallback(async (_email?: string, _password?: string, _firstName?: string, _lastName?: string) => {
    // IBM App ID handles registration through its popup flow (Cloud Directory).
    // Calling signIn which opens the login widget where users can also register.
    setLoading(true)
    try {
      const s = await ibmAuth.signIn()
      setSession(s)
      setUser(s.user)

      await fetchUserRole(s.user.id)

      toast({ title: 'Account created!', description: 'Welcome to Halo Business Finance.' })
    } catch (error: any) {
      console.error('[AuthProvider] Sign-up error:', error)
      toast({ title: 'Sign up failed', description: sanitizeError(error), variant: 'destructive' })
      throw error
    } finally {
      setLoading(false)
    }
  }, [fetchUserRole, toast])

  /* ---- sign-out ---- */

  const signOut = useCallback(async () => {
    try {
      // audit log
      try {
        await ibmDb.rpc('create_audit_log', {
          p_action: 'user_logout',
          p_table_name: 'auth.users',
        })
      } catch { /* best-effort */ }

      await ibmAuth.signOut()
      setSession(null)
      setUser(null)
      setUserRole(null)
      setUserRoles([])
      setIsEmailVerified(false)

      toast({ title: 'Signed out', description: 'You have been signed out successfully.' })
    } catch (error: any) {
      console.error('[AuthProvider] Sign-out error:', error)
      toast({ title: 'Sign out failed', description: sanitizeError(error), variant: 'destructive' })
    }
  }, [toast])

  /* ---- reset password (via hbf-api proxy) ---- */

  const resetPassword = useCallback(async (email: string) => {
    try {
      // Cloud Directory password reset is handled by the IBM App ID login widget.
      // For programmatic reset, route through hbf-api.
      await ibmDb.rpc('request_password_reset', { p_email: email })
      toast({ title: 'Password reset sent', description: 'Check your email for reset instructions.' })
    } catch (error: any) {
      console.error('[AuthProvider] Password reset error:', error)
      toast({ title: 'Password reset failed', description: sanitizeError(error), variant: 'destructive' })
      throw error
    }
  }, [toast])

  /* ---- resend verification email ---- */

  const resendVerificationEmail = useCallback(async () => {
    if (!user?.email) throw new Error('No user email found')
    try {
      await ibmDb.rpc('resend_verification_email', { p_email: user.email })
      toast({ title: 'Verification email sent', description: 'Please check your inbox.' })
    } catch (error: any) {
      console.error('[AuthProvider] Resend verification error:', error)
      toast({ title: 'Failed to resend email', description: sanitizeError(error), variant: 'destructive' })
      throw error
    }
  }, [user, toast])

  /* ---- hasRole (UI-only, same hierarchy logic) ---- */

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
