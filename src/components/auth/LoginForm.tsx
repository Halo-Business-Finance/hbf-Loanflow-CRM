import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { sanitizeError, logSecureError } from '@/lib/error-sanitizer'

interface LoginFormProps {
  onToggleMode: () => void
}

export function LoginForm({ onToggleMode }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const { signIn, resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter both email and password')
      return
    }

    setIsLoading(true)
    try {
      await signIn(email, password)
    } catch (error: any) {
      logSecureError(error, 'Login', supabase)
      toast.error(sanitizeError(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleMicrosoftSignIn = async () => {
    setIsMicrosoftLoading(true)
    
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'openid profile email',
          redirectTo: redirectUrl,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline'
          }
        }
      })
      
      if (error) {
        logSecureError(error, 'Microsoft OAuth', supabase)
        toast.error(sanitizeError(error))
        return
      }
      
      if (data?.url) {
        window.location.href = data.url
      } else {
        toast.error('Microsoft sign-in failed: No redirect URL received')
      }
      
    } catch (error: any) {
      logSecureError(error, 'Microsoft OAuth', supabase)
      toast.error(sanitizeError(error))
    } finally {
      setTimeout(() => setIsMicrosoftLoading(false), 1000)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) {
      toast.error('Please enter your email address')
      return
    }

    setIsResetting(true)
    try {
      await resetPassword(resetEmail)
      setShowForgotPassword(false)
      setResetEmail('')
    } catch (error) {
      // Error handled in resetPassword function
    } finally {
      setIsResetting(false)
    }
  }

  if (showForgotPassword) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-card">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-semibold text-foreground">Reset Password</h1>
            <p className="text-muted-foreground">
              Enter your email address and we'll send you a reset link
            </p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10 h-12"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12" 
              disabled={isResetting}
            >
              {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </form>
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => {
                setShowForgotPassword(false)
                setResetEmail('')
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Card className="shadow-xl border-0 bg-card">
        <CardContent className="p-8 space-y-6">
          {/* Welcome Header */}
          <div className="text-center space-y-3 mb-2">
            <h1 className="text-3xl font-semibold text-foreground">
              Welcome to Halo Business Finance
            </h1>
            <p className="text-muted-foreground">
              Sign in to your account
            </p>
          </div>

          {/* Sign In / Sign Up Tabs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              className="flex-1 pb-3 text-center font-medium text-foreground border-b-2 border-primary"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={onToggleMode}
              disabled={isLoading || isMicrosoftLoading}
              className="flex-1 pb-3 text-center font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign Up
            </button>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-10"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors w-6 h-6 flex items-center justify-center"
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              variant="outline"
              className="w-full h-12 font-medium" 
              disabled={isLoading || isMicrosoftLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-4 text-muted-foreground tracking-wider">
                Or continue with
              </span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleMicrosoftSignIn}
              disabled={isMicrosoftLoading || isLoading}
              variant="outline"
              className="flex-1 h-12"
              aria-label="Sign in with Microsoft"
            >
              {isMicrosoftLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 23 23">
                  <path fill="#f25022" d="M1 1h10v10H1z"/>
                  <path fill="#00a4ef" d="M12 1h10v10H12z"/>
                  <path fill="#7fba00" d="M1 12h10v10H1z"/>
                  <path fill="#ffb900" d="M12 12h10v10H12z"/>
                </svg>
              )}
            </Button>
          </div>

          {/* Forgot Password */}
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-muted-foreground hover:text-foreground p-0 h-auto"
              disabled={isLoading || isMicrosoftLoading}
            >
              Forgot your password?
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Terms of Service */}
      <p className="text-center text-sm text-muted-foreground">
        By signing up, you agree to our{' '}
        <a href="#" className="text-primary hover:underline">terms of service</a>
        {' '}and{' '}
        <a href="#" className="text-primary hover:underline">privacy policy</a>.
      </p>
    </div>
  )
}
