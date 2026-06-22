import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLeaveStats } from '@/hooks/use-leave-applications';
import { FileCheck, Users, CheckCircle, XCircle, Clock, Building2, UserPlus, CalendarDays, BarChart3, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/db/supabase';

const compactCardClass = 'rounded-xl border-border/80 shadow-sm transition hover:border-primary/40 hover:shadow-md';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { stats } = useLeaveStats();
  const [employeeCount, setEmployeeCount] = useState(0);
  const [departmentCount, setDepartmentCount] = useState(0);

  useEffect(() => {
    fetchCounts();
    const channel = supabase
      .channel('admin-dashboard-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchCounts();
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
            <CardDescription className="text-xs">Common admin tasks in one compact section</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.to} variant={action.variant} size="sm" className="h-9 justify-start gap-1.5 px-2 text-[11px] sm:text-xs" asChild>
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
      </div>
    </AdminLayout>
  );
}
