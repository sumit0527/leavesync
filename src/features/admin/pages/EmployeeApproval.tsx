import { useState, useEffect } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, Users } from 'lucide-react';
import type { Profile } from '@/types';

export default function EmployeeApproval() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    fetchPendingEmployees();
  }, []);

  const fetchPendingEmployees = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*, department:departments(*)')
        .eq('role', 'staff')
        .order('created_at', { ascending: false });

      if (data) {
        setEmployees(data as unknown as Profile[]);
      }
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
          approved_by: profile.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', employeeId);

      if (updateError) throw updateError;

      const { error: allocError } = await supabase.rpc('initialize_staff_leave_allocations', {
        staff_id_param: employeeId
      });

      if (allocError) {
        console.error('Failed to initialize leave allocations:', allocError);
      }

      await supabase.from('notifications').insert({
        user_id: employeeId,
        title: 'Account Approved',
        message: `Congratulations ${employeeName}! Your account has been approved. You can now login and access the leave management system.`,
        type: 'approval'
      });

      // Send email notification to staff
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
      fetchPendingEmployees();
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
          approved_at: new Date().toISOString()
        })
        .eq('id', employeeId);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert({
        user_id: employeeId,
        title: 'Account Rejected',
        message: `Dear ${employeeName}, your account registration has been rejected. Please contact the administration office for more information.`,
        type: 'rejection'
      });

      // Send email notification to staff
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
      fetchPendingEmployees();
    } catch (err) {
      console.error('Failed to reject employee:', err);
      toast.error('Failed to reject employee');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const pendingCount = employees.filter(e => e.approval_status === 'pending').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Employee Management</h1>
          <p className="text-muted-foreground mt-2">Review and approve staff registrations</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {employees.filter(e => e.approval_status === 'approved').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Employees
            </CardTitle>
            <CardDescription>Manage employee accounts and approval status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No employees found
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
                      <th className="text-left p-3 whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 whitespace-nowrap">{employee.full_name}</td>
                        <td className="p-3 whitespace-nowrap">{employee.email || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{employee.phone || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{employee.department?.name || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{getStatusBadge(employee.approval_status)}</td>
                        <td className="p-3 whitespace-nowrap">
                          {employee.approval_status === 'pending' ? (
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
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
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
