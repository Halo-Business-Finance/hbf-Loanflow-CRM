import { useState } from "react"
import { Plus, Phone, Mail, Calendar, User, Users } from "lucide-react"
import { useRoleBasedAccess } from "@/hooks/useRoleBasedAccess"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useNavigate } from "react-router-dom"

export function QuickActions() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const { canAccessLeads, canManageClients, canViewReports } = useRoleBasedAccess()

  const handleAction = (action: string) => {
    switch (action) {
      case 'new-lead':
        navigate('/leads')
        break
      case 'new-client':
        navigate('/clients')
        break
      case 'view-pipeline':
        navigate('/pipeline')
        break
      case 'view-activities':
        navigate('/activities')
        break
    }
    setIsOpen(false)
  }

  return (
    <>
      {/* Desktop Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="lg" 
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-primary hover:scale-105"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {canAccessLeads && (
              <DropdownMenuItem onClick={() => handleAction('new-lead')}>
                <User className="mr-2 h-4 w-4" />
                <span>Add New Lead</span>
              </DropdownMenuItem>
            )}
            {canManageClients && (
              <DropdownMenuItem onClick={() => handleAction('new-client')}>
                <Users className="mr-2 h-4 w-4" />
                <span>Add New Client</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {canViewReports && (
              <DropdownMenuItem onClick={() => handleAction('view-pipeline')}>
                <Calendar className="mr-2 h-4 w-4" />
                <span>View Pipeline</span>
              </DropdownMenuItem>
            )}
            {canViewReports && (
              <DropdownMenuItem onClick={() => handleAction('view-activities')}>
                <Mail className="mr-2 h-4 w-4" />
                <span>View Activities</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Quick Actions Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 md:hidden z-40">
        <div className="flex justify-center">
          <Button 
            onClick={() => setIsOpen(true)}
            className="bg-gradient-primary hover:scale-105 transition-transform"
          >
            <Plus className="mr-2 h-4 w-4" />
            Quick Actions
          </Button>
        </div>
      </div>

      {/* Mobile Quick Actions Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Quick Actions</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {canAccessLeads && (
              <Button 
                variant="default" 
                className="h-20 flex-col gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleAction('new-lead')}
              >
                <User className="h-6 w-6" />
                <span className="text-sm">New Lead</span>
              </Button>
            )}
            {canManageClients && (
              <Button 
                variant="default" 
                className="h-20 flex-col gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleAction('new-client')}
              >
                <Users className="h-6 w-6" />
                <span className="text-sm">New Client</span>
              </Button>
            )}
            {canViewReports && (
              <Button 
                variant="default" 
                className="h-20 flex-col gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleAction('view-pipeline')}
              >
                <Calendar className="h-6 w-6" />
                <span className="text-sm">Pipeline</span>
              </Button>
            )}
            {canViewReports && (
              <Button 
                variant="default" 
                className="h-20 flex-col gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => handleAction('view-activities')}
              >
                <Mail className="h-6 w-6" />
                <span className="text-sm">Activities</span>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}