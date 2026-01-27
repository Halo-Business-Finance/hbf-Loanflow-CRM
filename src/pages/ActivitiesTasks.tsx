import { StandardPageLayout } from "@/components/StandardPageLayout"

import { StandardKPICard } from "@/components/StandardKPICard"
import { StandardContentCard } from "@/components/StandardContentCard"
import { ResponsiveContainer } from "@/components/ResponsiveContainer"
import { CheckSquare, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { IBMPageHeader } from "@/components/ui/IBMPageHeader"

export default function ActivitiesTasks() {
  return (
    <StandardPageLayout>
      <IBMPageHeader 
        title="Tasks"
        subtitle="Manage your daily tasks and action items"
        actions={
          <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
            <RefreshCw className="h-3 w-3 mr-2" />
            Refresh Data
          </Button>
        }
      />

      <ResponsiveContainer>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StandardKPICard
              title="Pending Tasks"
              value="12"
              className="border border-blue-600"
            />

            <StandardKPICard
              title="Completed"
              value="8"
              trend={{ value: "+15%", direction: "up" as const }}
              className="border border-blue-600"
            />

            <StandardKPICard
              title="Overdue"
              value="3"
              className="border border-blue-600"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <StandardContentCard title="Today's Tasks">
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-card/80 transition-colors">
                  <Checkbox />
                  <div className="flex-1">
                    <p className="font-medium">Review loan application #12345</p>
                    <p className="text-sm text-muted-foreground">Due: 2:00 PM</p>
                  </div>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-card/80 transition-colors">
                  <Checkbox />
                  <div className="flex-1">
                    <p className="font-medium">Call client for documentation</p>
                    <p className="text-sm text-muted-foreground">Due: 3:30 PM</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-card/80 transition-colors">
                  <Checkbox checked />
                  <div className="flex-1">
                    <p className="font-medium line-through text-muted-foreground">Send approval letter</p>
                    <p className="text-sm text-muted-foreground">Completed: 10:15 AM</p>
                  </div>
                  <CheckSquare className="h-4 w-4 text-primary" />
                </div>
              </div>
            </StandardContentCard>

            <StandardContentCard title="Upcoming Tasks">
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-card/80 transition-colors">
                  <Checkbox />
                  <div className="flex-1">
                    <p className="font-medium">Prepare quarterly report</p>
                    <p className="text-sm text-muted-foreground">Due: Tomorrow</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-card/80 transition-colors">
                  <Checkbox />
                  <div className="flex-1">
                    <p className="font-medium">Team meeting preparation</p>
                    <p className="text-sm text-muted-foreground">Due: Wednesday</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-card/80 transition-colors">
                  <Checkbox />
                  <div className="flex-1">
                    <p className="font-medium">Update client contact information</p>
                    <p className="text-sm text-muted-foreground">Due: Friday</p>
                  </div>
                </div>
              </div>
            </StandardContentCard>
          </div>
        </div>
      </ResponsiveContainer>
    </StandardPageLayout>
  )
}