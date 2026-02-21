import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Shield } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { toast } from 'sonner'
import { sanitizeError } from '@/lib/error-sanitizer'

interface SignUpFormProps {
  onToggleMode: () => void
}

export function SignUpForm({ onToggleMode }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { signUp } = useAuth()

  const handleSignUp = async () => {
    setIsLoading(true)
    try {
      await signUp()
      onToggleMode()
    } catch (error: any) {
      toast.error(sanitizeError(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Create Account</CardTitle>
        <CardDescription className="text-center">
          Register with your IBM account to join the CRM platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* IBM App ID Registration */}
        <Button
          onClick={handleSignUp}
          disabled={isLoading}
          className="w-full h-12 font-medium"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Setting up account…
            </>
          ) : (
            'Create Account with IBM'
          )}
        </Button>

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
  )
}
