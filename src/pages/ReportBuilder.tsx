import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StandardPageLayout } from '@/components/StandardPageLayout';
import { IBMPageHeader } from '@/components/ui/IBMPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Save, Play, ArrowLeft, Plus, X, BarChart3, LineChart, PieChart, 
  TableIcon, Download, Filter, SortAsc, SortDesc, Loader2 
} from 'lucide-react';
import { useReports, DATA_SOURCES, ReportFilter, SavedReport } from '@/hooks/useReports';
import { ibmDb } from '@/lib/ibm';
import { toast } from 'sonner';
import { BarChart, Bar, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'];

export default function ReportBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { createReport, updateReport, runReport, reports, fetchReports } = useReports();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dataSource, setDataSource] = useState<string>('leads');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [groupBy, setGroupBy] = useState<string>('');
  const [chartType, setChartType] = useState<string>('table');
  const [isPublic, setIsPublic] = useState(false);
  
  const [reportData, setReportData] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!id;

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (id && reports.length > 0) {
      const report = reports.find(r => r.id === id);
      if (report) {
        setName(report.name);
        setDescription(report.description || '');
        setDataSource(report.data_source);
        setSelectedColumns(report.selected_columns);
        setFilters(report.filters);
        setSortBy(report.sort_by || '');
        setSortOrder((report.sort_order as 'asc' | 'desc') || 'asc');
        setGroupBy(report.group_by || '');
        setChartType(report.chart_type || 'table');
        setIsPublic(report.is_public);
      }
    }
  }, [id, reports]);

  const availableColumns = DATA_SOURCES[dataSource as keyof typeof DATA_SOURCES]?.columns || [];

  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnKey)
        ? prev.filter(c => c !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleAddFilter = () => {
    setFilters(prev => [...prev, { field: availableColumns[0]?.key || '', operator: 'equals', value: '' }]);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  const handleFilterChange = (index: number, key: keyof ReportFilter, value: any) => {
    setFilters(prev => prev.map((f, i) => i === index ? { ...f, [key]: value } : f));
  };

  const handleRunReport = async () => {
    if (selectedColumns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    setIsRunning(true);
    try {
      const mockReport: SavedReport = {
        id: id || 'temp',
        user_id: '',
        name,
        description,
        report_type: 'custom',
        data_source: dataSource,
        selected_columns: selectedColumns,
        filters,
        sort_by: sortBy || null,
        sort_order: sortOrder,
        group_by: groupBy || null,
        chart_type: chartType,
        is_public: isPublic,
        is_favorite: false,
        last_run_at: null,
        run_count: 0,
        created_at: '',
        updated_at: '',
      };

      const data = await runReport(mockReport);
      if (data) {
        setReportData(data);
        toast.success(`Report returned ${data.length} rows`);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a report name');
      return;
    }
    if (selectedColumns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    setIsSaving(true);
    try {
      const reportData = {
        name,
        description: description || null,
        data_source: dataSource,
        selected_columns: selectedColumns,
        filters,
        sort_by: sortBy || null,
        sort_order: sortOrder,
        group_by: groupBy || null,
        chart_type: chartType,
        is_public: isPublic,
      };

      if (isEditing && id) {
        await updateReport(id, reportData);
      } else {
        await createReport(reportData);
      }
      navigate('/advanced-reports');
    } finally {
      setIsSaving(false);
    }
  };

  const exportToCSV = () => {
    if (reportData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = selectedColumns.join(',');
    const rows = reportData.map(row => 
      selectedColumns.map(col => {
        const value = row[col];
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value ?? '';
      }).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'report'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported to CSV');
  };

  const getChartData = () => {
    if (!groupBy || reportData.length === 0) return reportData.slice(0, 20);
    
    const grouped = reportData.reduce((acc, row) => {
      const key = row[groupBy] || 'Unknown';
      if (!acc[key]) acc[key] = { name: key, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(grouped);
  };

  const renderChart = () => {
    const data = getChartData();
    if (data.length === 0) return <p className="text-muted-foreground text-center py-8">No data to display</p>;

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis className="text-xs fill-muted-foreground" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsLineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis className="text-xs fill-muted-foreground" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
            </RechartsLineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis className="text-xs fill-muted-foreground" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.3)" />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsPieChart>
              <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={150} label>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectedColumns.map(col => (
                    <TableHead key={col}>{availableColumns.find(c => c.key === col)?.label || col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.slice(0, 100).map((row, i) => (
                  <TableRow key={i}>
                    {selectedColumns.map(col => (
                      <TableCell key={col}>{String(row[col] ?? '-')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {reportData.length > 100 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Showing first 100 of {reportData.length} rows
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <StandardPageLayout>
      <IBMPageHeader
        title={isEditing ? 'Edit Report' : 'Report Builder'}
        subtitle="Create custom reports with drag-and-drop simplicity"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/advanced-reports')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" onClick={exportToCSV} disabled={reportData.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handleRunReport} disabled={isRunning || selectedColumns.length === 0}>
              {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Run Report
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Report
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Report Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Custom Report" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="What does this report show?"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Source</Label>
                <Select value={dataSource} onValueChange={v => { setDataSource(v); setSelectedColumns([]); setFilters([]); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DATA_SOURCES).map(([key, source]) => (
                      <SelectItem key={key} value={key}>{source.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="public" checked={isPublic} onCheckedChange={c => setIsPublic(!!c)} />
                <Label htmlFor="public" className="text-sm">Share with team</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Columns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {availableColumns.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Checkbox 
                      id={col.key} 
                      checked={selectedColumns.includes(col.key)}
                      onCheckedChange={() => handleColumnToggle(col.key)}
                    />
                    <Label htmlFor={col.key} className="text-sm cursor-pointer flex-1">{col.label}</Label>
                    <Badge variant="outline" className="text-xs">{col.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Filters</CardTitle>
              <Button size="sm" variant="outline" onClick={handleAddFilter}>
                <Plus className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {filters.map((filter, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Select value={filter.field} onValueChange={v => handleFilterChange(index, 'field', v)}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map(col => (
                        <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filter.operator} onValueChange={v => handleFilterChange(index, 'operator', v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">=</SelectItem>
                      <SelectItem value="contains">contains</SelectItem>
                      <SelectItem value="greater_than">&gt;</SelectItem>
                      <SelectItem value="less_than">&lt;</SelectItem>
                      <SelectItem value="is_null">is null</SelectItem>
                      <SelectItem value="is_not_null">not null</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    value={filter.value} 
                    onChange={e => handleFilterChange(index, 'value', e.target.value)}
                    className="flex-1"
                    placeholder="Value"
                  />
                  <Button size="icon" variant="ghost" onClick={() => handleRemoveFilter(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {filters.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">No filters applied</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sort & Group</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {availableColumns.map(col => (
                        <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Group By</Label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {availableColumns.filter(c => c.type === 'text').map(col => (
                      <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { type: 'table', icon: TableIcon, label: 'Table' },
                  { type: 'bar', icon: BarChart3, label: 'Bar' },
                  { type: 'line', icon: LineChart, label: 'Line' },
                  { type: 'area', icon: BarChart3, label: 'Area' },
                  { type: 'pie', icon: PieChart, label: 'Pie' },
                ].map(({ type, icon: Icon, label }) => (
                  <Button
                    key={type}
                    variant={chartType === type ? 'default' : 'outline'}
                    size="sm"
                    className="flex-col h-16 gap-1"
                    onClick={() => setChartType(type)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Report Preview
              {reportData.length > 0 && (
                <Badge variant="secondary">{reportData.length} rows</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                <p>Run the report to see results</p>
                <p className="text-sm">Select columns and click "Run Report"</p>
              </div>
            ) : (
              renderChart()
            )}
          </CardContent>
        </Card>
      </div>
    </StandardPageLayout>
  );
}
