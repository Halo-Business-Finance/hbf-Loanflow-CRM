import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Loader2 } from 'lucide-react'

export function CallbackHandler() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    // Wait for auth state to be determined
    if (!loading) {
      if (user) {
        // User is authenticated, redirect to dashboard
        navigate('/', { replace: true })
      } else {
        // No user found, redirect to auth page
        navigate('/auth', { replace: true })
      }
    }
  }, [user, loading, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-lg font-medium">Completing sign-in...</p>
        <p className="text-muted-foreground">Please wait while we verify your credentials.</p>
      </div>
    </div>
  )
}