import React, { useState } from 'react'
import { Plus, AlertTriangle, User, Users, Calendar, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export function SimpleQuickActions() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleEmergencyLockdown = async () => {
    console.log('Emergency lockdown clicked!')
    
    try {
      // Clear all storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Sign out
      await supabase.auth.signOut({ scope: 'global' })
      
      // Show notification
      toast({
        title: "🚨 EMERGENCY LOCKDOWN",
        description: "Session terminated successfully",
        variant: "destructive",
      })
      
      // Redirect
      window.location.href = '/'
      
    } catch (error) {
      console.error('Lockdown error:', error)
      window.location.href = '/'
    }
  }

  const handleNavigation = (route: string) => {
    console.log('Navigating to:', route)
    navigate(route)
    setIsOpen(false)
  }

  return (
    <>
      {/* Desktop Floating Button */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:block">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button 
              size="lg" 
              className="h-16 w-16 rounded-full shadow-xl bg-primary hover:bg-primary/90"
              onClick={() => {
                console.log('FAB clicked')
                setIsOpen(true)
              }}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-background border shadow-lg">
            <DialogHeader>
              <DialogTitle>Quick Actions</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-3 p-4">
              {/* New Lead */}
              <Button 
                className="w-full h-auto py-4 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-start gap-3"
                onClick={() => handleNavigation('/leads')}
              >
                <User className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Create Lead</div>
                  <div className="text-xs text-white/80">Add new prospect</div>
                </div>
              </Button>

              {/* Schedule Meeting */}
              <Button 
                className="w-full h-auto py-4 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-start gap-3"
                onClick={() => handleNavigation('/pipeline')}
              >
                <Calendar className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Schedule Meeting</div>
                  <div className="text-xs text-white/80">Book calendar event</div>
                </div>
              </Button>

              {/* Upload Document */}
              <Button 
                className="w-full h-auto py-4 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-start gap-3"
                onClick={() => handleNavigation('/documents')}
              >
                <Plus className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Upload Document</div>
                  <div className="text-xs text-white/80">Manage files</div>
                </div>
              </Button>

              {/* New Client */}
              <Button 
                className="w-full h-auto py-4 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-start gap-3"
                onClick={() => handleNavigation('/clients')}
              >
                <Users className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">New Client</div>
                  <div className="text-xs text-white/80">Add existing borrower</div>
                </div>
              </Button>

              {/* Settings */}
              <Button 
                className="w-full h-auto py-4 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-start gap-3"
                onClick={() => handleNavigation('/settings')}
              >
                <Settings className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Settings</div>
                  <div className="text-xs text-white/80">Configure app</div>
                </div>
              </Button>

              {/* Emergency Lockdown */}
              <Button 
                className="w-full h-auto py-4 bg-red-600 hover:bg-red-700 text-white flex items-center justify-start gap-3"
                onClick={handleEmergencyLockdown}
              >
                <AlertTriangle className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Emergency Lockdown</div>
                  <div className="text-xs text-white/80">Immediate security lockdown</div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile Button */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 md:hidden z-50">
        <Button 
          onClick={() => {
            console.log('Mobile button clicked')
            setIsOpen(true)
          }}
          className="bg-primary hover:bg-primary/90 shadow-lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Quick Actions
        </Button>
      </div>
    </>
  )
}