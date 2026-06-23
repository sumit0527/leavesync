import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { useLeaveAllocations } from '@/hooks/use-leave-allocations';
import { useHolidays } from '@/hooks/use-holidays';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Sun, Info, CalendarCheck2 } from 'lucide-react';

const formatDuration = (app: any) => {
  if (app.leave_duration === 'half_day') {
    return app.half_day_period === 'second_half' ? 'Half Day — Second Half' : 'Half Day — First Half';
  }
  return 'Full Day';
};

export default function LeaveCalendar() {
  const { profile } = useAuth();
  const { applications } = useLeaveApplications(profile?.id);
  const { allocations } = useLeaveAllocations(profile?.id);
  const { holidays } = useHolidays();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBalanceOverview, setShowBalanceOverview] = useState(false);
  const [isBalanceHovering, setIsBalanceHovering] = useState(false);

  const approvedLeaves = applications.filter(app => app.status === 'approved');
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleBalanceCardClick = () => {
    setIsBalanceHovering(false);
    setShowBalanceOverview((prev) => !prev);
  };

  const handleBalancePointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') {
      setIsBalanceHovering(true);
    }
  };

  const handleBalancePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') {
      setIsBalanceHovering(false);
    }
  };

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

  const getLeaveOnDate = (date: Date) => {
    const ds = format(date, 'yyyy-MM-dd');
    return approvedLeaves.find(app => ds >= app.start_date && ds <= app.end_date);
  };

  const getHolidayName = (date: Date): string | null => {
    const ds = format(date, 'yyyy-MM-dd');
    return holidays.find(h => h.date === ds)?.name ?? null;
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const selectedLeave = selectedDate ? getLeaveOnDate(selectedDate) : null;
  const selectedHoliday = selectedDate ? getHolidayName(selectedDate) : null;
  const isBalanceOverviewOpen = showBalanceOverview || isBalanceHovering;

  return (
    <StaffLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Leave Calendar</h1>
          <p className="mt-2 text-muted-foreground">Your approved leaves and public holidays</p>
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
                {Array.from({ length: startDow }).map((_, i) => <div key={`e-${i}`} />)}
                {daysInMonth.map(day => {
                  const isLeave = isLeaveDate(day);
                  const isHol = isHolidayDate(day);
                  const isTod = isToday(day);
                  const isSel = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={[
                        'flex h-10 w-full items-center justify-center rounded-md text-sm transition-all',
                        isSel ? 'ring-2 ring-primary' : '',
                        isHol ? 'bg-destructive/20 text-destructive font-semibold' :
                          isLeave ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-muted/50',
                        isTod && !isLeave && !isHol ? 'border border-primary text-primary font-bold' : '',
                        !isSameMonth(day, currentDate) ? 'opacity-30' : '',
                      ].join(' ')}
                    >
                      {format(day, 'd')}
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
                  <span className="text-xs text-muted-foreground">Public Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded border border-primary" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {selectedDate ? format(selectedDate, 'EEEE, dd MMM') : 'Date Details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!selectedDate ? (
                  <p className="text-xs text-muted-foreground">Click a date to see details</p>
                ) : (
                  <>
                    {selectedHoliday && (
                      <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2">
                        <Sun className="h-4 w-4 text-destructive shrink-0" />
                        <span className="text-xs font-medium text-destructive">{selectedHoliday}</span>
                      </div>
                    )}
                    {selectedLeave ? (
                      <div className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-1">
                        <p className="text-xs font-medium text-primary">You are on approved leave</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(selectedLeave.start_date + 'T00:00:00'), 'dd MMM')} – {format(new Date(selectedLeave.end_date + 'T00:00:00'), 'dd MMM yyyy')}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-[10px]">{selectedLeave.leave_type?.name}</Badge>
                          <Badge variant="outline" className="text-[10px]">{formatDuration(selectedLeave)}</Badge>
                        </div>
                      </div>
                    ) : !selectedHoliday ? (
                      <p className="text-xs text-muted-foreground">No leave or holiday</p>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">My Leave Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Approved Leaves</span>
                  <Badge>{approvedLeaves.length}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Public Holidays</span>
                  <Badge variant="outline">{holidays.length}</Badge>
                </div>
              </CardContent>
            </Card>

            <div
              className="relative"
              onPointerEnter={handleBalancePointerEnter}
              onPointerLeave={handleBalancePointerLeave}
            >
              <Card className="border-primary/30 bg-primary/5">
                <button
                  type="button"
                  onClick={handleBalanceCardClick}
                  className="w-full text-left transition hover:bg-primary/10"
                  aria-expanded={isBalanceOverviewOpen}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <CalendarCheck2 className="h-4 w-4 text-primary" />
                      Leave Type Balance Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Hover on desktop or tap on mobile to view balances</span>
                    <Info className="h-4 w-4" />
                  </CardContent>
                </button>
              </Card>

              {isBalanceOverviewOpen && (
                <div className="absolute bottom-full right-0 z-50 mb-3 w-[min(92vw,42rem)] max-w-[calc(100vw-2rem)] rounded-xl border border-primary/30 bg-background p-3 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-primary">Leave Type Balance</p>
                      <p className="text-[11px] text-muted-foreground">Total, used and left leaves</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0 text-[10px]">{allocations.length} Types</Badge>
                      <button
                        type="button"
                        onClick={() => {
                          setShowBalanceOverview(false);
                          setIsBalanceHovering(false);
                        }}
                        className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 sm:hidden"
                        aria-label="Close leave balance overview"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  {allocations.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No leave allocation found.</p>
                  ) : (
                    <div className="grid max-h-[55vh] grid-cols-1 gap-2 overflow-y-auto pr-1 min-[420px]:grid-cols-2 lg:grid-cols-2">
                      {allocations.map((allocation) => {
                        const used = allocation.used ?? 0;
                        const total = allocation.total_allocated;
                        const remaining = Math.max(0, total - used);
                        const name = allocation.leave_type?.name ?? 'Leave Type';
                        const abbr = name
                          .split(/\s+/)
                          .map((w: string) => w[0]?.toUpperCase() ?? '')
                          .join('')
                          .slice(0, 4);
                        return (
                          <div key={allocation.id} className="rounded-lg border border-primary/25 bg-primary p-2.5 text-primary-foreground shadow-sm">
                            <p className="truncate text-xs font-bold sm:text-sm">{name}{abbr ? ` (${abbr})` : ''}</p>
                            <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] text-primary-foreground/90 sm:text-[11px]">
                              <div className="rounded bg-white/15 px-1 py-1"><span className="block text-sm font-bold leading-none">{total}</span><span>Total</span></div>
                              <div className="rounded bg-white/15 px-1 py-1"><span className="block text-sm font-bold leading-none">{used}</span><span>Used</span></div>
                              <div className="rounded bg-white/25 px-1 py-1"><span className="block text-sm font-bold leading-none">{remaining}</span><span>Left</span></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

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
    </StaffLayout>
  );
}
