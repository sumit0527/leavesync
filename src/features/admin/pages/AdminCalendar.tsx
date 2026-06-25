import { useState, useCallback } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { useHolidays } from '@/hooks/use-holidays';
import { supabase } from '@/db/supabase';
import { format, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Users, Sun, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface LeavesOnDate {
  staffName: string;
  department: string;
  leaveType: string;
}

export default function AdminCalendar() {
  const { isViewer } = useAuth();
  const { applications } = useLeaveApplications();
  const { holidays, refetch: refetchHolidays } = useHolidays();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayLeaves, setSelectedDayLeaves] = useState<LeavesOnDate[]>([]);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [deletingHolidayId, setDeletingHolidayId] = useState<string | null>(null);

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

  const handleAddHoliday = async () => {
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
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Leave Calendar</h1>
          <p className="mt-2 text-muted-foreground">{isViewer ? 'View approved leaves and college holidays' : 'View approved leaves and add college holidays on specific dates'}</p>
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
                  const leavesCount = getLeavesOnDate(day).length;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDateClick(day)}
                      className={[
                        'relative flex h-10 w-full flex-col items-center justify-center rounded-md text-sm transition-all',
                        isSel ? 'ring-2 ring-primary' : '',
                        isHol ? 'bg-destructive/20 text-destructive font-semibold' :
                          isLeave ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-muted/50',
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
                  <span className="h-3 w-3 rounded border border-primary" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {!isViewer && (
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
                        {!isViewer && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(selectedHoliday.id)} disabled={deletingHolidayId === selectedHoliday.id}>
                            {deletingHolidayId === selectedHoliday.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    )}
                    {selectedDayLeaves.length === 0 && !selectedHoliday ? (
                      <p className="text-xs text-muted-foreground">No approved leaves or holiday on this day</p>
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
                        {!isViewer && (
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
