import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLeaveApplications, useLeaveStats } from '@/hooks/use-leave-applications';
import { Badge } from '@/components/ui/badge';
import { FileCheck, Users, CheckCircle, XCircle, Clock, Building2, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/db/supabase';

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
    // Realtime: update counts when profiles or departments change
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
      .eq('approval_status', 'approved');

    const { count: deptCount } = await supabase
      .from('departments')
      .select('*', { count: 'exact', head: true });

    setEmployeeCount(empCount ?? 0);
    setDepartmentCount(deptCount ?? 0);
  }, []);

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const recentApplications = applications.slice(0, 5);

  const fetchNewStaff = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, created_at, department:departments(name)')
      .eq('role', 'staff')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
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

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Admin Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Welcome back, {profile?.full_name}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="gold-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{employeeCount}</div>
              <p className="text-xs text-muted-foreground">Approved staff members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{departmentCount}</div>
              <p className="text-xs text-muted-foreground">Active departments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Applications</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">Applications</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">Applications</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="font-playfair-display">Quick Actions</CardTitle>
              <CardDescription>Manage leave applications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/admin/view-leave">
                <Button className="w-full">
                  <FileCheck className="mr-2 h-4 w-4" />
                  View Leave Applications
                </Button>
              </Link>
              <Link to="/admin/pending">
                <Button variant="secondary" className="w-full">
                  <Clock className="mr-2 h-4 w-4" />
                  Review Pending ({stats.pending})
                </Button>
              </Link>
              <Link to="/admin/applications">
                <Button variant="secondary" className="w-full">
                  View All Applications
                </Button>
              </Link>
              <Link to="/admin/employees">
                <Button variant="secondary" className="w-full">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Employee Approvals {newStaffList.length > 0 && `(${newStaffList.length} pending)`}
                </Button>
              </Link>
              <Link to="/admin/analytics">
                <Button variant="secondary" className="w-full">
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle className="font-playfair-display">Recent Applications</CardTitle>
              <CardDescription>Latest leave requests</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : recentApplications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications yet</p>
              ) : (
                <div className="max-h-64 overflow-y-auto pr-1">
                  <div className="space-y-3">
                    {recentApplications.map((app) => (
                      <div key={app.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{app.staff?.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(app.start_date), 'MMM dd')} - {format(new Date(app.end_date), 'MMM dd')}
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
        </div>

        {/* New Staff Registrations */}
        {newStaffList.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-playfair-display flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  New Staff Registrations
                </CardTitle>
                <CardDescription>Staff awaiting account approval</CardDescription>
              </div>
              <Link to="/admin/employees">
                <Button size="sm" variant="secondary">Review All</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {newStaffList.map((staff) => (
                  <div key={staff.id} className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{staff.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(staff.department as any)?.name ?? 'No department'} &bull; Registered {format(new Date(staff.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 border border-amber-500/40 text-amber-600">
                      <Clock className="mr-1 h-3 w-3" />Pending Approval
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">College Campus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full overflow-hidden rounded-md">
              <img
                src="https://miaoda-site-img.s3cdn.medo.dev/images/KLing_b19ec3c1-181a-4445-984d-fdb4e94ccfa9.jpg"
                alt="G.D Sawant College Entrance"
                className="h-full w-full object-cover"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
