import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Phone, PhoneCall } from "lucide-react"
import { formatPhoneNumber } from "@/lib/utils"

interface PhoneDialerProps {
  trigger?: React.ReactNode
  phoneNumber?: string // Pre-fill with this phone number
}

export function PhoneDialer({ trigger, phoneNumber: initialPhoneNumber }: PhoneDialerProps) {
  const [isOpen, setIsOpen] = useState(false)
  // Strip and reformat initial phone number to ensure consistent display
  const cleanInitialPhone = initialPhoneNumber ? formatPhoneNumber(initialPhoneNumber) : ""
  const [phoneNumber, setPhoneNumber] = useState(cleanInitialPhone)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const makeCall = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Missing Phone Number",
        description: "Please enter a phone number to call.",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ringcentral-auth', {
        body: {
          action: 'call',
          phoneNumber: phoneNumber.trim()
        }
      })

      if (error) throw error

      toast({
        title: "Call Initiated",
        description: `Calling ${phoneNumber}...`,
      })

      setPhoneNumber("")
      setIsOpen(false)
    } catch (error) {
      console.error('Error making call:', error)
      toast({
        title: "Call Failed",
        description: "Failed to initiate call. Please check your RingCentral configuration.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      makeCall()
    }
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="w-full justify-start gap-2">
      <Phone className="w-4 h-4" />
      <span>Make Call</span>
    </Button>
  )

  // Reset phone number when dialog opens/closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && initialPhoneNumber) {
      // Strip and reformat to ensure consistent display
      setPhoneNumber(formatPhoneNumber(initialPhoneNumber))
    } else if (!open && !initialPhoneNumber) {
      setPhoneNumber("")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            Make a Call
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                const formatted = formatPhoneNumber(e.target.value)
                setPhoneNumber(formatted)
              }}
              onKeyPress={handleKeyPress}
              placeholder="(555) 123-4567"
              className="text-lg"
              maxLength={14}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={makeCall}
              disabled={loading || !phoneNumber.trim()}
              className="bg-gradient-primary"
            >
              {loading ? "Calling..." : "Call"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}