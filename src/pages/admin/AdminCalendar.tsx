import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { useHolidays } from '@/hooks/use-holidays';
import { supabase } from '@/db/supabase';
import { format, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Users, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LeavesOnDate {
  staffName: string;
  department: string;
  leaveType: string;
}

export default function AdminCalendar() {
  const { applications } = useLeaveApplications();
  const { holidays } = useHolidays();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayLeaves, setSelectedDayLeaves] = useState<LeavesOnDate[]>([]);

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

  const getHolidayName = (date: Date): string | null => {
    const ds = format(date, 'yyyy-MM-dd');
    const h = holidays.find(h => h.date === ds);
    return h?.name ?? null;
  };

  const getLeavesOnDate = (date: Date): LeavesOnDate[] => {
    const ds = format(date, 'yyyy-MM-dd');
    return approvedLeaves
      .filter(app => {
        const start = app.start_date;
        const end = app.end_date;
        return ds >= start && ds <= end;
      })
      .map(app => ({
        staffName: app.staff?.full_name ?? 'Unknown',
        department: (app.staff as any)?.department?.name ?? 'N/A',
        leaveType: app.leave_type?.name ?? 'Leave',
      }));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedDayLeaves(getLeavesOnDate(date));
  };

  // Realtime update for holidays
  useEffect(() => {
    const channel = supabase
      .channel('admin-calendar-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holidays' }, () => {
        // useHolidays doesn't expose refetch, but applications hook handles leave_applications
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart); // 0=Sun
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Leave Calendar</h1>
          <p className="mt-2 text-muted-foreground">All staff approved leaves and public holidays — click a date for details</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Calendar */}
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
              {/* Day headers */}
              <div className="mb-2 grid grid-cols-7">
                {weekDays.map(d => (
                  <div key={d} className="py-1 text-center text-xs font-semibold text-muted-foreground">{d}</div>
                ))}
              </div>
              {/* Day cells */}
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

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-primary/20 ring-1 ring-primary/40" />
                  <span className="text-xs text-muted-foreground">Approved Leave</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded bg-destructive/20 ring-1 ring-destructive/40" />
                  <span className="text-xs text-muted-foreground">Public Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded border border-primary" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground font-bold">2</span>
                  <span className="text-xs text-muted-foreground">Staff count on leave</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected date details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {selectedDate ? format(selectedDate, 'EEEE, dd MMM yyyy') : 'Select a date'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedDate ? (
                  <p className="text-xs text-muted-foreground">Click any date to see who is on leave</p>
                ) : (
                  <>
                    {isHolidayDate(selectedDate) && (
                      <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2">
                        <Sun className="h-4 w-4 text-destructive shrink-0" />
                        <span className="text-xs font-medium text-destructive">{getHolidayName(selectedDate)}</span>
                      </div>
                    )}
                    {selectedDayLeaves.length === 0 && !isHolidayDate(selectedDate) ? (
                      <p className="text-xs text-muted-foreground">No approved leaves on this day</p>
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

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Total Approved Leaves</span>
                  <Badge>{approvedLeaves.length}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Public Holidays</span>
                  <Badge variant="outline">{holidays.length}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Holidays */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Upcoming Holidays</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {holidays
                  .filter(h => new Date(h.date) >= new Date())
                  .slice(0, 6)
                  .map(h => (
                    <div key={h.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{h.name}</span>
                      <Badge variant="outline" className="shrink-0 ml-2 text-xs">
                        {format(new Date(h.date + 'T00:00:00'), 'dd MMM')}
                      </Badge>
                    </div>
                  ))}
                {holidays.filter(h => new Date(h.date) >= new Date()).length === 0 && (
                  <p className="text-xs text-muted-foreground">No upcoming holidays</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
