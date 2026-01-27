import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Check, X, Loader2, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useSecureEmailAccounts } from "@/hooks/useSecureEmailAccounts"

interface EmailSetupProps {
  trigger: React.ReactNode
}

export function EmailSetup({ trigger }: EmailSetupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const { toast } = useToast()
  
  // Use secure email accounts hook
  const { 
    emailAccounts, 
    isLoading, 
    deactivateAccount 
  } = useSecureEmailAccounts()
  
  const primaryAccount = emailAccounts[0] || null

  const handleMicrosoftConnect = async () => {
    try {
      setIsConnecting(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Call edge function to get Microsoft OAuth URL
      const { data, error } = await supabase.functions.invoke('microsoft-auth', {
        body: { action: 'get_auth_url' }
      })

      if (error) throw error

      // Redirect to Microsoft OAuth
      window.location.href = data.auth_url
      
    } catch (error: any) {
      console.error('Error connecting to Microsoft:', error)
      toast({
        title: "Connection Error",
        description: error.message || "Failed to connect to Microsoft 365",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!primaryAccount) return
    
    try {
      await deactivateAccount(primaryAccount.id)
    } catch (error: any) {
      console.error('Error disconnecting account:', error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Account Setup
          </DialogTitle>
          <DialogDescription>
            Connect your Microsoft 365 work email to send emails directly from the app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : primaryAccount ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    Secure Connected Account
                  </CardTitle>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="w-3 h-3" />
                    Active
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{primaryAccount.display_name}</p>
                  <p className="text-xs text-muted-foreground">{primaryAccount.email_address}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    🔒 Tokens encrypted at rest for maximum security
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  Disconnect Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Microsoft 365</CardTitle>
                <CardDescription className="text-xs">
                  Connect your work email account to send emails through Microsoft Graph API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleMicrosoftConnect}
                  disabled={isConnecting}
                  className="w-full"
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Connect Microsoft 365
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}