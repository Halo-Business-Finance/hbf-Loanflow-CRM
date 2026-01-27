import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Settings2, 
  RotateCcw, 
  GripVertical,
  MessageSquare,
  Calendar,
  Clock,
  Brain,
  FileText,
  DollarSign,
  FileCheck,
  Timer,
  Shield,
  CalendarCheck,
  Wallet,
  CheckCircle,
  ListTodo
} from "lucide-react";
import { useDashboardWidgets, AVAILABLE_WIDGETS, WidgetConfig } from "@/hooks/useDashboardWidgets";
import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Calendar,
  Clock,
  Brain,
  FileText,
  DollarSign,
  FileCheck,
  Timer,
  Shield,
  CalendarCheck,
  Wallet,
  CheckCircle,
  ListTodo
};

const categoryColors: Record<string, string> = {
  metrics: 'bg-blue-500',
  activity: 'bg-green-500',
  tools: 'bg-purple-500',
  communication: 'bg-orange-500'
};

interface WidgetCustomizerProps {
  trigger?: React.ReactNode;
}

export function WidgetCustomizer({ trigger }: WidgetCustomizerProps) {
  const { 
    availableWidgets, 
    isWidgetEnabled, 
    toggleWidget, 
    resetToDefaults,
    enabledWidgets
  } = useDashboardWidgets();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleReset = () => {
    resetToDefaults();
    toast({
      title: "Widgets Reset",
      description: "Dashboard widgets have been reset to role defaults",
    });
  };

  const handleToggle = (widgetId: string) => {
    toggleWidget(widgetId);
    const widget = AVAILABLE_WIDGETS.find(w => w.id === widgetId);
    const isNowEnabled = !isWidgetEnabled(widgetId);
    toast({
      title: isNowEnabled ? "Widget Added" : "Widget Removed",
      description: `${widget?.name} has been ${isNowEnabled ? 'added to' : 'removed from'} your dashboard`,
    });
  };

  const groupedWidgets = availableWidgets.reduce((acc, widget) => {
    if (!acc[widget.category]) {
      acc[widget.category] = [];
    }
    acc[widget.category].push(widget);
    return acc;
  }, {} as Record<string, WidgetConfig[]>);

  const categoryLabels: Record<string, string> = {
    metrics: 'Metrics & KPIs',
    activity: 'Activity & Tasks',
    tools: 'Tools & Features',
    communication: 'Communication'
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <Settings2 className="h-4 w-4" />
      Customize
    </Button>
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Customize Dashboard
          </SheetTitle>
          <SheetDescription>
            Enable or disable widgets to personalize your dashboard experience.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {enabledWidgets.length} widgets enabled
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to Defaults
            </Button>
          </div>

          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-6 pr-4">
              {Object.entries(groupedWidgets).map(([category, widgets]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${categoryColors[category]}`} />
                    <h3 className="font-medium text-sm">{categoryLabels[category]}</h3>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {widgets.filter(w => isWidgetEnabled(w.id)).length}/{widgets.length}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {widgets.map((widget) => {
                      const IconComponent = iconMap[widget.icon] || FileText;
                      const enabled = isWidgetEnabled(widget.id);

                      return (
                        <div
                          key={widget.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            enabled 
                              ? 'bg-primary/5 border-primary/20' 
                              : 'bg-muted/30 border-border hover:border-primary/30'
                          }`}
                        >
                          <div className={`p-2 rounded-md ${enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                            <IconComponent className={`h-4 w-4 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{widget.name}</span>
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] ${
                                  widget.size === 'large' ? 'bg-purple-500/10 text-purple-600' :
                                  widget.size === 'medium' ? 'bg-blue-500/10 text-blue-600' :
                                  'bg-gray-500/10 text-gray-600'
                                }`}
                              >
                                {widget.size}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {widget.description}
                            </p>
                          </div>

                          <Switch
                            checked={enabled}
                            onCheckedChange={() => handleToggle(widget.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
