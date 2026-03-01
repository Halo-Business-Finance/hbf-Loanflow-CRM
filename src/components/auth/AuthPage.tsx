import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { LoginForm } from './LoginForm'

export function AuthPage() {
  const navigate = useNavigate()
  const { user, loading, isEmailVerified } = useAuth()

  useEffect(() => {
    if (!loading && user && isEmailVerified) {
      navigate('/', { replace: true })
    }
  }, [user, loading, isEmailVerified, navigate])

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  )
}
