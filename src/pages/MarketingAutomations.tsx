import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { DripSequenceAutomation } from '@/components/marketing/DripSequenceAutomation';

export default function MarketingAutomations() {
  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="Drip Sequence Automation"
        subtitle="Build automated lead nurturing workflows with triggers and actions"
      />
      <div className="p-4 md:p-6 lg:p-8">
        <DripSequenceAutomation />
      </div>
    </div>
  );
}
