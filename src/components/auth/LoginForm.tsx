import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Shield } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { toast } from 'sonner'
import { sanitizeError } from '@/lib/error-sanitizer'

interface LoginFormProps {
  onToggleMode: () => void
}

export function LoginForm({ onToggleMode }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { signIn, resetPassword } = useAuth()
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn()
    } catch (error: any) {
      toast.error(sanitizeError(error))
    } finally {
      setIsLoading(false)
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
    } catch {
      // handled in resetPassword
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
              <label htmlFor="reset-email" className="text-sm font-medium">Email</label>
              <input
                id="reset-email"
                type="email"
                placeholder="Enter your email"
                className="w-full h-12 px-3 rounded-md border border-input bg-background text-foreground"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-12" disabled={isResetting}>
              {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </form>
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => { setShowForgotPassword(false); setResetEmail('') }}
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
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-semibold text-foreground">
              Welcome to Halo Business Finance
            </h1>
            <p className="text-muted-foreground">
              Sign in with your IBM account to continue
            </p>
          </div>

          {/* Tabs */}
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
              disabled={isLoading}
              className="flex-1 pb-3 text-center font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign Up
            </button>
          </div>

          {/* IBM App ID Sign-In */}
          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full h-12 font-medium"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In with IBM'
            )}
          </Button>

          {/* Forgot Password */}
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-muted-foreground hover:text-foreground p-0 h-auto"
              disabled={isLoading}
            >
              Forgot your password?
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        By signing in, you agree to our{' '}
        <a href="#" className="text-primary hover:underline">terms of service</a>
        {' '}and{' '}
        <a href="#" className="text-primary hover:underline">privacy policy</a>.
      </p>
    </div>
  )
}
