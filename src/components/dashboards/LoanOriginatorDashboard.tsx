import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { CompactMessagesWidget } from '@/components/CompactMessagesWidget';
import { CompactCalendarWidget } from '@/components/CompactCalendarWidget';
import { TodaysScheduleWidget } from '@/components/widgets/TodaysScheduleWidget';
import { ActiveLeadsWidget } from '@/components/widgets/ActiveLeadsWidget';
import { QuoteGenerator } from '@/components/originator/QuoteGenerator';
import { CommissionCalculator } from '@/components/originator/CommissionCalculator';
import { WidgetCustomizer } from '@/components/dashboard/WidgetCustomizer';
import { 
  Calculator,
  DollarSign,
  Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export const LoanOriginatorDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Loan Originator Dashboard"
        subtitle="Generate leads, quotes, and track commissions"
        actions={
          <div className="flex items-center gap-2">
            <WidgetCustomizer 
              trigger={
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Settings2 className="h-4 w-4" />
                  Customize
                </Button>
              }
            />
            <Button 
              variant="primary"
              size="sm" 
              onClick={handleRefresh}
              className="h-9 px-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        }
      />

      <div className="p-8 space-y-6" key={refreshKey}>
        {/* Top Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CompactMessagesWidget />
          <TodaysScheduleWidget />
          <CompactCalendarWidget />
        </div>

        {/* Active Leads Widget */}
        <ActiveLeadsWidget />

        {/* Main Content Tabs */}
        <Tabs defaultValue="quote-generator" className="space-y-4">
          <TabsList className="bg-transparent p-0 gap-2 inline-flex w-auto h-auto">
            <TabsTrigger value="quote-generator" className="data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white bg-[#0f62fe] text-white hover:bg-[#0353e9] rounded-md flex items-center gap-2 px-4 py-2 h-9 text-sm font-medium transition-colors duration-200">
              <Calculator className="w-4 h-4" />
              Quote Generator
            </TabsTrigger>
            <TabsTrigger value="commissions" className="data-[state=active]:bg-[#0f62fe] data-[state=active]:text-white bg-[#0f62fe] text-white hover:bg-[#0353e9] rounded-md flex items-center gap-2 px-4 py-2 h-9 text-sm font-medium transition-colors duration-200">
              <DollarSign className="w-4 h-4" />
              Commissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quote-generator" className="space-y-4">
            <QuoteGenerator />
          </TabsContent>

          <TabsContent value="commissions" className="space-y-4">
            <CommissionCalculator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
