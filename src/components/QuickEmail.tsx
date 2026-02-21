import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Mail, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ibmDb } from "@/lib/ibm"

interface QuickEmailProps {
  trigger: React.ReactNode
  recipientEmail: string
  recipientName?: string
}

export function QuickEmail({ trigger, recipientEmail, recipientName }: QuickEmailProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [formData, setFormData] = useState({
    subject: recipientName ? `Follow-up regarding your loan application` : "Follow-up from LoanFlow",
    body: recipientName ? 
      `Hi ${recipientName},\n\nI hope this message finds you well. I wanted to follow up regarding your loan application.\n\nPlease let me know if you have any questions or if there's anything I can help you with.\n\nBest regards,\n[Your Name]` :
      `Hi,\n\nI hope this message finds you well. I wanted to follow up regarding your inquiry.\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]`
  })
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSendEmail = async () => {
    if (!formData.subject.trim()) {
      toast({
        title: "Missing Subject",
        description: "Please provide an email subject",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSending(true)

      const { data, error } = await ibmDb.rpc('send_email', {
        p_to: recipientEmail,
        p_subject: formData.subject,
        p_body: formData.body,
        p_lead_name: recipientName,
        p_from_name: "LoanFlow Team"
      })

      if (error) throw error

      toast({
        title: "Email Sent Successfully",
        description: `Email sent to ${recipientEmail}`,
      })

      // Reset form
      setFormData({
        subject: recipientName ? `Follow-up regarding your loan application` : "Follow-up from LoanFlow",
        body: recipientName ? 
          `Hi ${recipientName},\n\nI hope this message finds you well. I wanted to follow up regarding your loan application.\n\nPlease let me know if you have any questions or if there's anything I can help you with.\n\nBest regards,\n[Your Name]` :
          `Hi,\n\nI hope this message finds you well. I wanted to follow up regarding your inquiry.\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]`
      })
      setIsOpen(false)

    } catch (error: any) {
      console.error('Error sending email:', error)
      toast({
        title: "Failed to Send Email",
        description: error.message || "Please check your email configuration and try again",
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Quick Email
          </DialogTitle>
          <DialogDescription>
            Send a quick email to {recipientEmail}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              value={recipientEmail}
              disabled
              className="bg-muted"
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