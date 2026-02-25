import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Shield } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { toast } from 'sonner'
import { sanitizeError } from '@/lib/error-sanitizer'

interface SignUpFormProps {
  onToggleMode: () => void
}

export function SignUpForm({ onToggleMode }: SignUpFormProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signUp } = useAuth()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please fill in all required fields')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setIsLoading(true)
    try {
      await signUp(email, password, firstName, lastName)
      onToggleMode()
    } catch (error: any) {
      toast.error(sanitizeError(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <Card className="shadow-xl border-0 bg-card">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-3 mb-2">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-semibold text-foreground">Create Account</h1>
            <p className="text-muted-foreground">
              Register to join the CRM platform
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={onToggleMode}
              disabled={isLoading}
              className="flex-1 pb-3 text-center font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </button>
            <button
              type="button"
              className="flex-1 pb-3 text-center font-medium text-foreground border-b-2 border-primary"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="first-name" className="text-sm font-medium text-foreground">First Name</label>
                <input
                  id="first-name"
                  type="text"
                  placeholder="First name"
                  className="w-full h-12 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="last-name" className="text-sm font-medium text-foreground">Last Name</label>
                <input
                  id="last-name"
                  type="text"
                  placeholder="Last name"
                  className="w-full h-12 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="signup-email" className="text-sm font-medium text-foreground">Email</label>
              <input
                id="signup-email"
                type="email"
                placeholder="Enter your email"
                className="w-full h-12 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="signup-password" className="text-sm font-medium text-foreground">Password</label>
              <input
                id="signup-password"
                type="password"
                placeholder="Min. 8 characters"
                className="w-full h-12 px-3 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 font-medium"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="link"
              onClick={onToggleMode}
              className="text-sm text-muted-foreground"
              disabled={isLoading}
            >
              Already have an account? Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
