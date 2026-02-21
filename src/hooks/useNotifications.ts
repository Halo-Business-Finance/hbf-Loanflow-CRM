import { ibmDb } from "@/lib/ibm"
import { useAuth } from "@/components/auth/AuthProvider"
import { toast } from "@/hooks/use-toast"

interface CreateNotificationParams {
  title: string
  message: string
  type: string
  leadId?: string
  clientId?: string
}

export function useNotifications() {
  const { user } = useAuth()

  const createNotification = async (params: CreateNotificationParams) => {
    if (!user) return

    try {
      const { error } = await ibmDb
        .from('notifications')
        .insert({
          user_id: user.id,
          title: params.title,
          message: params.message,
          type: params.type,
          related_id: params.leadId || params.clientId || null,
          related_type: params.leadId ? 'lead' : params.clientId ? 'client' : null,
        })

      if (error) throw error

      toast({
        title: params.title,
        description: params.message,
      })
    } catch (error) {
      console.error('Error creating notification:', error)
    }
  }

  // Helper functions for common notification types
  const notifyLeadStatusChange = (leadName: string, newStatus: string, leadId: string) => {
    createNotification({
      title: 'Lead Status Updated',
      message: `${leadName} has been moved to ${newStatus}`,
      type: 'lead_status_change',
      leadId,
    })
  }

  const notifyNewLead = (leadName: string, leadId: string) => {
    createNotification({
      title: 'New Lead Added',
      message: `${leadName} has been added to your leads`,
      type: 'lead_created',
      leadId,
    })
  }

  const notifyClientConverted = (clientName: string, clientId: string) => {
    createNotification({
      title: 'Lead Converted to Client',
      message: `${clientName} has been successfully converted to a client`,
      type: 'client_created',
      clientId,
    })
  }

  const notifyFollowUpReminder = (leadName: string, action: string, leadId: string) => {
    createNotification({
      title: 'Follow-up Reminder',
      message: `Don't forget to follow up with ${leadName} about the ${action}`,
      type: 'follow_up_reminder',
      leadId,
    })
  }

  const notifyLoanCreated = (clientName: string, amount: number, clientId: string) => {
    createNotification({
      title: 'New Loan Created',
      message: `Loan of $${amount.toLocaleString()} created for ${clientName}`,
      type: 'loan_created',
      clientId,
    })
  }

  return {
    createNotification,
    notifyLeadStatusChange,
    notifyNewLead,
    notifyClientConverted,
    notifyFollowUpReminder,
    notifyLoanCreated,
  }
}
