import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { useDepartments } from '@/hooks/use-departments';
import { useLeaveTypes } from '@/hooks/use-leave-types';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  ExternalLink,
  Search,
  Eye,
  Filter,
} from 'lucide-react';
import type { LeaveApplication } from '@/types';

const formatLeaveDuration = (app: LeaveApplication) => {
  if (app.leave_duration === 'half_day') {
    return app.half_day_period === 'second_half' ? 'Half Day — Second Half' : 'Half Day — First Half';
  }
  return 'Full Day';
};

export default function ViewLeave() {
  const { profile } = useAuth();
  const { applications, loading, refetch } = useLeaveApplications();
  const { departments } = useDepartments();
  const { leaveTypes } = useLeaveTypes();

  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [response, setResponse] = useState('');
  const [processing, setProcessing] = useState(false);

  const [searchName, setSearchName] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = applications.filter((app) => {
    if (filterStatus !== 'all' && app.status !== filterStatus) return false;
    if (searchName && !app.staff?.full_name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (filterDept !== 'all' && app.staff?.department_id !== filterDept) return false;
    if (filterType !== 'all' && app.leave_type_id !== filterType) return false;
    return true;
  });

  const openDialog = (app: LeaveApplication, act: 'approve' | 'reject') => {
    setSelectedApp(app);
    setAction(act);
    setResponse('');
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedApp || !profile) return;
    setProcessing(true);
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      const { error: updateError } = await supabase
        .from('leave_applications')
        .update({
          status: newStatus,
          admin_response: response || null,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedApp.id);

      if (updateError) throw updateError;

      // Deduct leave balance on approval
      if (action === 'approve' && selectedApp.staff_id) {
        await supabase.rpc('deduct_leave_balance', {
          p_staff_id: selectedApp.staff_id,
          p_days: selectedApp.leave_days,
        });
      }

      // Notify staff member
      await supabase.from('notifications').insert({
        user_id: selectedApp.staff_id,
        title: `Leave ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        message: response
          ? `Your leave application has been ${newStatus}. Admin note: ${response}`
          : `Your leave application has been ${newStatus}.`,
        type: `leave_${newStatus}`,
        related_application_id: selectedApp.id,
      });

      // Send email to staff
      if (selectedApp.staff?.email) {
        supabase.functions.invoke('send-approval-notification', {
          body: {
            staffName: selectedApp.staff?.full_name,
            staffEmail: selectedApp.staff?.email,
            leaveType: selectedApp.leave_type?.name ?? 'Leave',
            startDate: selectedApp.start_date,
            endDate: selectedApp.end_date,
            leaveDays: selectedApp.leave_days,
            status: newStatus,
            adminResponse: response.trim(),
          },
        }).catch((err: unknown) => console.error('Email notification failed:', err));
      }

      toast.success(`Application ${newStatus} successfully`);
      setDialogOpen(false);
      refetch();
    } catch (err) {
      toast.error('Failed to process application');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-green-600 text-white">
            <CheckCircle className="mr-1 h-3 w-3" />Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3" />Pending
          </Badge>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">View Leave Applications</h1>
          <p className="mt-2 text-muted-foreground">
            Review, approve or reject all staff leave applications
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-primary" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Employee Name</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search name…"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-9 px-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Select value={filterDept} onValueChange={setFilterDept}>
                  <SelectTrigger className="px-3"><SelectValue placeholder="All departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Leave Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="px-3"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leave Types</SelectItem>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="px-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">
              Leave Applications
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filtered.length} record{filtered.length !== 1 ? 's' : ''})
              </span>
            </CardTitle>
            <CardDescription>Click Approve or Reject to act on a pending application</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="mb-3 h-10 w-10 opacity-40" />
                <p>No applications match your filters</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-max text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Employee Name</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Department</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Leave Type</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">From</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">To</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Duration</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Days</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">File</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((app) => (
                      <tr key={app.id} className="border-b border-border transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 font-medium">
                          {app.staff?.full_name ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {(app.staff as any)?.department?.name ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {app.leave_type?.name ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {format(new Date(app.start_date), 'dd MMM yyyy')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {format(new Date(app.end_date), 'dd MMM yyyy')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatLeaveDuration(app)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          {app.leave_days}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {getStatusBadge(app.status)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          {app.document_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="h-8 gap-1 border border-primary/30 text-primary hover:bg-primary/10"
                            >
                              <a href={app.document_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {app.status === 'pending' ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                className="h-8 bg-green-600 text-white hover:bg-green-700"
                                onClick={() => openDialog(app, 'approve')}
                              >
                                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8"
                                onClick={() => openDialog(app, 'reject')}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              {app.status === 'approved' ? 'Approved' : 'Rejected'}
                            </span>
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

      {/* Approve / Reject Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-playfair-display gradient-text">
              {action === 'approve' ? 'Approve Leave Application' : 'Reject Leave Application'}
            </DialogTitle>
            <DialogDescription>
              {selectedApp?.staff?.full_name} &mdash;{' '}
              {selectedApp && format(new Date(selectedApp.start_date), 'dd MMM')} to{' '}
              {selectedApp && format(new Date(selectedApp.end_date), 'dd MMM yyyy')} ({selectedApp && formatLeaveDuration(selectedApp)} • {selectedApp?.leave_days} day
              {(selectedApp?.leave_days ?? 0) !== 1 ? 's' : ''})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Reason</p>
              <p className="mt-1 text-muted-foreground">{selectedApp?.reason}</p>
            </div>

            {selectedApp?.document_url && (
              <a
                href={selectedApp.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                View Supporting Document
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <div className="space-y-1">
              <Label htmlFor="admin-response">
                Admin Response <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="admin-response"
                placeholder={
                  action === 'approve'
                    ? 'e.g. Approved. Enjoy your leave.'
                    : 'e.g. Insufficient leave balance.'
                }
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={3}
                className="px-3"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={processing}
              className={
                action === 'approve'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
