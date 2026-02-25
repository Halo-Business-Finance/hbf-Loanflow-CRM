/**
 * AuthProvider — Supabase email/password authentication
 */

import * as React from 'react'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import { useToast } from '@/hooks/use-toast'
import { sanitizeError } from '@/lib/error-sanitizer'

/* ------------------------------------------------------------------ */
/*  Public interface                                                   */
/* ------------------------------------------------------------------ */

interface AuthContextType {
  user: User | null
  session: Session | null
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
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const { toast } = useToast()

  /* ---- role fetch ---- */

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      const [rolesRes, primaryRes] = await Promise.all([
        supabase.from('user_roles').select('*').eq('user_id', userId).eq('is_active', true),
        supabase.rpc('get_user_role', { p_user_id: userId }),
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (currentSession?.user) {
          setIsEmailVerified(!!currentSession.user.email_confirmed_at)
          // Defer role fetch to avoid deadlock
          setTimeout(() => fetchUserRole(currentSession.user.id), 0)
        } else {
          setUserRole(null)
          setUserRoles([])
          setIsEmailVerified(false)
        }
        setLoading(false)
      }
    )

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (currentSession?.user) {
        setIsEmailVerified(!!currentSession.user.email_confirmed_at)
        fetchUserRole(currentSession.user.id)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [fetchUserRole])

  /* ---- sign-in ---- */

  const signIn = useCallback(async (email?: string, password?: string) => {
    if (!email || !password) throw new Error('Email and password are required')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      toast({ title: 'Welcome back!', description: 'You have been signed in successfully.' })
    } catch (error: any) {
      toast({ title: 'Sign in failed', description: sanitizeError(error), variant: 'destructive' })
      throw error
    } finally {
      setLoading(false)
    }
  }, [toast])

  /* ---- sign-up ---- */

  const signUp = useCallback(async (email?: string, password?: string, firstName?: string, lastName?: string) => {
    if (!email || !password) throw new Error('Email and password are required')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: firstName || '',
            last_name: lastName || '',
            display_name: `${firstName || ''} ${lastName || ''}`.trim(),
          },
        },
      })
      if (error) throw error
      toast({ title: 'Account created!', description: 'Please check your email to verify your account.' })
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
      await supabase.auth.signOut()
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      toast({ title: 'Password reset sent', description: 'Check your email for reset instructions.' })
    } catch (error: any) {
      toast({ title: 'Password reset failed', description: sanitizeError(error), variant: 'destructive' })
      throw error
    }
  }, [toast])

  /* ---- resend verification email ---- */

  const resendVerificationEmail = useCallback(async () => {
    if (!user?.email) throw new Error('No user email found')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
      if (error) throw error
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
