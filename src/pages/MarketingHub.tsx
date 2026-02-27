import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { MarketingAnalyticsDashboard } from '@/components/marketing/MarketingAnalyticsDashboard';

export default function MarketingHub() {
  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Marketing Hub"
        subtitle="Campaign analytics, lead sources, and conversion intelligence"
      />
      <div className="p-4 md:p-6 lg:p-8">
        <MarketingAnalyticsDashboard />
      </div>
    </div>
  );
}
