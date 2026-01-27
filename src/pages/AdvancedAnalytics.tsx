import { AdvancedAnalytics as AdvancedAnalyticsComponent } from '@/components/analytics/AdvancedAnalytics';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';

export default function AdvancedAnalytics() {
  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Advanced Analytics"
        subtitle="Deep insights and predictive intelligence"
      />
      
      <div className="p-8">
        <AdvancedAnalyticsComponent />
      </div>
    </div>
  );
}
