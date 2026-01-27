import * as React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { SecurityManager } from '@/lib/security'
import { sanitizeError, logSecureError } from '@/lib/error-sanitizer'

interface AuthContextType {
  user: User | null
  session: Session | null
  userRole: string | null
  userRoles: string[]
  loading: boolean
  isEmailVerified: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (role: string) => boolean
  resetPassword: (email: string) => Promise<void>
  resendVerificationEmail: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let mounted = true
    
    // Set up auth state listener FIRST to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        console.log('[AuthProvider] Auth state changed:', event, !!session?.user)
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          // Ensure default viewer role then fetch details (non-blocking)
          const setupUserRole = async () => {
            try {
              console.log('[AuthProvider] Setting up user role for:', session.user.id)
              await fetchUserRole(session.user.id)
              await checkEmailVerification(session.user.id)
              console.log('[AuthProvider] Role setup complete')
            } catch (e) {
              console.error('[AuthProvider] Role setup failed:', e)
              logSecureError(e, 'Auth state change role setup', supabase)
              // Set fallback role to prevent infinite loading
              setUserRole('viewer')
              setUserRoles(['viewer'])
            } finally {
              setLoading(false)
            }
          }
          setupUserRole()
        } else {
          setUserRole(null)
          setUserRoles([])
          setIsEmailVerified(false)
          setLoading(false)
        }
      }
    })

    // THEN check for existing session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[AuthProvider] getSession error:', error.message)
          logSecureError(error, 'Session check error', supabase)
        }
        
        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          if (session?.user) {
            try {
              await fetchUserRole(session.user.id)
              await checkEmailVerification(session.user.id)
            } catch (roleError) {
              console.error('[AuthProvider] Role fetch failed during checkSession:', roleError)
              // Set fallback role so app doesn't hang
              setUserRole('viewer')
              setUserRoles(['viewer'])
            }
          } else {
            setUserRole(null)
            setUserRoles([])
            setIsEmailVerified(false)
          }
          setLoading(false)
        }
      } catch (error) {
        logSecureError(error, 'Session check', supabase)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])


  const checkEmailVerification = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('is_email_verified', {
        p_user_id: userId
      })

      if (error) {
        logSecureError(error, 'Email verification check', supabase)
        setIsEmailVerified(false)
        return
      }

      setIsEmailVerified(data === true)
    } catch (error) {
      logSecureError(error, 'Email verification check exception', supabase)
      setIsEmailVerified(false)
    }
  }

  const fetchUserRole = async (userId: string) => {
    try {
      console.log('[AuthProvider] Fetching roles for user:', userId)
      // Fetch all active roles AND the server-determined primary role in parallel
      const [rolesRes, primaryRes] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase.rpc('get_user_role', { p_user_id: userId })
      ])

      console.log('[AuthProvider] Roles response:', rolesRes.data, 'Primary response:', primaryRes.data)

      // If both calls failed, fall back
      if (rolesRes.error && (!primaryRes || primaryRes.error)) {
        console.warn('[AuthProvider] Both role queries failed, using fallback')
        logSecureError(rolesRes.error, 'Role fetch failed', supabase)
        setUserRole('viewer')
        setUserRoles(['viewer'])
        return
      }

      // Extract all roles (may be empty)
      const roles: string[] = rolesRes.data?.map((r: { role: any }) => String(r.role)) || []
      const serverPrimary: string | null = (primaryRes && !primaryRes.error && primaryRes.data) ? String(primaryRes.data) : null

      console.log('[AuthProvider] Extracted roles:', roles, 'Server primary:', serverPrimary)

      // Determine primary role (prefer secure server value)
      const roleHierarchy = ['tech', 'closer', 'underwriter', 'funder', 'loan_processor', 'loan_originator', 'manager', 'admin', 'super_admin']
      const derivedPrimary = roles.length > 0 
        ? roles.reduce((highest, current) => {
            const highestIndex = roleHierarchy.indexOf(highest)
            const currentIndex = roleHierarchy.indexOf(current)
            return currentIndex > highestIndex ? current : highest
          }, roles[0])
        : 'viewer'

      const primaryRole = serverPrimary || derivedPrimary

      // Ensure roles includes the primary role and is de-duplicated
      const normalizedRoles = Array.from(new Set([...(roles || []), primaryRole].filter(Boolean))) as string[]

      console.log('[AuthProvider] Final roles:', normalizedRoles, 'Primary role:', primaryRole)

      setUserRole(primaryRole)
      setUserRoles(normalizedRoles.length > 0 ? normalizedRoles : ['viewer'])
    } catch (error) {
      console.error('[AuthProvider] Role fetch exception:', error)
      logSecureError(error, 'Role fetch exception', supabase)
      setUserRole('viewer')
      setUserRoles(['viewer'])
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      // Ensure default role then fetch user role before proceeding
      if (data?.user?.id) {
        try {
          await fetchUserRole(data.user.id)
          await supabase.rpc('check_mfa_requirement', {
            p_user_id: data.user.id
          })
        } catch (e) {
          logSecureError(e, 'Sign in role setup', supabase)
        }
      }

      // Log successful login
      try {
        await supabase.functions.invoke('audit-log', {
          body: {
            action: 'user_login',
            table_name: 'auth.users',
          }
        })
      } catch (auditError) {
        logSecureError(auditError, 'Audit logging', supabase)
      }

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      })
    } catch (error: any) {
      logSecureError(error, 'Sign in', supabase)
      toast({
        title: "Sign in failed",
        description: sanitizeError(error),
        variant: "destructive",
      })
      throw error
    }
  }

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      })

      if (error) {
        throw error;
      }

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      })
    } catch (error: any) {
      logSecureError(error, 'Sign up', supabase)
      toast({
        title: "Sign up failed",
        description: sanitizeError(error),
        variant: "destructive",
      })
      throw error
    }
  }

  const signOut = async () => {
    try {
      // Log logout
      await supabase.functions.invoke('audit-log', {
        body: {
          action: 'user_logout',
          table_name: 'auth.users',
        }
      })

      const { error } = await supabase.auth.signOut()
      if (error) {
        throw error
      }

      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      })
    } catch (error: any) {
      logSecureError(error, 'Sign out', supabase)
      toast({
        title: "Sign out failed",
        description: sanitizeError(error),
        variant: "destructive",
      })
    }
  }

  /**
   * Client-side role check for UI visibility ONLY.
   * SECURITY NOTE: This is for UI convenience only and MUST NOT be trusted for authorization.
   * All sensitive operations are protected by:
   * 1. Row Level Security (RLS) policies in Supabase
   * 2. Server-side role verification via get_user_role() RPC
   * 3. Edge function authorization checks
   * 
   * Attackers can manipulate client-side JavaScript, so never rely on this for security.
   */
  const hasRole = (role: string) => {
    if (!userRoles || userRoles.length === 0) return false
    
    // Check if user has this specific role
    if (userRoles.includes(role)) return true
    
    // Check if user has super_admin (has access to everything)
    if (userRoles.includes('super_admin')) return true
    
    // If checking for super_admin specifically, only super_admin can have it
    if (role === 'super_admin') return userRoles.includes('super_admin')
    
    // Role hierarchy for UI display purposes only
    // Actual authorization is enforced by RLS and server-side checks
    const roleHierarchy = ['tech', 'closer', 'underwriter', 'funder', 'loan_processor', 'loan_originator', 'manager', 'admin', 'super_admin']
    
    // Find highest role user has
    const highestUserRole = userRoles.reduce((highest, current) => {
      const highestIndex = roleHierarchy.indexOf(highest)
      const currentIndex = roleHierarchy.indexOf(current)
      return currentIndex > highestIndex ? current : highest
    }, userRoles[0])
    
    const userRoleIndex = roleHierarchy.indexOf(highestUserRole)
    const requiredRoleIndex = roleHierarchy.indexOf(role)
    
    // If role not found in hierarchy, deny access
    if (requiredRoleIndex === -1) return false
    
    return userRoleIndex >= requiredRoleIndex
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`
      })
      
      if (error) throw error
      
      toast({
        title: "Password reset sent",
        description: "Check your email for password reset instructions.",
      })
    } catch (error: any) {
      logSecureError(error, 'Password reset', supabase)
      toast({
        title: "Password reset failed",
        description: sanitizeError(error),
        variant: "destructive",
      })
      throw error
    }
  }

  const resendVerificationEmail = async () => {
    if (!user?.email) {
      throw new Error('No user email found')
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      })

      if (error) throw error

      toast({
        title: "Verification email sent",
        description: "Please check your inbox for the verification link.",
      })
    } catch (error: any) {
      logSecureError(error, 'Resend verification', supabase)
      toast({
        title: "Failed to resend email",
        description: sanitizeError(error),
        variant: "destructive",
      })
      throw error
    }
  }

  const value = {
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

  // Only render children when context value is fully available
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}