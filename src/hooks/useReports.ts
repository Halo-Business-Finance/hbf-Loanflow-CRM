import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';

export interface SavedReport {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  report_type: string;
  data_source: string;
  selected_columns: string[];
  filters: ReportFilter[];
  sort_by: string | null;
  sort_order: string;
  group_by: string | null;
  chart_type: string | null;
  is_public: boolean;
  is_favorite: boolean;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'is_null' | 'is_not_null';
  value: any;
}

export interface ReportSchedule {
  id: string;
  report_id: string;
  user_id: string;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  timezone: string;
  delivery_method: 'email' | 'slack' | 'webhook';
  delivery_config: Record<string, any>;
  export_format: 'pdf' | 'csv' | 'xlsx';
  is_active: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  send_count: number;
}

export const DATA_SOURCES = {
  leads: {
    label: 'Leads',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid' },
      { key: 'created_at', label: 'Created Date', type: 'date' },
      { key: 'stage', label: 'Stage', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'text' },
      { key: 'loan_amount', label: 'Loan Amount', type: 'number' },
      { key: 'loan_type', label: 'Loan Type', type: 'text' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'assigned_at', label: 'Assigned Date', type: 'date' },
    ]
  },
  clients: {
    label: 'Clients',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid' },
      { key: 'created_at', label: 'Created Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'total_loans', label: 'Total Loans', type: 'number' },
      { key: 'total_loan_value', label: 'Total Loan Value', type: 'number' },
      { key: 'last_activity', label: 'Last Activity', type: 'date' },
    ]
  },
  contact_entities: {
    label: 'Contacts',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'business_name', label: 'Business Name', type: 'text' },
      { key: 'industry', label: 'Industry', type: 'text' },
      { key: 'loan_amount', label: 'Loan Amount', type: 'number' },
      { key: 'stage', label: 'Stage', type: 'text' },
      { key: 'created_at', label: 'Created Date', type: 'date' },
    ]
  },
  activities: {
    label: 'Activities',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid' },
      { key: 'activity_type', label: 'Type', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'text' },
      { key: 'due_date', label: 'Due Date', type: 'date' },
      { key: 'created_at', label: 'Created Date', type: 'date' },
    ]
  },
  lenders: {
    label: 'Lenders',
    columns: [
      { key: 'id', label: 'ID', type: 'uuid' },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'lender_type', label: 'Type', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'min_loan_amount', label: 'Min Loan', type: 'number' },
      { key: 'max_loan_amount', label: 'Max Loan', type: 'number' },
      { key: 'created_at', label: 'Created Date', type: 'date' },
    ]
  },
};

export function useReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_reports')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      const mapped = (data || []).map(r => ({
        ...r,
        selected_columns: Array.isArray(r.selected_columns) ? r.selected_columns as string[] : [],
        filters: Array.isArray(r.filters) ? r.filters as unknown as ReportFilter[] : [],
      })) as SavedReport[];
      
      setReports(mapped);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createReport = useCallback(async (report: Partial<SavedReport>) => {
    if (!user) return null;
    try {
      const insertData = {
        name: report.name || 'Untitled Report',
        description: report.description || null,
        data_source: report.data_source || 'leads',
        selected_columns: report.selected_columns || [],
        filters: (report.filters || []) as unknown,
        sort_by: report.sort_by || null,
        sort_order: report.sort_order || 'asc',
        group_by: report.group_by || null,
        chart_type: report.chart_type || null,
        is_public: report.is_public || false,
        user_id: user.id,
      };
      
      const { data, error } = await supabase
        .from('saved_reports')
        .insert([insertData] as any)
        .select()
        .single();

      if (error) throw error;
      toast.success('Report created successfully');
      await fetchReports();
      return data;
    } catch (error) {
      console.error('Error creating report:', error);
      toast.error('Failed to create report');
      return null;
    }
  }, [user, fetchReports]);

  const updateReport = useCallback(async (id: string, updates: Partial<SavedReport>) => {
    try {
      const dbUpdates: Record<string, unknown> = {
        ...updates,
        filters: updates.filters as unknown as Record<string, unknown>[] | undefined,
      };
      
      const { error } = await supabase
        .from('saved_reports')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
      toast.success('Report updated');
      await fetchReports();
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Failed to update report');
    }
  }, [fetchReports]);

  const deleteReport = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Report deleted');
      await fetchReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  }, [fetchReports]);

  const runReport = useCallback(async (report: SavedReport) => {
    if (!user) return null;
    const startTime = Date.now();
    
    try {
      // Build query based on report configuration
      let query = supabase.from(report.data_source as any).select(
        report.selected_columns.length > 0 
          ? report.selected_columns.join(',') 
          : '*'
      );

      // Apply filters
      for (const filter of report.filters) {
        switch (filter.operator) {
          case 'equals':
            query = query.eq(filter.field, filter.value);
            break;
          case 'contains':
            query = query.ilike(filter.field, `%${filter.value}%`);
            break;
          case 'greater_than':
            query = query.gt(filter.field, filter.value);
            break;
          case 'less_than':
            query = query.lt(filter.field, filter.value);
            break;
          case 'is_null':
            query = query.is(filter.field, null);
            break;
          case 'is_not_null':
            query = query.not(filter.field, 'is', null);
            break;
        }
      }

      // Apply sorting
      if (report.sort_by) {
        query = query.order(report.sort_by, { ascending: report.sort_order === 'asc' });
      }

      const { data, error } = await query;
      if (error) throw error;

      const executionTime = Date.now() - startTime;

      // Log execution
      await supabase.from('report_execution_logs').insert({
        report_id: report.id,
        user_id: user.id,
        execution_type: 'manual',
        status: 'completed',
        row_count: data?.length || 0,
        execution_time_ms: executionTime,
        completed_at: new Date().toISOString(),
      });

      // Update report stats
      await supabase
        .from('saved_reports')
        .update({ 
          last_run_at: new Date().toISOString(),
          run_count: (report.run_count || 0) + 1 
        })
        .eq('id', report.id);

      return data;
    } catch (error) {
      console.error('Error running report:', error);
      
      // Log failure
      await supabase.from('report_execution_logs').insert({
        report_id: report.id,
        user_id: user.id,
        execution_type: 'manual',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      });

      toast.error('Failed to run report');
      return null;
    }
  }, [user]);

  const toggleFavorite = useCallback(async (id: string, isFavorite: boolean) => {
    await updateReport(id, { is_favorite: !isFavorite });
  }, [updateReport]);

  return {
    reports,
    loading,
    fetchReports,
    createReport,
    updateReport,
    deleteReport,
    runReport,
    toggleFavorite,
  };
}
