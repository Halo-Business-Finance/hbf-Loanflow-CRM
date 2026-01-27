import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StandardPageLayout } from '@/components/StandardPageLayout';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, Search, Star, StarOff, MoreVertical, Edit, Trash2, Play, 
  Clock, Calendar, Share2, Download, BarChart3, FileText, Loader2,
  Mail, Bell
} from 'lucide-react';
import { useReports, SavedReport, DATA_SOURCES } from '@/hooks/useReports';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function AdvancedReports() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reports, loading, fetchReports, deleteReport, toggleFavorite, runReport } = useReports();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState({
    schedule_type: 'daily',
    day_of_week: 1,
    day_of_month: 1,
    time_of_day: '08:00',
    delivery_method: 'email',
    email_recipients: '',
    export_format: 'csv',
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'favorites') return matchesSearch && report.is_favorite;
    if (activeTab === 'shared') return matchesSearch && report.is_public;
    return matchesSearch;
  });

  const handleDelete = async () => {
    if (reportToDelete) {
      await deleteReport(reportToDelete);
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  const handleRun = async (report: SavedReport) => {
    const data = await runReport(report);
    if (data) {
      toast.success(`Report executed: ${data.length} rows returned`);
    }
  };

  const handleSchedule = (report: SavedReport) => {
    setSelectedReport(report);
    setScheduleDialogOpen(true);
  };

  const saveSchedule = async () => {
    if (!selectedReport || !user) return;
    
    setSavingSchedule(true);
    try {
      const { error } = await supabase.from('report_schedules').insert({
        report_id: selectedReport.id,
        user_id: user.id,
        schedule_type: scheduleConfig.schedule_type,
        day_of_week: scheduleConfig.schedule_type === 'weekly' ? scheduleConfig.day_of_week : null,
        day_of_month: scheduleConfig.schedule_type === 'monthly' ? scheduleConfig.day_of_month : null,
        time_of_day: scheduleConfig.time_of_day,
        delivery_method: scheduleConfig.delivery_method,
        delivery_config: { 
          recipients: scheduleConfig.email_recipients.split(',').map(e => e.trim()).filter(Boolean)
        },
        export_format: scheduleConfig.export_format,
        is_active: true,
      });

      if (error) throw error;
      toast.success('Schedule created successfully');
      setScheduleDialogOpen(false);
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast.error('Failed to create schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const getDataSourceLabel = (source: string) => {
    return DATA_SOURCES[source as keyof typeof DATA_SOURCES]?.label || source;
  };

  return (
    <StandardPageLayout>
      <IBMPageHeader
        title="Advanced Reports"
        subtitle="Build, schedule, and share custom reports"
        actions={
          <Button onClick={() => navigate('/report-builder')}>
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.length}</p>
                <p className="text-sm text-muted-foreground">Total Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.filter(r => r.is_favorite).length}</p>
                <p className="text-sm text-muted-foreground">Favorites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Share2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.filter(r => r.is_public).length}</p>
                <p className="text-sm text-muted-foreground">Shared</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Play className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.reduce((sum, r) => sum + (r.run_count || 0), 0)}</p>
                <p className="text-sm text-muted-foreground">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All Reports</TabsTrigger>
                <TabsTrigger value="favorites">Favorites</TabsTrigger>
                <TabsTrigger value="shared">Shared</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No reports found</p>
              <p className="text-sm">Create your first report to get started</p>
              <Button className="mt-4" onClick={() => navigate('/report-builder')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Report
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Data Source</TableHead>
                  <TableHead>Columns</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Runs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map(report => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => toggleFavorite(report.id, report.is_favorite)}
                      >
                        {report.is_favorite ? (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{report.name}</p>
                        {report.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {report.description}
                          </p>
                        )}
                        <div className="flex gap-1 mt-1">
                          {report.is_public && <Badge variant="secondary" className="text-xs">Shared</Badge>}
                          {report.chart_type && report.chart_type !== 'table' && (
                            <Badge variant="outline" className="text-xs capitalize">{report.chart_type}</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getDataSourceLabel(report.data_source)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{report.selected_columns.length} columns</span>
                    </TableCell>
                    <TableCell>
                      {report.last_run_at ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(report.last_run_at), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{report.run_count}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleRun(report)} title="Run Report">
                          <Play className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/report-builder/${report.id}`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSchedule(report)}>
                              <Clock className="h-4 w-4 mr-2" />
                              Schedule
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => { setReportToDelete(report.id); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Report"
        description="Are you sure you want to delete this report? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule Report Delivery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select 
                value={scheduleConfig.schedule_type} 
                onValueChange={v => setScheduleConfig(p => ({ ...p, schedule_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleConfig.schedule_type === 'weekly' && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select 
                  value={String(scheduleConfig.day_of_week)} 
                  onValueChange={v => setScheduleConfig(p => ({ ...p, day_of_week: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                      <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scheduleConfig.schedule_type === 'monthly' && (
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Select 
                  value={String(scheduleConfig.day_of_month)} 
                  onValueChange={v => setScheduleConfig(p => ({ ...p, day_of_month: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Time</Label>
              <Input 
                type="time" 
                value={scheduleConfig.time_of_day}
                onChange={e => setScheduleConfig(p => ({ ...p, time_of_day: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select 
                value={scheduleConfig.export_format} 
                onValueChange={v => setScheduleConfig(p => ({ ...p, export_format: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email Recipients</Label>
              <Input 
                placeholder="email1@example.com, email2@example.com"
                value={scheduleConfig.email_recipients}
                onChange={e => setScheduleConfig(p => ({ ...p, email_recipients: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSchedule} disabled={savingSchedule}>
              {savingSchedule ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StandardPageLayout>
  );
}
