import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Phone, Settings, CheckCircle, AlertCircle } from "lucide-react"

interface RingCentralAccount {
  id: string
  client_id: string
  username: string
  extension?: string
  server_url: string
  is_active: boolean
}

interface RingCentralSetupProps {
  trigger?: React.ReactNode
}

export function RingCentralSetup({ trigger }: RingCentralSetupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [account, setAccount] = useState<RingCentralAccount | null>(null)
  const [formData, setFormData] = useState({
    client_id: "",
    client_secret: "",
    username: "",
    extension: "",
    server_url: "https://platform.ringcentral.com"
  })
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen) {
      loadRingCentralAccount()
    }
  }, [isOpen])

  const loadRingCentralAccount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('ringcentral_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (data) {
        setAccount(data)
        setFormData({
          client_id: data.client_id,
          client_secret: "", // Don't pre-fill sensitive data
          username: data.username,
          extension: data.extension || "",
          server_url: data.server_url
        })
      }
    } catch (error) {
      console.error('Error loading RingCentral account:', error)
    }
  }

  const handleSave = async () => {
    if (!formData.client_id || !formData.client_secret || !formData.username) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "Please log in to configure RingCentral.",
          variant: "destructive"
        })
        return
      }

      const accountData = {
        user_id: user.id,
        client_id: formData.client_id,
        client_secret: formData.client_secret,
        username: formData.username,
        extension: formData.extension || null,
        server_url: formData.server_url,
        is_active: true
      }

      let result
      if (account) {
        // Update existing account
        result = await supabase
          .from('ringcentral_accounts')
          .update(accountData)
          .eq('id', account.id)
      } else {
        // Create new account
        result = await supabase
          .from('ringcentral_accounts')
          .insert([accountData])
      }

      if (result.error) {
        throw result.error
      }

      toast({
        title: "Success",
        description: `RingCentral account ${account ? 'updated' : 'configured'} successfully.`,
      })

      setIsOpen(false)
      await loadRingCentralAccount()
    } catch (error) {
      console.error('Error saving RingCentral account:', error)
      toast({
        title: "Error",
        description: "Failed to save RingCentral configuration.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!account) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('ringcentral_accounts')
        .delete()
        .eq('id', account.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "RingCentral account removed successfully.",
      })

      setAccount(null)
      setFormData({
        client_id: "",
        client_secret: "",
        username: "",
        extension: "",
        server_url: "https://platform.ringcentral.com"
      })
      setIsOpen(false)
    } catch (error) {
      console.error('Error deleting RingCentral account:', error)
      toast({
        title: "Error",
        description: "Failed to remove RingCentral configuration.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="w-full justify-start gap-2">
      <Phone className="w-4 h-4" />
      <span>Phone System</span>
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            RingCentral Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          {account && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Current Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {account.is_active ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-orange-600" />
                    )}
                    <span className="text-sm">
                      {account.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Username: {account.username}
                    {account.extension && ` (Ext: ${account.extension})`}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuration Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Client ID *</Label>
              <Input
                id="client_id"
                value={formData.client_id}
                onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                placeholder="Your RingCentral Client ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_secret">Client Secret *</Label>
              <Input
                id="client_secret"
                type="password"
                value={formData.client_secret}
                onChange={(e) => setFormData(prev => ({ ...prev, client_secret: e.target.value }))}
                placeholder="Your RingCentral Client Secret"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Your RingCentral username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extension">Extension</Label>
              <Input
                id="extension"
                value={formData.extension}
                onChange={(e) => setFormData(prev => ({ ...prev, extension: e.target.value }))}
                placeholder="Extension number (optional)"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="server_url">Server URL</Label>
            <Input
              id="server_url"
              value={formData.server_url}
              onChange={(e) => setFormData(prev => ({ ...prev, server_url: e.target.value }))}
              placeholder="https://platform.ringcentral.com"
            />
          </div>

          {/* Help Text */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Getting Started with RingCentral</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Create a developer account at https://developers.ringcentral.com/</li>
              <li>• Create a new app and get your Client ID and Client Secret</li>
              <li>• Use your RingCentral username (phone number or email)</li>
              <li>• Extension is optional for multi-extension accounts</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div>
              {account && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  Remove Configuration
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading}
                className="bg-gradient-primary"
              >
                {loading ? "Saving..." : account ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}