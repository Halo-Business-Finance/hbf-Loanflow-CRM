import { useState } from "react"
import { Plus, Phone, Mail, Calendar, User, Users, FileText, BarChart3, Bell, Settings, Zap, AlertTriangle } from "lucide-react"
// IBM migration: supabase import removed - quick actions use navigation only
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

interface QuickAction {
  id: string
  label: string
  description: string
  icon: any
  route: string
  category: 'create' | 'view' | 'manage'
  color: string
  priority: number
}

export function QuickActionsImproved() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'create' | 'view' | 'manage'>('all')
  const navigate = useNavigate()
  const { toast } = useToast()

  const quickActions: QuickAction[] = [
    // Create Actions
    {
      id: 'new-lead',
      label: 'New Lead',
      description: 'Add a new lead to your pipeline',
      icon: User,
      route: '/leads',
      category: 'create',
      color: 'bg-navy',
      priority: 1
    },
    {
      id: 'new-client',
      label: 'New Client',
      description: 'Convert a lead or add existing client',
      icon: Users,
      route: '/clients',
      category: 'create',
      color: 'bg-green-500',
      priority: 2
    },
    
    // View Actions
    {
      id: 'view-pipeline',
      label: 'Pipeline',
      description: 'View your sales pipeline',
      icon: BarChart3,
      route: '/pipeline',
      category: 'view',
      color: 'bg-purple-500',
      priority: 3
    },
    {
      id: 'view-activities',
      label: 'Activities',
      description: 'View recent activities and tasks',
      icon: Calendar,
      route: '/activities',
      category: 'view',
      color: 'bg-orange-500',
      priority: 4
    },
    {
      id: 'view-reports',
      label: 'Reports',
      description: 'Analytics and performance reports',
      icon: FileText,
      route: '/reports',
      category: 'view',
      color: 'bg-indigo-500',
      priority: 5
    },
    
    // Manage Actions
    {
      id: 'manage-notifications',
      label: 'Notifications',
      description: 'Manage alerts and reminders',
      icon: Bell,
      route: '/activities',
      category: 'manage',
      color: 'bg-red-500',
      priority: 6
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure your preferences',
      icon: Settings,
      route: '/settings',
      category: 'manage',
      color: 'bg-gray-500',
      priority: 7
    },
    {
      id: 'emergency-lockdown',
      label: 'Emergency Lockdown',
      description: 'Immediate security lockdown',
      icon: AlertTriangle,
      route: '',
      category: 'manage',
      color: 'bg-red-600',
      priority: 8
    }
  ]

  const categories = [
    { id: 'all' as const, label: 'All Actions', count: quickActions.length },
    { id: 'create' as const, label: 'Create', count: quickActions.filter(a => a.category === 'create').length },
    { id: 'view' as const, label: 'View', count: quickActions.filter(a => a.category === 'view').length },
    { id: 'manage' as const, label: 'Manage', count: quickActions.filter(a => a.category === 'manage').length }
  ]

  const filteredActions = selectedCategory === 'all' 
    ? quickActions 
    : quickActions.filter(action => action.category === selectedCategory)

  const handleAction = async (action: QuickAction) => {
    console.log('Quick action clicked:', action.id)
    
    if (action.id === 'emergency-lockdown') {
      console.log('Emergency lockdown triggered')
      
      // Immediate lockdown without confirmation for emergency situations
      try {
        // Step 1: Clear all local storage immediately
        console.log('Clearing localStorage...')
        localStorage.clear()
        sessionStorage.clear()
        
        // Step 2: Clear any cookies
        document.cookie.split(";").forEach(function(c) { 
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        })
        
        // Step 3: Force sign out
        console.log('Signing out...')
        await (await import('@/lib/auth-utils')).authSignOut()
        
        // Step 4: Show immediate notification
        toast({
          title: "🚨 EMERGENCY LOCKDOWN ACTIVATED",
          description: "All sessions terminated. Redirecting to secure page...",
          variant: "destructive",
        })
        
        // Step 5: Force immediate redirect
        console.log('Redirecting...')
        window.location.replace('/')
        
      } catch (error) {
        console.error('Emergency lockdown error:', error)
        // Force redirect even if error occurs
        window.location.replace('/')
      }
    } else {
      navigate(action.route)
    }
    setIsOpen(false)
  }

  const getTopActions = () => {
    return quickActions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 4)
  }

  return (
    <>
      {/* Desktop Floating Action Button with Improved Design */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="lg" 
              className="h-16 w-16 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/80 hover:scale-110 relative group"
            >
              <Plus className="h-6 w-6 transition-transform group-hover:rotate-90" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <Zap className="h-3 w-3 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2 bg-background border shadow-lg z-50">
            <DropdownMenuLabel className="text-lg font-semibold">Quick Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Top Priority Actions */}
            <div className="space-y-1">
              {getTopActions().map((action) => {
                const Icon = action.icon
                return (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Dropdown item clicked:', action.id);
                      handleAction(action);
                    }}
                    className="p-3 cursor-pointer hover:bg-accent/50 rounded-md"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className={`w-8 h-8 ${action.color} rounded-lg flex items-center justify-center`}>
                        <Icon className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{action.label}</div>
                        <div className="text-xs text-muted-foreground">{action.description}</div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </div>
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('View all actions clicked');
              setIsOpen(true);
            }} className="p-3">
              <div className="flex items-center gap-2 w-full">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">View All Actions</span>
                <span className="ml-auto text-sm">
                  {quickActions.length}
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Quick Actions Bar with Better Design */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 p-4 md:hidden z-40">
        <div className="flex justify-center">
          <Button 
            onClick={() => setIsOpen(true)}
            className="bg-gradient-to-r from-primary to-primary/80 hover:scale-105 transition-transform shadow-lg px-6 py-3"
          >
            <Zap className="mr-2 h-4 w-4" />
            Quick Actions
            <span className="ml-2 text-sm">
              {quickActions.length}
            </span>
          </Button>
        </div>
      </div>

      {/* Enhanced Quick Actions Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Quick Actions Hub</DialogTitle>
          </DialogHeader>
          
          {/* Category Filter */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="whitespace-nowrap"
              >
                {category.label}
                <span className="ml-2 text-sm">
                  {category.count}
                </span>
              </Button>
            ))}
          </div>

          {/* Actions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredActions.map((action) => {
              const Icon = action.icon
              return (
                <Card
                  key={action.id}
                  className="cursor-pointer hover:bg-accent/50 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Card clicked:', action.id);
                    handleAction(action);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm mb-1">{action.label}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Quick Stats Footer */}
          <div className="mt-6 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total Actions Available</span>
              <span className="text-sm">{quickActions.length}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}