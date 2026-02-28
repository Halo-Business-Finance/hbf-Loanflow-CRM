import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, Trash2, Edit, Copy, FileUp, FileText } from 'lucide-react';
import { toast } from 'sonner';

export interface MarketingTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  subject?: string;
  status: 'active' | 'draft' | 'archived';
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TemplateManagerProps {
  channel: 'email' | 'sms';
  templates: MarketingTemplate[];
  categories: string[];
  onCreateTemplate: (template: Omit<MarketingTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTemplate: (id: string, template: Partial<MarketingTemplate>) => void;
  onDeleteTemplate: (id: string) => void;
  onDuplicateTemplate: (template: MarketingTemplate) => void;
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-600',
  draft: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
};

export function TemplateManager({
  channel,
  templates,
  categories,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
}: TemplateManagerProps) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MarketingTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState(categories[0] || '');
  const [formSubject, setFormSubject] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'draft'>('draft');
  const [importText, setImportText] = useState('');

  const isEmail = channel === 'email';
  const maxContentLength = isEmail ? 50000 : 160;

  function resetForm() {
    setFormName('');
    setFormCategory(categories[0] || '');
    setFormSubject('');
    setFormContent('');
    setFormStatus('draft');
    setEditingTemplate(null);
  }

  function openEdit(t: MarketingTemplate) {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormCategory(t.category);
    setFormSubject(t.subject || '');
    setFormContent(t.content);
    setFormStatus(t.status === 'archived' ? 'draft' : t.status);
    setIsCreateOpen(true);
  }

  function handleSubmit() {
    if (!formName.trim() || !formContent.trim()) {
      toast.error('Name and content are required');
      return;
    }

    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, {
        name: formName,
        category: formCategory,
        subject: formSubject || undefined,
        content: formContent,
        status: formStatus,
      });
    } else {
      onCreateTemplate({
        name: formName,
        category: formCategory,
        subject: formSubject || undefined,
        content: formContent,
        status: formStatus,
      });
    }

    resetForm();
    setIsCreateOpen(false);
  }

  function handleImport() {
    if (!importText.trim()) {
      toast.error('Please paste template content to import');
      return;
    }

    // Try to parse as JSON array of templates
    try {
      const parsed = JSON.parse(importText);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      let count = 0;

      for (const item of items) {
        if (item.name && item.content) {
          onCreateTemplate({
            name: item.name,
            category: item.category || categories[0] || 'General',
            subject: item.subject,
            content: item.content,
            status: 'draft',
          });
          count++;
        }
      }

      toast.success(`Imported ${count} template(s)`);
      setImportText('');
      setIsImportOpen(false);
    } catch {
      // If not JSON, treat as a single template content
      onCreateTemplate({
        name: `Imported Template ${new Date().toLocaleDateString()}`,
        category: categories[0] || 'General',
        content: importText,
        status: 'draft',
      });
      toast.success('Template imported');
      setImportText('');
      setIsImportOpen(false);
    }
  }

  const filtered = templates.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          {/* Import Dialog */}
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-1.5">
                <FileUp className="h-4 w-4" /> Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import {isEmail ? 'Email' : 'SMS'} Templates</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Paste template content below. You can paste a single template or a JSON array of templates
                  with <code className="text-xs bg-muted px-1 rounded">name</code>, <code className="text-xs bg-muted px-1 rounded">content</code>,
                  and optionally <code className="text-xs bg-muted px-1 rounded">category</code>{isEmail ? ' and subject' : ''} fields.
                </p>
                <Textarea
                  placeholder={isEmail
                    ? '[\n  { "name": "Welcome Email", "subject": "Welcome!", "content": "<html>...</html>", "category": "Onboarding" }\n]'
                    : '[\n  { "name": "Follow-up", "content": "Hi {first_name}, just checking in...", "category": "Follow-up" }\n]'
                  }
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setImportText(''); setIsImportOpen(false); }}>Cancel</Button>
                <Button onClick={handleImport} disabled={!importText.trim()}>
                  <FileUp className="h-4 w-4 mr-2" /> Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Dialog */}
          <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" /> New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? 'Edit Template' : `Create ${isEmail ? 'Email' : 'SMS'} Template`}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Welcome Message" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formStatus} onValueChange={(v) => setFormStatus(v as 'active' | 'draft')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {isEmail && (
                  <div className="space-y-2">
                    <Label>Subject Line</Label>
                    <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Email subject" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{isEmail ? 'Email Body (HTML)' : 'Message'}</Label>
                  <Textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder={isEmail ? '<html>...</html>' : 'Hi {first_name}, ...'}
                    rows={isEmail ? 8 : 4}
                    maxLength={maxContentLength}
                    className={isEmail ? 'font-mono text-xs' : ''}
                  />
                  {!isEmail && (
                    <p className="text-xs text-muted-foreground">{formContent.length}/{maxContentLength} characters</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!formName.trim() || !formContent.trim()}>
                  {editingTemplate ? 'Save Changes' : 'Create Template'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Templates Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{t.name}</p>
                    {t.subject && (
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{t.subject}</p>
                    )}
                    {!isEmail && (
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{t.content}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{t.category}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusStyles[t.status]}>{t.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{t.usageCount}</TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(t)}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicateTemplate(t)}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDeleteTemplate(t.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No templates yet. Create one or import from JSON.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
