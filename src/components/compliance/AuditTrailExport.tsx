import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  FileText, 
  Download, 
  Calendar as CalendarIcon,
  Filter,
  Shield,
  Clock,
  User,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ibmDb } from '@/lib/ibm';

interface AuditFilter {
  startDate: Date | undefined;
  endDate: Date | undefined;
  actionTypes: string[];
  tables: string[];
  userId: string;
}

const ACTION_TYPES = [
  'INSERT',
  'UPDATE', 
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'VIEW',
  'EXPORT',
  'APPROVE',
  'REJECT'
];

const AUDITED_TABLES = [
  'leads',
  'contact_entities',
  'lead_documents',
  'clients',
  'profiles',
  'email_accounts',
  'active_sessions'
];

export function AuditTrailExport() {
  const [filters, setFilters] = useState<AuditFilter>({
    startDate: undefined,
    endDate: undefined,
    actionTypes: [],
    tables: [],
    userId: ''
  });
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const toggleActionType = (action: string) => {
    setFilters(prev => ({
      ...prev,
      actionTypes: prev.actionTypes.includes(action)
        ? prev.actionTypes.filter(a => a !== action)
        : [...prev.actionTypes, action]
    }));
  };

  const toggleTable = (table: string) => {
    setFilters(prev => ({
      ...prev,
      tables: prev.tables.includes(table)
        ? prev.tables.filter(t => t !== table)
        : [...prev.tables, table]
    }));
  };

  const fetchPreview = async () => {
    setLoading(true);
    try {
      let query = ibmDb
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }
      if (filters.actionTypes.length > 0) {
        query = query.in('action', filters.actionTypes);
      }
      if (filters.tables.length > 0) {
        query = query.in('table_name', filters.tables);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPreviewData((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    if (previewData.length === 0) {
      toast.error('No data to export. Run preview first.');
      return;
    }

    const sanitizedData = previewData.map(log => ({
      id: log.id,
      timestamp: log.created_at,
      action: log.action,
      table_name: log.table_name,
      record_id: log.record_id,
      user_id: log.user_id,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      old_values: JSON.stringify(log.old_values),
      new_values: JSON.stringify(log.new_values),
      risk_score: log.risk_score
    }));

    let content: string;
    let filename: string;
    let mimeType: string;

    if (exportFormat === 'csv') {
      const headers = Object.keys(sanitizedData[0]).join(',');
      const rows = sanitizedData.map(row => 
        Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      );
      content = [headers, ...rows].join('\n');
      filename = `audit_trail_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(sanitizedData, null, 2);
      filename = `audit_trail_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${sanitizedData.length} audit records`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Audit Trail Export</CardTitle>
        </div>
        <CardDescription>
          Export comprehensive audit logs for regulatory compliance and internal review
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Filters */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Export Filters
            </h4>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {filters.startDate ? format(filters.startDate, 'PP') : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.startDate}
                      onSelect={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {filters.endDate ? format(filters.endDate, 'PP') : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Action Types */}
            <div className="space-y-2">
              <Label>Action Types</Label>
              <div className="flex flex-wrap gap-2">
                {ACTION_TYPES.map(action => (
                  <Badge
                    key={action}
                    variant={filters.actionTypes.includes(action) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleActionType(action)}
                  >
                    {action}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Tables */}
            <div className="space-y-2">
              <Label>Tables</Label>
              <div className="flex flex-wrap gap-2">
                {AUDITED_TABLES.map(table => (
                  <Badge
                    key={table}
                    variant={filters.tables.includes(table) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleTable(table)}
                  >
                    {table}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Export Format */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                  <SelectItem value="json">JSON (Technical)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={fetchPreview} disabled={loading} className="flex-1">
                Preview Results
              </Button>
              <Button onClick={exportData} disabled={previewData.length === 0} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Preview ({previewData.length} records)
            </h4>
            <ScrollArea className="h-[350px] border rounded-lg">
              {previewData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <Database className="h-12 w-12 mb-4 opacity-50" />
                  <p>Click "Preview Results" to load audit data</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {previewData.map((log) => (
                    <div key={log.id} className="p-2 border rounded text-xs bg-card">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline">{log.action}</Badge>
                        <span className="text-muted-foreground">
                          {format(new Date(log.created_at), 'PP p')}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        Table: {log.table_name} | Record: {log.record_id?.slice(0, 8)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
