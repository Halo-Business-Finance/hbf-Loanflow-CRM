import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Mail, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ibmDb } from "@/lib/ibm"

interface EmailComposerProps {
  trigger: React.ReactNode
  recipientEmail?: string // Pre-fill with this email
  recipientName?: string // Optional name for subject personalization
}

export function EmailComposer({ trigger, recipientEmail, recipientName }: EmailComposerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [formData, setFormData] = useState({
    to: recipientEmail || "",
    cc: "",
    bcc: "",
    subject: recipientName ? `Follow-up: ${recipientName}` : "",
    body: ""
  })
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const parseEmailList = (emailString: string): string[] => {
    return emailString
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0)
  }

  const handleSendEmail = async () => {
    if (!formData.to.trim() || !formData.subject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide at least recipient email and subject",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSending(true)

      const { data, error } = await ibmDb.rpc('microsoft-auth', {
        body: {
          action: 'send_email',
          to: parseEmailList(formData.to),
          cc: formData.cc ? parseEmailList(formData.cc) : [],
          bcc: formData.bcc ? parseEmailList(formData.bcc) : [],
          subject: formData.subject,
          body: formData.body.replace(/\n/g, '<br>')
        }
      })

      if (error) throw error

      toast({
        title: "Email Sent",
        description: "Your email was sent successfully via Microsoft 365",
      })

      // Reset form but keep recipient if provided
      setFormData({
        to: recipientEmail || "",
        cc: "",
        bcc: "",
        subject: recipientName ? `Follow-up: ${recipientName}` : "",
        body: ""
      })
      setIsOpen(false)

    } catch (error: any) {
      console.error('Error sending email:', error)
      toast({
        title: "Failed to Send Email",
        description: error.message || "Please check your Microsoft 365 connection and try again",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Compose Email
          </DialogTitle>
          <DialogDescription>
            Send an email using your connected Microsoft 365 account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">To *</Label>
            <Input
              id="to"
              placeholder="recipient@example.com, another@example.com"
              value={formData.to}
              onChange={(e) => handleInputChange('to', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">CC</Label>
            <Input
              id="cc"
              placeholder="cc@example.com"
              value={formData.cc}
              onChange={(e) => handleInputChange('cc', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bcc">BCC</Label>
            <Input
              id="bcc"
              placeholder="bcc@example.com"
              value={formData.bcc}
              onChange={(e) => handleInputChange('bcc', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Email subject"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              rows={8}
              value={formData.body}
              onChange={(e) => handleInputChange('body', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}