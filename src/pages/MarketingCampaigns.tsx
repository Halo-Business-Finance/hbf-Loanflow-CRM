import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { EmailCampaignsManager } from '@/components/marketing/EmailCampaignsManager';

export default function MarketingCampaigns() {
  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Email Campaigns"
        subtitle="Create, manage, and track email marketing campaigns"
      />
      <div className="p-4 md:p-6 lg:p-8">
        <EmailCampaignsManager />
      </div>
    </div>
  );
}
