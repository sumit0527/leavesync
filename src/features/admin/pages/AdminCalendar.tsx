import { useState, useCallback } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { useHolidays } from '@/hooks/use-holidays';
import { supabase } from '@/db/supabase';
import { format, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Users, Sun, Plus, Trash2, Loader2, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import { downloadTablePdf } from '@/lib/pdf-report';

interface LeavesOnDate {
  staffName: string;
  department: string;
  leaveType: string;
}

type DirectorReportScope = 'staff' | 'principal';
type DirectorReportFormat = 'pdf' | 'excel';

interface DirectorReportRow {
  name: string;
  department: string;
  email: string;
  phone: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  duration: string;
  status: string;
  handledBy: string;
  createdDate: string;
  leaveBalance: string;
}

const formatLeaveDuration = (app: any) => {
  if (app?.leave_duration === 'half_day') {
    return app?.half_day_period === 'second_half' ? 'Half Day — Second Half' : 'Half Day — First Half';
  }
  return 'Full Day';
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return 'N/A';
  return format(new Date(`${value}T00:00:00`), 'dd/MM/yyyy');
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  return format(new Date(value), 'dd/MM/yyyy HH:mm');
};

const clean = (value: unknown) => (value === null || value === undefined || value === '' ? 'N/A' : String(value));

export default function AdminCalendar() {
  const { isViewer, isPrincipal, isMainAdmin } = useAuth();
  const isCalendarReadOnly = isViewer || isPrincipal;
  const canDownloadDirectorReports = isMainAdmin || isViewer;
  const { applications } = useLeaveApplications();
  const { holidays, refetch: refetchHolidays } = useHolidays();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayLeaves, setSelectedDayLeaves] = useState<LeavesOnDate[]>([]);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [deletingHolidayId, setDeletingHolidayId] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState<string | null>(null);

  const approvedLeaves = applications.filter(app => app.status === 'approved');

  const isLeaveDate = useCallback((date: Date): boolean => {
    return approvedLeaves.some(app => {
      const start = new Date(app.start_date + 'T00:00:00');
      const end = new Date(app.end_date + 'T00:00:00');
      const d = new Date(format(date, 'yyyy-MM-dd') + 'T00:00:00');
      return d >= start && d <= end;
    });
  }, [approvedLeaves]);

  const isHolidayDate = useCallback((date: Date): boolean => {
    const ds = format(date, 'yyyy-MM-dd');
    return holidays.some(h => h.date === ds);
  }, [holidays]);

  const getHoliday = (date: Date) => {
    const ds = format(date, 'yyyy-MM-dd');
    return holidays.find(h => h.date === ds) ?? null;
  };

  const getHolidayName = (date: Date): string | null => getHoliday(date)?.name ?? null;

  const getLeavesOnDate = (date: Date): LeavesOnDate[] => {
    const ds = format(date, 'yyyy-MM-dd');
    return approvedLeaves
      .filter(app => ds >= app.start_date && ds <= app.end_date)
      .map(app => ({
        staffName: app.staff?.full_name ?? 'Unknown',
        department: (app.staff as any)?.department?.name ?? 'N/A',
        leaveType: app.leave_type?.name ?? 'Leave',
      }));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setHolidayDate(format(date, 'yyyy-MM-dd'));
    setSelectedDayLeaves(getLeavesOnDate(date));
  };

  const buildBalanceMap = (allocations: any[]) => {
    const map = new Map<string, string>();
    allocations.forEach(a => {
      const name = a.leave_type?.name ?? 'Leave';
      const total = Number(a.total_allocated ?? 0);
      const used = Number(a.used ?? 0);
      const remaining = Number(a.remaining ?? (total - used));
      const current = map.get(a.staff_id);
      const part = `${name}: Total ${total}, Used ${used}, Left ${remaining}`;
      map.set(a.staff_id, current ? `${current}; ${part}` : part);
    });
    return map;
  };

  const getDirectorReportRows = async (scope: DirectorReportScope): Promise<DirectorReportRow[]> => {
    const roles = scope === 'staff' ? ['staff'] : ['principal', 'admin'];
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*, department:departments(*)')
      .in('role', roles)
      .order('full_name', { ascending: true });

    if (profileError) throw profileError;

    const people = Array.isArray(profiles) ? profiles : [];
    const ids = people.map((p: any) => p.id).filter(Boolean);
    if (ids.length === 0) return [];

    const { data: leaveRows, error: leaveError } = await supabase
      .from('leave_applications')
      .select(`
        *,
        staff:profiles!leave_applications_staff_id_fkey(*, department:departments(*)),
        reviewer:profiles!leave_applications_reviewed_by_fkey(id, username, full_name),
        leave_type:leave_types(*)
      `)
      .in('staff_id', ids)
      .order('created_at', { ascending: false });

    if (leaveError) throw leaveError;

    const { data: allocationRows, error: allocationError } = await supabase
      .from('staff_leave_allocations')
      .select('*, leave_type:leave_types(id, name)')
      .in('staff_id', ids)
      .eq('year', new Date().getFullYear());

    if (allocationError) throw allocationError;

    const balanceMap = buildBalanceMap(Array.isArray(allocationRows) ? allocationRows : []);
    const appsByStaff = new Map<string, any[]>();
    (Array.isArray(leaveRows) ? leaveRows : []).forEach((app: any) => {
      const list = appsByStaff.get(app.staff_id) ?? [];
      list.push(app);
      appsByStaff.set(app.staff_id, list);
    });

    return people.flatMap((person: any) => {
      const personApps = appsByStaff.get(person.id) ?? [];
      const baseBalance = balanceMap.get(person.id) ?? `Overall Balance: ${person.leave_balance ?? 'N/A'}`;
      if (personApps.length === 0) {
        return [{
          name: clean(person.full_name),
          department: scope === 'staff' ? clean(person.department?.name) : 'N/A',
          email: clean(person.email),
          phone: clean(person.phone),
          leaveType: 'No leave applications',
          startDate: 'N/A',
          endDate: 'N/A',
          duration: 'N/A',
          status: clean(person.approval_status),
          handledBy: 'N/A',
          createdDate: formatDateTime(person.created_at),
          leaveBalance: baseBalance,
        }];
      }

      return personApps.map((app: any) => ({
        name: clean(person.full_name),
        department: scope === 'staff' ? clean(person.department?.name ?? app.staff?.department?.name) : 'N/A',
        email: clean(person.email),
        phone: clean(person.phone),
        leaveType: clean(app.leave_type?.name),
        startDate: formatDateOnly(app.start_date),
        endDate: formatDateOnly(app.end_date),
        duration: `${formatLeaveDuration(app)} (${app.leave_days ?? 0} day${Number(app.leave_days ?? 0) === 1 ? '' : 's'})`,
        status: clean(app.status),
        handledBy: app.reviewer?.full_name ? clean(app.reviewer.full_name) : app.status === 'pending' ? 'Pending Review' : 'N/A',
        createdDate: formatDateTime(app.created_at),
        leaveBalance: baseBalance,
      }));
    });
  };

  const exportDirectorReportExcel = (rows: DirectorReportRow[], scope: DirectorReportScope) => {
    const title = scope === 'staff' ? 'Staff Details and Leave Activity Report' : 'Principal Details and Leave Activity Report';
    const aoa = [
      ['LeaveSync', title],
      ['Generated At', format(new Date(), 'dd/MM/yyyy HH:mm')],
      [],
      ['Name', 'Department', 'Email', 'Phone', 'Leave Type', 'Start Date', 'End Date', 'Full/Half Day', 'Status', 'Approved/Rejected By', 'Created Date', 'Leave Balance'],
      ...rows.map(r => [r.name, r.department, r.email, r.phone, r.leaveType, r.startDate, r.endDate, r.duration, r.status, r.handledBy, r.createdDate, r.leaveBalance]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!autofilter'] = { ref: 'A4:L4' };
    ws['!cols'] = [
      { wch: 24 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
      { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 48 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, scope === 'staff' ? 'Staff Report' : 'Principal Report');
    XLSX.writeFile(wb, `${scope}_details_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportDirectorReportPDF = (rows: DirectorReportRow[], scope: DirectorReportScope) => {
    const title = scope === 'staff' ? 'Staff Details and Leave Activity Report' : 'Principal Details and Leave Activity Report';
    downloadTablePdf({
      title,
      subtitle: scope === 'staff' ? 'Staff records with leave activity' : 'Principal records with leave activity',
      headers: ['Name', 'Department', 'Email', 'Phone', 'Leave Type', 'Start Date', 'End Date', 'Full/Half Day', 'Status', 'Approved/Rejected By', 'Created Date', 'Leave Balance'],
      rows: rows.map((r) => [
        r.name,
        r.department,
        r.email,
        r.phone,
        r.leaveType,
        r.startDate,
        r.endDate,
        r.duration,
        r.status,
        r.handledBy,
        r.createdDate,
        r.leaveBalance,
      ]),
      filename: `${scope}_details_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`,
      orientation: 'landscape',
    });
  };

  const handleDirectorReportDownload = async (scope: DirectorReportScope, fileFormat: DirectorReportFormat) => {
    if (!canDownloadDirectorReports) {
      toast.error('Only Director or Viewer can download these reports');
      return;
    }
    const loadingKey = `${scope}-${fileFormat}`;
    setReportLoading(loadingKey);
    try {
      const rows = await getDirectorReportRows(scope);
      if (fileFormat === 'excel') exportDirectorReportExcel(rows, scope);
      else exportDirectorReportPDF(rows, scope);
      toast.success(`${scope === 'staff' ? 'Staff' : 'Principal'} report downloaded`);
    } catch (err) {
      console.error('Director report download failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to download report');
    } finally {
      setReportLoading(null);
    }
  };

  const handleAddHoliday = async () => {
    if (isCalendarReadOnly) {
      toast.error('Only Director can add or update holidays');
      return;
    }
    if (!holidayDate) {
      toast.error('Please select holiday date');
      return;
    }
    if (!holidayName.trim()) {
      toast.error('Please enter holiday name');
      return;
    }

    setSavingHoliday(true);
    try {
      const { error } = await supabase
        .from('holidays')
        .upsert({ date: holidayDate, name: holidayName.trim() }, { onConflict: 'date' });

      if (error) throw error;
      toast.success('Holiday saved successfully');
      setHolidayName('');
      await refetchHolidays();
      const newSelectedDate = new Date(`${holidayDate}T00:00:00`);
      setSelectedDate(newSelectedDate);
      setSelectedDayLeaves(getLeavesOnDate(newSelectedDate));
    } catch (err) {
      console.error('Failed to save holiday:', err);
      toast.error('Failed to save holiday');
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (isCalendarReadOnly) {
      toast.error('Only Director can delete holidays');
      return;
    }
    if (!window.confirm('Remove this holiday from calendar?')) return;

    setDeletingHolidayId(holidayId);
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', holidayId);
      if (error) throw error;
      toast.success('Holiday removed');
      await refetchHolidays();
    } catch (err) {
      console.error('Failed to delete holiday:', err);
      toast.error('Failed to delete holiday');
    } finally {
      setDeletingHolidayId(null);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const selectedHoliday = selectedDate ? getHoliday(selectedDate) : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">Leave Calendar</h1>
            <p className="mt-2 text-muted-foreground">{isCalendarReadOnly ? 'View approved leaves and college holidays' : 'View approved leaves and add college holidays on specific dates'}</p>
          </div>

          {canDownloadDirectorReports && (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 gap-2" disabled={!!reportLoading}>
                    {reportLoading?.startsWith('staff') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Staff Report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => handleDirectorReportDownload('staff', 'pdf')}>
                    <FileText className="mr-2 h-4 w-4" /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDirectorReportDownload('staff', 'excel')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 gap-2" disabled={!!reportLoading}>
                    {reportLoading?.startsWith('principal') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Principal Report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => handleDirectorReportDownload('principal', 'pdf')}>
                    <FileText className="mr-2 h-4 w-4" /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDirectorReportDownload('principal', 'excel')}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>



        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-playfair-display">{format(currentDate, 'MMMM yyyy')}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-2 grid grid-cols-7">
                {weekDays.map(d => (
                  <div key={d} className="py-1 text-center text-xs font-semibold text-muted-foreground">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: startDow }).map((_, i) => <div key={`empty-${i}`} />)}
                {daysInMonth.map(day => {
                  const isLeave = isLeaveDate(day);
                  const isHol = isHolidayDate(day);
                  const isTod = isToday(day);
                  const isSel = selectedDate && isSameDay(day, selectedDate);
                  const isWeekendDay = getDay(day) === 0 || getDay(day) === 6;
                  const leavesCount = getLeavesOnDate(day).length;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDateClick(day)}
                      className={[
                        'relative flex h-10 w-full flex-col items-center justify-center rounded-md text-sm transition-all',
                        isSel ? 'ring-2 ring-primary' : '',
                        isHol ? 'bg-destructive/20 text-destructive font-semibold' :
                          isLeave ? 'bg-primary/20 text-primary font-semibold' :
                          isWeekendDay ? 'bg-red-100/80 text-red-700 font-semibold hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300' : 'hover:bg-muted/50',
                        isTod && !isLeave && !isHol ? 'border border-primary text-primary font-bold' : '',
                        !isSameMonth(day, currentDate) ? 'opacity-30' : '',
                      ].join(' ')}
                    >
                      <span>{format(day, 'd')}</span>
                      {leavesCount > 0 && (
                        <span className="absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                          {leavesCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-primary/20 ring-1 ring-primary/40" />
                  <span className="text-xs text-muted-foreground">Approved Leave</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-destructive/20 ring-1 ring-destructive/40" />
                  <span className="text-xs text-muted-foreground">Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-red-100 ring-1 ring-red-300 dark:bg-red-950/30" />
                  <span className="text-xs text-muted-foreground">Weekend</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded border border-primary" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {!isCalendarReadOnly && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Plus className="h-4 w-4 text-primary" />
                    Add College Holiday
                  </CardTitle>
                  <CardDescription>Select a date or click a day from calendar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="holidayDate">Date</Label>
                    <Input id="holidayDate" type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="holidayName">Holiday Name</Label>
                    <Input id="holidayName" placeholder="e.g. Ganesh Chaturthi" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleAddHoliday} disabled={savingHoliday}>
                    {savingHoliday ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Save Holiday
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {selectedDate ? format(selectedDate, 'EEEE, dd MMM yyyy') : 'Select a date'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedDate ? (
                  <p className="text-xs text-muted-foreground">Click any date to see leave and holiday details</p>
                ) : (
                  <>
                    {selectedHoliday && (
                      <div className="flex items-center justify-between gap-2 rounded-md bg-destructive/10 p-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Sun className="h-4 w-4 text-destructive shrink-0" />
                          <span className="truncate text-xs font-medium text-destructive">{getHolidayName(selectedDate)}</span>
                        </div>
                        {!isCalendarReadOnly && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(selectedHoliday.id)} disabled={deletingHolidayId === selectedHoliday.id}>
                            {deletingHolidayId === selectedHoliday.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    )}
                    {selectedDayLeaves.length === 0 && !selectedHoliday ? (
                      <p className="text-xs text-muted-foreground">No approved leaves, holiday, or weekend note on this day</p>
                    ) : selectedDayLeaves.length > 0 ? (
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <Users className="h-3.5 w-3.5" />
                          {selectedDayLeaves.length} staff on leave
                        </p>
                        {selectedDayLeaves.map((l, i) => (
                          <div key={i} className="rounded-md border border-border bg-muted/30 p-2">
                            <p className="text-xs font-medium">{l.staffName}</p>
                            <p className="text-[11px] text-muted-foreground">{l.department}</p>
                            <Badge variant="secondary" className="mt-1 text-[10px]">{l.leaveType}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Upcoming Holidays</CardTitle>
              </CardHeader>
              <CardContent>
                {holidays.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No holidays added yet</p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {holidays.slice(0, 12).map(h => (
                      <div key={h.id} className="flex items-center justify-between rounded-md border border-border p-2">
                        <div>
                          <p className="text-xs font-medium">{h.name}</p>
                          <p className="text-[11px] text-muted-foreground">{format(new Date(`${h.date}T00:00:00`), 'dd MMM yyyy')}</p>
                        </div>
                        {!isCalendarReadOnly && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(h.id)} disabled={deletingHolidayId === h.id}>
                            {deletingHolidayId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
