import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Shield, LogIn } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { toast } from 'sonner'
import { sanitizeError } from '@/lib/error-sanitizer'

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useAuth()

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn()
      toast.success('Signed in successfully')
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

          {/* SSO Sign In Button */}
          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full h-12 font-medium"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting to IBM…
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-5 w-5" />
                Sign in with IBM
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Authentication is managed by IBM App ID.
            <br />
            Contact your administrator if you need access.
          </p>
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
