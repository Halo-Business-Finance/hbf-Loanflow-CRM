import { useState } from "react"
import { Check, Edit, Trash2, Mail, Phone, X } from "lucide-react"
import { Button } from "@/components/ui/button"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

interface BulkActionsProps {
  selectedItems: string[]
  onClearSelection: () => void
  onBulkUpdate: (action: string, value?: string) => Promise<void>
  type: 'leads' | 'clients'
}

export function BulkActions({ selectedItems, onClearSelection, onBulkUpdate, type }: BulkActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ action: string; value?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  if (selectedItems.length === 0) return null

  const handleAction = (action: string, value?: string) => {
    if (action === 'delete') {
      setPendingAction({ action, value })
      setShowConfirm(true)
    } else {
      executeAction(action, value)
    }
  }

  const executeAction = async (action: string, value?: string) => {
    setLoading(true)
    try {
      await onBulkUpdate(action, value)
      toast({
        title: "Bulk action completed",
        description: `${selectedItems.length} ${type} updated successfully`,
      })
      onClearSelection()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to perform bulk action",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setShowConfirm(false)
      setPendingAction(null)
    }
  }

  const getStageOptions = () => {
    if (type === 'leads') {
      return [
        { value: 'New Lead', label: 'New Lead' },
        { value: 'Initial Contact', label: 'Initial Contact' },
        { value: 'Loan Application Signed', label: 'Loan Application Signed' },
        { value: 'Waiting for Documentation', label: 'Waiting for Documentation' },
        { value: 'Pre-Approved', label: 'Pre-Approved' },
        { value: 'Term Sheet Signed', label: 'Term Sheet Signed' },
        { value: 'Loan Approved', label: 'Loan Approved' },
        { value: 'Closing', label: 'Closing' },
        { value: 'Loan Funded', label: 'Loan Funded' },
      ]
    } else {
      return [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
        { value: 'Pending', label: 'Pending' },
      ]
    }
  }

  const getPriorityOptions = () => [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-background border rounded-lg shadow-lg p-4 animate-slide-in-right">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {selectedItems.length} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Update Loan Stage/Status */}
            <Select onValueChange={(value) => handleAction(type === 'leads' ? 'stage' : 'status', value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={`Update ${type === 'leads' ? 'Loan Stage' : 'Status'}`} />
              </SelectTrigger>
              <SelectContent>
                {getStageOptions().map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Update Priority */}
            <Select onValueChange={(value) => handleAction('priority', value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {getPriorityOptions().map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quick Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('email')}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Mail className="h-4 w-4 mr-1" />
              Email
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('call')}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Phone className="h-4 w-4 mr-1" />
              Call
            </Button>

            {/* Delete */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleAction('delete')}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedItems.length} {type}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingAction && executeAction(pendingAction.action, pendingAction.value)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedItems.length} {type}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}