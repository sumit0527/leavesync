import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Users, CheckCircle, XCircle, Clock, Building2, UserPlus, CalendarDays, BarChart3, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/db/supabase';

const compactCardClass = 'rounded-xl border-border/80 shadow-sm transition hover:border-primary/40 hover:shadow-md';

export default function AdminDashboard() {
  const { profile, isViewer, isPrincipal, isMainAdmin, portalRoleLabel } = useAuth();
  const { applications, loading } = useLeaveApplications();
  const [employeeCount, setEmployeeCount] = useState(0);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [newStaffList, setNewStaffList] = useState<{ id: string; full_name: string; created_at: string; role?: string; department?: { name: string } }[]>([]);

  const fetchCounts = useCallback(async () => {
    const { count: empCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'staff')
      .eq('approval_status', 'approved')
      .or('employment_status.is.null,employment_status.neq.past');

    const { count: deptCount } = await supabase
      .from('departments')
      .select('*', { count: 'exact', head: true });

    setEmployeeCount(empCount ?? 0);
    setDepartmentCount(deptCount ?? 0);
  }, []);

  const fetchNewStaff = useCallback(async () => {
    // Home dashboard registration box should stay useful:
    // Principal sees pending Staff registrations for action.
    // Director monitors pending Staff registrations here (Principal registration is limited to 2 users and is handled from notifications/employee flow).
    const rolesToShow = ['staff'];

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at, department:departments(name)')
      .in('role', rolesToShow)
      .eq('approval_status', 'pending')
      .or('employment_status.is.null,employment_status.neq.past')
      .order('created_at', { ascending: false })
      .limit(4);

    if (error) {
      console.error('Failed to load pending registrations:', error);
      setNewStaffList([]);
      return;
    }

    setNewStaffList((data ?? []) as any);
  }, [isMainAdmin, isPrincipal]);

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
  }, [fetchCounts, fetchNewStaff]);

  const dashboardStatsApps = applications.filter((app) => {
    const applicantRole = String((app.staff as any)?.role ?? '').toLowerCase();

    // Principal management dashboard analyzes Staff leave work only.
    if (isPrincipal && !isMainAdmin) return applicantRole === 'staff';

    // Director action dashboard should not mix Staff leave counts into Principal leave action counts.
    // Staff activity is still visible in Recent Applications/reporting where it is labelled clearly.
    if (isMainAdmin) return applicantRole === 'principal' || applicantRole === 'admin';

    return true;
  });

  const dashboardStats = {
    total: dashboardStatsApps.length,
    approved: dashboardStatsApps.filter((a) => a.status === 'approved').length,
    rejected: dashboardStatsApps.filter((a) => a.status === 'rejected').length,
    pending: dashboardStatsApps.filter((a) => a.status === 'pending').length,
  };

  const dashboardCards = [
    { title: 'Pending Leaves', value: dashboardStats.pending, note: isMainAdmin ? 'Principal leaves' : 'Staff leaves', icon: Clock, accent: 'text-yellow-600', primary: true },
    { title: 'Total Employees', value: employeeCount, note: 'Active staff', icon: Users, accent: 'text-primary' },
    { title: 'Departments', value: departmentCount, note: 'Active departments', icon: Building2, accent: 'text-muted-foreground' },
    { title: 'Total Applications', value: dashboardStats.total, note: isMainAdmin ? 'Principal leave apps' : 'Staff leave apps', icon: FileCheck, accent: 'text-muted-foreground' },
    { title: 'Approved', value: dashboardStats.approved, note: 'Applications', icon: CheckCircle, accent: 'text-green-600' },
    { title: 'Rejected', value: dashboardStats.rejected, note: 'Applications', icon: XCircle, accent: 'text-red-600' },
  ];

  const quickActions = [
    { label: 'Calendar', to: '/admin/calendar', icon: CalendarDays, variant: 'default' as const },
    { label: 'All Applications', to: '/admin/applications', icon: FileCheck, variant: 'secondary' as const },
    { label: 'Analytics', to: '/admin/analytics', icon: BarChart3, variant: 'secondary' as const },
    { label: 'Leave Types', to: '/admin/leave-types', icon: Tags, variant: 'secondary' as const },
    { label: 'Departments', to: '/admin/departments', icon: Building2, variant: 'secondary' as const },
  ];

  const recentApplications = applications
    .filter((app) => {
      const applicantRole = String((app.staff as any)?.role ?? '').toLowerCase();

      // Principal dashboard must show only staff-side leave work.
      // Principal leave applications belong to Director and should not appear here.
      if (isPrincipal && !isMainAdmin) return applicantRole === 'staff';

      // Director dashboard can monitor both staff and Principal leaves, with a role label below.
      if (isMainAdmin) return applicantRole === 'staff' || applicantRole === 'principal' || applicantRole === 'admin';

      return true;
    })
    .slice(0, 4);

  const getApplicantRoleLabel = (role?: string | null) => {
    const normalized = String(role ?? '').toLowerCase();
    if (normalized === 'staff') return 'Staff';
    if (normalized === 'principal' || normalized === 'admin') return 'Principal';
    return 'User';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600 text-[10px]"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="text-[10px]"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-playfair-display font-bold gradient-text md:text-3xl">{`${portalRoleLabel} Dashboard`}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{isViewer ? 'Read-only access for reports and records' : `Welcome back, ${profile?.full_name}`}</p>
          </div>

          {isPrincipal && !isViewer && (
            <div className="grid w-full grid-cols-2 gap-1.5 rounded-xl border border-primary/25 bg-primary/5 p-1.5 shadow-sm sm:w-auto sm:min-w-[260px]">
              <Button size="sm" variant="default" className="h-8 px-2 text-[11px] sm:h-9 sm:text-xs">
                Management View
              </Button>
              <Button size="sm" variant="outline" className="h-8 px-2 text-[11px] sm:h-9 sm:text-xs" asChild>
                <Link to="/staff/dashboard">My Leave View</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 lg:grid-cols-6">
          {dashboardCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className={`${compactCardClass} ${item.primary ? 'gold-border bg-primary/5' : ''}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2.5 pb-1">
                  <CardTitle className="text-xs font-medium leading-tight sm:text-sm">{item.title}</CardTitle>
                  <Icon className={`h-3.5 w-3.5 ${item.accent}`} />
                </CardHeader>
                <CardContent className="p-2.5 pt-0">
                  <div className={`text-lg font-bold sm:text-xl ${item.accent}`}>{item.value}</div>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">{item.note}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className={compactCardClass}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="font-playfair-display text-lg">Quick Actions</CardTitle>
            <CardDescription className="text-xs">{isViewer ? 'Read-only shortcuts for records and reports' : isPrincipal ? 'Staff management shortcuts' : 'Compact shortcuts for director work'}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.to} variant={action.variant} size="sm" className="h-9 justify-start gap-1.5 px-2 text-xs" asChild>
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <div>
                <CardTitle className="font-playfair-display text-lg">{isMainAdmin ? 'Recent Staff & Principal Applications' : 'Recent Staff Applications'}</CardTitle>
                <CardDescription className="text-xs">{isMainAdmin ? 'Latest staff and Principal leave requests are clearly labelled below' : 'Latest staff leave requests and updates'}</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/view-leave">Review All</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : recentApplications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications yet</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {recentApplications.map((app) => (
                    <div key={app.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/80 p-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium">{app.staff?.full_name || 'Staff'}</p>
                          {isMainAdmin && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {getApplicantRoleLabel((app.staff as any)?.role)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(app.start_date), 'MMM dd')} - {format(new Date(app.end_date), 'MMM dd')}
                        </p>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={compactCardClass}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <div>
                <CardTitle className="font-playfair-display flex items-center gap-2 text-lg">
                  <UserPlus className="h-4 w-4 text-primary" />
                  New Staff Registrations
                </CardTitle>
                <CardDescription className="text-xs">
                  {isMainAdmin ? 'Pending staff registrations for Director monitoring' : 'Pending staff approvals'}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/employees">Review All</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {newStaffList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No new staff registrations</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {newStaffList.map((staff) => (
                    <div key={staff.id} className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                      <p className="truncate text-sm font-medium">{staff.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {staff.department?.name || 'No department selected'}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Registered {format(new Date(staff.created_at), 'MMM dd')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
  
