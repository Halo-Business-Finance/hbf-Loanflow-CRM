import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { LoginForm } from './LoginForm'
import { SignUpForm } from './SignUpForm'
import { VerificationPending } from './VerificationPending'

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const navigate = useNavigate()
  const { user, loading, isEmailVerified } = useAuth()

  // Redirect verified users to dashboard
  useEffect(() => {
    if (!loading && user && isEmailVerified) {
      navigate('/', { replace: true })
    }
  }, [user, loading, isEmailVerified, navigate])

  const toggleMode = () => setIsLogin(!isLogin)

  // Show verification pending page if user is logged in but not verified
  if (user && !isEmailVerified) {
    return <VerificationPending />
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {isLogin ? (
          <LoginForm onToggleMode={toggleMode} />
        ) : (
          <SignUpForm onToggleMode={toggleMode} />
        )}
      </div>
    </main>
  )
}