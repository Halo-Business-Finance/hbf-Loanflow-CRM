import React, { useState, useCallback } from 'react';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { TemplateManager, type MarketingTemplate } from '@/components/marketing/TemplateManager';
import { toast } from 'sonner';

const SMS_CATEGORIES = ['Follow-up', 'Promotional', 'Reminder', 'Notification', 'Onboarding', 'Re-engagement'];

const mockSmsTemplates: MarketingTemplate[] = [
  {
    id: '1',
    name: 'Application Received',
    category: 'Notification',
    content: 'Hi {first_name}, your loan application has been received! We\'ll review it within 24 hours. Reply HELP for assistance.',
    status: 'active',
    usageCount: 256,
    createdAt: '2026-01-05T10:00:00Z',
    updatedAt: '2026-02-22T11:00:00Z',
  },
  {
    id: '2',
    name: 'Document Reminder',
    category: 'Reminder',
    content: 'Hi {first_name}, we still need your documents to move forward with your loan. Please upload them at your earliest convenience.',
    status: 'active',
    usageCount: 143,
    createdAt: '2026-01-12T10:00:00Z',
    updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: '3',
    name: 'Rate Alert',
    category: 'Promotional',
    content: 'Great news! Rates just dropped. Reply YES to learn about refinancing options or call us at (555) 123-4567.',
    status: 'draft',
    usageCount: 0,
    createdAt: '2026-02-26T10:00:00Z',
    updatedAt: '2026-02-26T10:00:00Z',
  },
];

function generateId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function SMSTemplates() {
  const [templates, setTemplates] = useState<MarketingTemplate[]>(mockSmsTemplates);

  const handleCreate = useCallback((template: Omit<MarketingTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    setTemplates((prev) => [
      { ...template, id: generateId(), usageCount: 0, createdAt: now, updatedAt: now },
      ...prev,
    ]);
    toast.success(`Template "${template.name}" created`);
  }, []);

  const handleUpdate = useCallback((id: string, updates: Partial<MarketingTemplate>) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
    );
    toast.success('Template updated');
  }, []);

  const handleDelete = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success('Template deleted');
  }, []);

  const handleDuplicate = useCallback((template: MarketingTemplate) => {
    const now = new Date().toISOString();
    setTemplates((prev) => [
      { ...template, id: generateId(), name: `${template.name} (Copy)`, status: 'draft', usageCount: 0, createdAt: now, updatedAt: now },
      ...prev,
    ]);
    toast.success('Template duplicated');
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <IBMPageHeader
        title="SMS Templates"
        subtitle="Create, manage, and import reusable SMS templates for campaigns"
      />
      <div className="p-4 md:p-6 lg:p-8">
        <TemplateManager
          channel="sms"
          templates={templates}
          categories={SMS_CATEGORIES}
          onCreateTemplate={handleCreate}
          onUpdateTemplate={handleUpdate}
          onDeleteTemplate={handleDelete}
          onDuplicateTemplate={handleDuplicate}
        />
      </div>
    </div>
  );
}
