import React, { useState, useCallback } from 'react';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { TemplateManager, type MarketingTemplate } from '@/components/marketing/TemplateManager';
import { toast } from 'sonner';

const EMAIL_CATEGORIES = ['Onboarding', 'Follow-up', 'Promotional', 'Newsletter', 'Transactional', 'Re-engagement'];

const mockEmailTemplates: MarketingTemplate[] = [
  {
    id: '1',
    name: 'Welcome to HBF',
    category: 'Onboarding',
    subject: 'Welcome to Halo Business Finance!',
    content: '<h1>Welcome, {first_name}!</h1><p>We\'re excited to have you. Your loan officer will reach out shortly.</p>',
    status: 'active',
    usageCount: 124,
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-02-20T14:30:00Z',
  },
  {
    id: '2',
    name: 'Document Request',
    category: 'Transactional',
    subject: 'Action Required: Missing Documents',
    content: '<p>Hi {first_name},</p><p>We need the following documents to proceed with your application:</p><ul><li>Bank statements (last 3 months)</li><li>Tax returns</li></ul>',
    status: 'active',
    usageCount: 89,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-18T09:00:00Z',
  },
  {
    id: '3',
    name: 'Rate Drop Alert',
    category: 'Promotional',
    subject: 'Rates Just Dropped — Lock In Today!',
    content: '<h2>Great news!</h2><p>Interest rates have dropped. Contact us to refinance or start a new application.</p>',
    status: 'draft',
    usageCount: 0,
    createdAt: '2026-02-25T10:00:00Z',
    updatedAt: '2026-02-25T10:00:00Z',
  },
];

function generateId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<MarketingTemplate[]>(mockEmailTemplates);

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
        title="Email Templates"
        subtitle="Create, manage, and import reusable email templates for campaigns"
      />
      <div className="p-4 md:p-6 lg:p-8">
        <TemplateManager
          channel="email"
          templates={templates}
          categories={EMAIL_CATEGORIES}
          onCreateTemplate={handleCreate}
          onUpdateTemplate={handleUpdate}
          onDeleteTemplate={handleDelete}
          onDuplicateTemplate={handleDuplicate}
        />
      </div>
    </div>
  );
}
