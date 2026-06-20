import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/db/supabase';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Legend, Tooltip, CartesianGrid,
} from 'recharts';
import { Download, TrendingUp, FileText, Calendar, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { generateAnalyticsReport, downloadWorkbook } from '@/lib/excel-report';

interface DepartmentStats {
  department: string;
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}
interface LeaveTypeStats {
  leave_type: string;
  count: number;
  percentage: number;
}

// Opulent chart palette - gold + rich jewel tones
const CHART_COLORS = {
  gold: '#D4AF37',
  emerald: '#2ECC71',
  ruby: '#E74C3C',
  sapphire: '#3498DB',
  amethyst: '#9B59B6',
  amber: '#F39C12',
};
const PIE_COLORS = [CHART_COLORS.gold, CHART_COLORS.emerald, CHART_COLORS.sapphire, CHART_COLORS.amethyst, CHART_COLORS.amber, CHART_COLORS.ruby];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        {label && <p className="mb-1 text-xs font-semibold text-primary">{label}</p>}
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: entry.color || entry.fill }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const renderCustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-3">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0 });
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [leaveTypeStats, setLeaveTypeStats] = useState<LeaveTypeStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics(selectedYear);
    const channel = supabase
      .channel('analytics-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_applications' }, () => {
        fetchAnalytics(selectedYear);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedYear]);

  const fetchAnalytics = async (year: number) => {
    try {
      setLoading(true);
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      // Fetch all apps for the selected year
      const { data: allData } = await supabase
        .from('leave_applications')
        .select('status, leave_type:leave_types(name), staff:profiles!leave_applications_staff_id_fkey(department:departments(name))')
        .gte('start_date', yearStart)
        .lte('start_date', yearEnd);

      if (allData) {
        // Overall stats
        setStats({
          total: allData.length,
          approved: allData.filter((a: any) => a.status === 'approved').length,
          rejected: allData.filter((a: any) => a.status === 'rejected').length,
          pending: allData.filter((a: any) => a.status === 'pending').length,
        });

        // Department breakdown
        const deptMap = new Map<string, DepartmentStats>();
        allData.forEach((app: any) => {
          const deptName = app.staff?.department?.name || 'No Department';
          if (!deptMap.has(deptName)) {
            deptMap.set(deptName, { department: deptName, total: 0, approved: 0, rejected: 0, pending: 0 });
          }
          const dept = deptMap.get(deptName)!;
          dept.total++;
          if (app.status === 'approved') dept.approved++;
          else if (app.status === 'rejected') dept.rejected++;
          else dept.pending++;
        });
        setDepartmentStats(Array.from(deptMap.values()));

        // Leave type breakdown
        const typeMap = new Map<string, number>();
        allData.forEach((app: any) => {
          const typeName = app.leave_type?.name || 'Unknown';
          typeMap.set(typeName, (typeMap.get(typeName) || 0) + 1);
        });
        const total = allData.length;
        setLeaveTypeStats(
          Array.from(typeMap.entries()).map(([leave_type, count]) => ({
            leave_type,
            count,
            percentage: total > 0 ? Math.round((count / total) * 100) : 0,
          }))
        );
      }
    } catch (err) {
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Single-ring donut for status overview
  const statusDonutData = [
    { name: 'Approved', value: stats.approved, fill: CHART_COLORS.emerald },
    { name: 'Pending', value: stats.pending, fill: CHART_COLORS.gold },
    { name: 'Rejected', value: stats.rejected, fill: CHART_COLORS.ruby },
  ].filter(d => d.value > 0);

  const leaveTypePieData = leaveTypeStats.map((item, index) => ({
    name: item.leave_type,
    value: item.count,
    fill: PIE_COLORS[index % PIE_COLORS.length],
  }));

  const downloadAnalytics = () => {
    const deptRows = departmentStats.map(d => ({
      department: d.department,
      total: d.total,
      approved: d.approved,
      rejected: d.rejected,
      pending: d.pending,
      approval_pct: d.total > 0 ? parseFloat(((d.approved / d.total) * 100).toFixed(1)) : 0,
    }));
    const ltRows = leaveTypeStats.map(t => ({
      leave_type: t.leave_type,
      count: t.count,
      percentage: t.percentage,
    }));
    const wb = generateAnalyticsReport(
      { total: stats.total, approved: stats.approved, rejected: stats.rejected, pending: stats.pending },
      deptRows,
      ltRows,
      selectedYear,
    );
    downloadWorkbook(wb, `analytics_${selectedYear}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToExcel = downloadAnalytics;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">Analytics Dashboard</h1>
            <p className="mt-2 text-muted-foreground">Comprehensive leave statistics and insights</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Year selector */}
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadAnalytics}>
                  <FileText className="mr-2 h-4 w-4" />
                  Download as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Download as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total Applications', value: stats.total, icon: FileText, color: 'text-primary' },
            { label: 'Approved', value: stats.approved, icon: TrendingUp, color: 'text-emerald-500' },
            { label: 'Pending', value: stats.pending, icon: Calendar, color: 'text-amber-500' },
            { label: 'Rejected', value: stats.rejected, icon: Users, color: 'text-red-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="relative overflow-hidden">
              <div className="absolute right-0 top-0 h-16 w-16 translate-x-4 -translate-y-4 rounded-full bg-primary/5" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${color}`}>{value}</div>
                {stats.total > 0 && label !== 'Total Applications' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {((value / stats.total) * 100).toFixed(1)}% of total
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Row: Status donut (1/3) + Leave Type donut (1/3) + small stats (1/3) */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Status Overview — single-ring donut */}
          <Card>
            <CardHeader>
              <CardTitle className="font-playfair-display">Application Status</CardTitle>
              <CardDescription>Distribution by status — {selectedYear}</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.total === 0 ? (
                <div className="flex h-56 items-center justify-center text-muted-foreground text-sm">{loading ? 'Loading…' : 'No data yet'}</div>
              ) : (
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={statusDonutData}
                        cx="50%"
                        cy="45%"
                        outerRadius={80}
                        innerRadius={48}
                        dataKey="value"
                        paddingAngle={3}
                      >
                        {statusDonutData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend content={renderCustomLegend} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leave Type Donut */}
          <Card>
            <CardHeader>
              <CardTitle className="font-playfair-display">Leave Type Distribution</CardTitle>
              <CardDescription>Applications by leave category</CardDescription>
            </CardHeader>
            <CardContent>
              {leaveTypePieData.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-muted-foreground text-sm">{loading ? 'Loading…' : 'No data yet'}</div>
              ) : (
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={leaveTypePieData} cx="50%" cy="45%" outerRadius={80} innerRadius={48} dataKey="value" paddingAngle={3}>
                        {leaveTypePieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend content={renderCustomLegend} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="font-playfair-display">Quick Summary</CardTitle>
              <CardDescription>{selectedYear} at a glance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {[
                { label: 'Total Applications', value: stats.total, color: 'text-primary' },
                { label: 'Approved', value: stats.approved, color: 'text-emerald-500', pct: stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : '0' },
                { label: 'Pending', value: stats.pending, color: 'text-amber-500', pct: stats.total > 0 ? ((stats.pending / stats.total) * 100).toFixed(1) : '0' },
                { label: 'Rejected', value: stats.rejected, color: 'text-red-500', pct: stats.total > 0 ? ((stats.rejected / stats.total) * 100).toFixed(1) : '0' },
              ].map(({ label, value, color, pct }) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-lg ${color}`}>{value}</span>
                    {pct !== undefined && <span className="text-xs text-muted-foreground">({pct}%)</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Department Bar — full width */}
        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">Department-wise Applications</CardTitle>
            <div className="flex flex-wrap gap-4 pt-1">
              {[
                { label: 'Approved', color: CHART_COLORS.emerald },
                { label: 'Rejected', color: CHART_COLORS.ruby },
                { label: 'Pending', color: CHART_COLORS.gold },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {departmentStats.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-muted-foreground">{loading ? 'Loading…' : 'No data yet'}</div>
            ) : (
              <div className="w-full min-w-0 overflow-x-auto">
                <div style={{ minWidth: Math.max(500, departmentStats.length * 130) }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      data={departmentStats}
                      margin={{ top: 4, right: 8, left: -16, bottom: 52 }}
                      barCategoryGap="22%"
                      barGap={3}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="department"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="approved" name="Approved" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rejected" name="Rejected" fill={CHART_COLORS.ruby} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" name="Pending" fill={CHART_COLORS.gold} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">Department Statistics</CardTitle>
            <CardDescription>Detailed breakdown by department — {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="border-b border-border">
                    <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-medium">Department</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">Total</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-emerald-500">Approved</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-red-500">Rejected</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-amber-500">Pending</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">Approval %</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentStats.map((dept, i) => (
                    <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">{dept.department}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold">{dept.total}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-emerald-500">{dept.approved}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-red-500">{dept.rejected}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-amber-500">{dept.pending}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <span className="font-semibold text-primary">{dept.total > 0 ? ((dept.approved / dept.total) * 100).toFixed(1) : 0}%</span>
                      </td>
                    </tr>
                  ))}
                  {departmentStats.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">{loading ? 'Loading…' : 'No data yet'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
