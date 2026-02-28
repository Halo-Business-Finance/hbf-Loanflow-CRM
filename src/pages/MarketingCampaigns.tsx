import { useNavigate } from 'react-router-dom';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { EmailCampaignsManager } from '@/components/marketing/EmailCampaignsManager';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function MarketingCampaigns() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Email Campaigns"
        subtitle="Create, manage, and track email marketing campaigns"
      />
      <div className="p-4 md:p-6 lg:p-8 space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate('/marketing/email-templates')} className="gap-1.5">
            <FileText className="h-4 w-4" /> Templates
          </Button>
        </div>
        <EmailCampaignsManager />
      </div>
    </div>
  );
}
