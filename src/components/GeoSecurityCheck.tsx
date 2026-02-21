import { useEffect, useState } from 'react'
import { ibmDb } from '@/lib/ibm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, AlertTriangle } from 'lucide-react'

interface GeoSecurityCheckProps {
  children: React.ReactNode
}

export function GeoSecurityCheck({ children }: GeoSecurityCheckProps) {
  const [isChecking, setIsChecking] = useState(true)
  const [isAllowed, setIsAllowed] = useState(false)
  const [blockReason, setBlockReason] = useState('')

  useEffect(() => {
    const checkGeoSecurity = async () => {
      try {
        console.log('Performing geo-security check...')
        const { data, error } = await ibmDb.rpc('geo_security_check', {})
        
        console.log('Geo-security response:', { data, error })
        
        if (error) {
          console.error('Geo-security error:', error)
          // Allow access on error to prevent lockout
          setIsAllowed(true)
          setBlockReason('')
        } else if (!(data as any)?.allowed) {
          setIsAllowed(false)
          setBlockReason((data as any)?.reason || 'Access restricted to US locations only')
          console.log('Geo-security check failed:', (data as any)?.reason)
        } else {
          setIsAllowed(true)
          console.log('Geo-security check passed')
        }
      } catch (error) {
        console.error('Geo-security check error:', error)
        // Allow access on error to prevent lockout, but log for review
        setIsAllowed(true)
      } finally {
        setIsChecking(false)
      }
    }

    // Temporarily bypass geo check - allow immediate access
    console.log('DEBUG: Bypassing geo-security check for troubleshooting')
    setIsAllowed(true)
    setIsChecking(false)
    
    // Still run the check for debugging but don't block
    checkGeoSecurity()
  }, [])

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-lg">
          <Shield className="w-6 h-6 animate-pulse text-primary" />
          <span>Verifying security access...</span>
        </div>
      </div>
    )
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-center text-base font-medium">
              <div className="mb-2">🛡️ Access Restricted</div>
              <div className="text-sm">{blockReason}</div>
              <div className="text-xs mt-3 opacity-75">
                This CRM system is only available to users located within the United States for security compliance.
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return <>{children}</>
}