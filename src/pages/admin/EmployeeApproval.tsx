import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, Users, UserX, RotateCcw } from 'lucide-react';
import type { Profile } from '@/types';

type EmployeeRecord = Profile & {
  employment_status?: 'active' | 'past';
  exited_at?: string | null;
  exited_by?: string | null;
};

export default function EmployeeApproval() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current');
  const { profile, isViewer } = useAuth();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*, department:departments(*)')
        .eq('role', 'staff')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setEmployees(data as unknown as EmployeeRecord[]);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (employeeId: string, employeeName: string) => {
    if (!profile?.id) return;

    setProcessingId(employeeId);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'approved',
          employment_status: 'active',
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', employeeId);

      if (updateError) throw updateError;

      const { error: allocError } = await supabase.rpc('initialize_staff_leave_allocations', {
        staff_id_param: employeeId,
      });

      if (allocError) console.error('Failed to initialize leave allocations:', allocError);

      await supabase.from('notifications').insert({
        user_id: employeeId,
        title: 'Account Approved',
        message: `Congratulations ${employeeName}! Your account has been approved. You can now login and access the leave management system.`,
        type: 'approval',
      });

      const employee = employees.find(e => e.id === employeeId);
      if (employee?.email) {
        supabase.functions.invoke('send-account-notification', {
          body: {
            staffName: employeeName,
            staffEmail: employee.email,
            username: employee.username,
            status: 'approved',
          },
        }).catch((err: unknown) => console.error('Email notification failed:', err));
      }

      toast.success('Employee approved successfully');
      fetchEmployees();
    } catch (err) {
      console.error('Failed to approve employee:', err);
      toast.error('Failed to approve employee');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (employeeId: string, employeeName: string) => {
    if (!profile?.id) return;

    setProcessingId(employeeId);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'rejected',
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', employeeId);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert({
        user_id: employeeId,
        title: 'Account Rejected',
        message: `Dear ${employeeName}, your account registration has been rejected. Please contact the administration office for more information.`,
        type: 'rejection',
      });

      const employee = employees.find(e => e.id === employeeId);
      if (employee?.email) {
        supabase.functions.invoke('send-account-notification', {
          body: {
            staffName: employeeName,
            staffEmail: employee.email,
            username: employee.username,
            status: 'rejected',
          },
        }).catch((err: unknown) => console.error('Email notification failed:', err));
      }

      toast.success('Employee rejected');
      fetchEmployees();
    } catch (err) {
      console.error('Failed to reject employee:', err);
      toast.error('Failed to reject employee');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMoveToPast = async (employee: EmployeeRecord) => {
    if (!profile?.id) return;
    if (!window.confirm(`Move ${employee.full_name} to Past Employees? Their old leave records will stay saved.`)) return;

    setProcessingId(employee.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          employment_status: 'past',
          approval_status: 'rejected',
          exited_at: new Date().toISOString(),
          exited_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', employee.id);

      if (error) throw error;
      toast.success('Employee moved to Past Employees');
      fetchEmployees();
    } catch (err) {
      console.error('Failed to move employee:', err);
      toast.error('Failed to move employee');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRestoreEmployee = async (employee: EmployeeRecord) => {
    if (!profile?.id) return;
    if (!window.confirm(`Restore ${employee.full_name} as current employee?`)) return;

    setProcessingId(employee.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          employment_status: 'active',
          approval_status: 'approved',
          exited_at: null,
          exited_by: null,
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', employee.id);

      if (error) throw error;
      toast.success('Employee restored');
      fetchEmployees();
    } catch (err) {
      console.error('Failed to restore employee:', err);
      toast.error('Failed to restore employee');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string, employmentStatus?: string) => {
    if (employmentStatus === 'past') return <Badge variant="outline" className="border-slate-400 text-slate-600">Past Employee</Badge>;
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const currentEmployees = employees.filter(e => (e.employment_status ?? 'active') !== 'past');
  const pastEmployees = employees.filter(e => e.employment_status === 'past');
  const visibleEmployees = activeTab === 'current' ? currentEmployees : pastEmployees;
  const pendingCount = currentEmployees.filter(e => e.approval_status === 'pending').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Employee Management</h1>
          <p className="text-muted-foreground mt-2">{isViewer ? 'View staff records and approval status in read-only mode' : 'Review staff registrations, manage current staff, and keep past employee records safely'}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium sm:text-sm">Current Employees</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold sm:text-2xl">{currentEmployees.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium sm:text-sm">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-yellow-600 sm:text-2xl">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium sm:text-sm">Approved</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-green-600 sm:text-2xl">
                {currentEmployees.filter(e => e.approval_status === 'approved').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium sm:text-sm">Past Employees</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-slate-600 sm:text-2xl">{pastEmployees.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="font-playfair-display flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Employees
                </CardTitle>
                <CardDescription>{isViewer ? 'Read-only employee records' : 'Use Past Employees for staff who left college without deleting history'}</CardDescription>
              </div>
              <div className="flex rounded-md border border-border p-1">
                <Button size="sm" variant={activeTab === 'current' ? 'default' : 'ghost'} onClick={() => setActiveTab('current')}>
                  Current Employees
                </Button>
                <Button size="sm" variant={activeTab === 'past' ? 'default' : 'ghost'} onClick={() => setActiveTab('past')}>
                  Past Employees
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : visibleEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {activeTab === 'current' ? 'No current employees found' : 'No past employees found'}
              </div>
            ) : (
              <div className="w-full min-w-0 overflow-x-auto">
                <table className="w-full min-w-max">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 whitespace-nowrap">Name</th>
                      <th className="text-left p-3 whitespace-nowrap">Email</th>
                      <th className="text-left p-3 whitespace-nowrap">Phone</th>
                      <th className="text-left p-3 whitespace-nowrap">Department</th>
                      <th className="text-left p-3 whitespace-nowrap">Status</th>
                      {activeTab === 'past' && <th className="text-left p-3 whitespace-nowrap">Left On</th>}
                      {!isViewer && <th className="text-left p-3 whitespace-nowrap">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.map((employee) => (
                      <tr key={employee.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 whitespace-nowrap">
                          <div>
                            <p className="font-medium">{employee.full_name}</p>
                            <p className="text-xs text-muted-foreground">@{employee.username}</p>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">{employee.email || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{employee.phone || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{employee.department?.name || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{getStatusBadge(employee.approval_status, employee.employment_status)}</td>
                        {activeTab === 'past' && (
                          <td className="p-3 whitespace-nowrap">
                            {employee.exited_at ? new Date(employee.exited_at).toLocaleDateString() : '-'}
                          </td>
                        )}
{!isViewer && (
                                                  <td className="p-3 whitespace-nowrap">
                          {activeTab === 'past' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestoreEmployee(employee)}
                              disabled={processingId === employee.id}
                            >
                              {processingId === employee.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                              Restore
                            </Button>
                          ) : employee.approval_status === 'pending' ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(employee.id, employee.full_name)}
                                disabled={processingId === employee.id}
                              >
                                {processingId === employee.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(employee.id, employee.full_name)}
                                disabled={processingId === employee.id}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleMoveToPast(employee)}
                              disabled={processingId === employee.id}
                            >
                              {processingId === employee.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4 mr-1" />}
                              Move to Past
                            </Button>
                          )}
                        </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
