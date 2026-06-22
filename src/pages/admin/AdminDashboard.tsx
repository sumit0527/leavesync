import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLeaveApplications, useLeaveStats } from '@/hooks/use-leave-applications';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Users, CheckCircle, XCircle, Clock, Building2, UserPlus, CalendarDays, BarChart3, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/db/supabase';

const compactCardClass = 'rounded-xl border-border/80 shadow-sm transition hover:border-primary/40 hover:shadow-md';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { applications, loading } = useLeaveApplications();
  const { stats } = useLeaveStats();
  const [employeeCount, setEmployeeCount] = useState(0);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [newStaffList, setNewStaffList] = useState<{ id: string; full_name: string; created_at: string; department?: { name: string } }[]>([]);

  useEffect(() => {
    fetchCounts();
    fetchNewStaff();
    const channel = supabase
      .channel('admin-dashboard-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchCounts();
        fetchNewStaff();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => {
        fetchCounts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCounts = useCallback(async () => {
    const { count: empCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'staff')
      .eq('approval_status', 'approved')
      .neq('employment_status', 'past');

    const { count: deptCount } = await supabase
      .from('departments')
      .select('*', { count: 'exact', head: true });

    setEmployeeCount(empCount ?? 0);
    setDepartmentCount(deptCount ?? 0);
  }, []);

  const recentApplications = applications.slice(0, 4);

  const fetchNewStaff = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, created_at, department:departments(name)')
      .eq('role', 'staff')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(4);
    if (data) setNewStaffList(data as any);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  const dashboardCards = [
    { title: 'Pending Leaves', value: stats.pending, note: 'Awaiting action', icon: Clock, accent: 'text-yellow-600', primary: true },
    { title: 'Total Employees', value: employeeCount, note: 'Active staff', icon: Users, accent: 'text-primary' },
    { title: 'Departments', value: departmentCount, note: 'Active departments', icon: Building2, accent: 'text-muted-foreground' },
    { title: 'Total Applications', value: stats.total, note: 'All time', icon: FileCheck, accent: 'text-muted-foreground' },
    { title: 'Approved', value: stats.approved, note: 'Applications', icon: CheckCircle, accent: 'text-green-600' },
    { title: 'Rejected', value: stats.rejected, note: 'Applications', icon: XCircle, accent: 'text-red-600' },
  ];

  const quickActions = [
    { label: 'View Leaves', to: '/admin/view-leave', icon: ListChecks, variant: 'default' as const },
    { label: `Pending (${stats.pending})`, to: '/admin/pending', icon: Clock, variant: 'secondary' as const },
    { label: 'Calendar', to: '/admin/calendar', icon: CalendarDays, variant: 'secondary' as const },
    { label: 'Employees', to: '/admin/employees', icon: UserPlus, variant: 'secondary' as const },
    { label: 'All Applications', to: '/admin/applications', icon: FileCheck, variant: 'secondary' as const },
    { label: 'Analytics', to: '/admin/analytics', icon: BarChart3, variant: 'secondary' as const },
  ];

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-playfair-display font-bold gradient-text">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back, {profile?.full_name}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {dashboardCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className={`${compactCardClass} ${item.primary ? 'gold-border bg-primary/5' : ''}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1.5">
                  <CardTitle className="text-xs font-medium leading-tight sm:text-sm">{item.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${item.accent}`} />
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className={`text-xl font-bold sm:text-2xl ${item.accent}`}>{item.value}</div>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">{item.note}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className={compactCardClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="font-playfair-display text-lg">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Common admin tasks in one compact section</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.to} variant={action.variant} size="sm" className="h-10 justify-start gap-2 px-3 text-xs sm:text-sm" asChild>
                    <Link to={action.to}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{action.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className={compactCardClass}>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="font-playfair-display text-lg">Recent Applications</CardTitle>
              <CardDescription className="text-xs">Latest leave requests and decisions</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : recentApplications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications yet</p>
              ) : (
                <div className="max-h-56 overflow-y-auto pr-1">
                  <div className="space-y-2">
                    {recentApplications.map((app) => (
                      <div key={app.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{app.staff?.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(app.start_date), 'MMM dd')} - {format(new Date(app.end_date), 'MMM dd')} • {app.leave_days} day{app.leave_days !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={compactCardClass}>
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
              <div>
                <CardTitle className="font-playfair-display flex items-center gap-2 text-lg">
                  <UserPlus className="h-5 w-5 text-primary" />
                  New Staff Registrations
                </CardTitle>
                <CardDescription className="text-xs">Staff awaiting account approval</CardDescription>
              </div>
              <Button size="sm" variant="secondary" asChild>
                <Link to="/admin/employees">Review</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {newStaffList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending staff registrations</p>
              ) : (
                <div className="max-h-56 overflow-y-auto pr-1">
                  <div className="space-y-2">
                    {newStaffList.map((staff) => (
                      <div key={staff.id} className="flex items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{staff.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {(staff.department as any)?.name ?? 'No department'} • {format(new Date(staff.created_at), 'dd MMM yyyy')}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 border border-amber-500/40 text-amber-600">
                          <Clock className="mr-1 h-3 w-3" />Pending
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
