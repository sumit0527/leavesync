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
import { formatCollegeUnit } from '@/lib/college-units';

const formatLeaveDuration = (app: LeaveApplication) => {
  if (app.leave_duration === 'half_day') {
    return app.half_day_period === 'second_half' ? 'Half Day — Second Half' : 'Half Day — First Half';
  }
  return 'Full Day';
};

export default function ViewLeave() {
  const { profile, isViewer, isPrincipal, isMainAdmin, portalRoleLabel } = useAuth();
  const { applications, loading, refetch } = useLeaveApplications();
  const isDirectorView = isMainAdmin || isViewer;
  const canManageLeaveApplications = (isPrincipal || isMainAdmin) && !isViewer;
  const actionRoleLabel = isDirectorView ? 'Director' : 'Principal';
  const applicantRoleLabel = isDirectorView ? 'Principal / escalated staff' : 'staff';

  const isEscalatedStaffLeave = (app: LeaveApplication) => {
    const staffRole = String((app.staff as any)?.role ?? '').toLowerCase();
    if (app.status !== 'pending' || staffRole !== 'staff' || !app.created_at) return false;
    return Date.now() - new Date(app.created_at).getTime() >= 24 * 60 * 60 * 1000;
  };

  const getApplicantRoleLabel = (app?: LeaveApplication | null) => {
    const staffRole = String((app?.staff as any)?.role ?? '').toLowerCase();
    if (staffRole === 'staff') return isEscalatedStaffLeave(app as LeaveApplication) ? 'escalated staff' : 'staff';
    if (staffRole === 'principal' || staffRole === 'admin') return 'Principal';
    return 'applicant';
  };

  const canActOnApplication = (app: LeaveApplication) => {
    if (!canManageLeaveApplications || app.status !== 'pending') return false;
    const staffRole = String((app.staff as any)?.role ?? '').toLowerCase();
    if (isPrincipal && !isDirectorView) return staffRole === 'staff' && (app.staff as any)?.college_unit === (profile as any)?.college_unit;
    if (isMainAdmin) return staffRole === 'principal' || staffRole === 'admin' || isEscalatedStaffLeave(app);
    return false;
  };
  const { departments } = useDepartments();
  const { leaveTypes } = useLeaveTypes();

  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [response, setResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingAppId, setProcessingAppId] = useState<string | null>(null);

  const [searchName, setSearchName] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const visibleApplications = applications.filter((app) => {
    const staffRole = String((app.staff as any)?.role ?? '').toLowerCase();

    if (isDirectorView) {
      // Director and Viewer can see all leave applications across Junior, Senior, and Pharmacy.
      return true;
    }

    if (isPrincipal && !isViewer) {
      // Principal/UH manages only staff leave applications from their own college unit.
      return staffRole === 'staff' && (app.staff as any)?.college_unit === (profile as any)?.college_unit;
    }

    return true;
  });

  const filtered = visibleApplications.filter((app) => {
    if (filterStatus !== 'all' && app.status !== filterStatus) return false;
    if (searchName && !app.staff?.full_name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (filterDept !== 'all' && app.staff?.department_id !== filterDept) return false;
    if (filterType !== 'all' && app.leave_type_id !== filterType) return false;
    return true;
  });

  const openDialog = (app: LeaveApplication, act: 'approve' | 'reject') => {
    if (!canActOnApplication(app) || processingAppId === app.id) return;
    setSelectedApp(app);
    setAction(act);
    setResponse('');
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedApp || !profile || !canManageLeaveApplications) return;

    setProcessing(true);
    setProcessingAppId(selectedApp.id);

    try {
      const { data, error: actionError } = await supabase.rpc('handle_leave_application_action', {
        p_application_id: selectedApp.id,
        p_action: action,
        p_response: response.trim() || null,
      });

      if (actionError) throw actionError;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success) {
        toast.error(result?.message || 'This application has already been handled.');
        setDialogOpen(false);
        await refetch();
        return;
      }

      supabase.functions.invoke('send-leave-decision-email', {
        body: {
          applicationId: selectedApp.id,
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewerRoleLabel: isDirectorView ? 'Director' : 'Principal / UH',
          reviewerName: profile.full_name || profile.username,
          response: response.trim() || null,
        }
      }).catch((emailError: unknown) => console.error('Leave decision email failed:', emailError));

      toast.success(result.message || `Application ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setDialogOpen(false);
      setSelectedApp(null);
      await refetch();
    } catch (err) {
      toast.error('Failed to process application');
      console.error(err);
    } finally {
      setProcessing(false);
      setProcessingAppId(null);
    }
  };

  const formatReviewSummary = (app: LeaveApplication) => {
    if (app.status === 'pending') {
      const staffRole = String((app.staff as any)?.role ?? '').toLowerCase();
      if (staffRole === 'staff') return isEscalatedStaffLeave(app) ? 'Escalated to Director after 24 hours' : 'Waiting for Principal action';
      return 'Waiting for Director action';
    }
    const actionText = app.status === 'approved' ? 'Approved' : 'Rejected';
    const staffRole = String((app.staff as any)?.role ?? '').toLowerCase();
    const fallbackReviewer = staffRole === 'staff' ? 'Principal' : 'Director';
    const reviewerName = app.reviewer?.full_name || app.reviewer?.username || fallbackReviewer;
    const actionDate = app.reviewed_at ? format(new Date(app.reviewed_at), 'dd MMM yyyy') : '';
    return `${actionText} by ${reviewerName}${actionDate ? ` on ${actionDate}` : ''}`;
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
            {isViewer ? 'View Director-level leave applications in read-only mode' : isDirectorView ? 'Review Principal leaves and staff leaves escalated after 24 hours' : 'Review, approve or reject staff leave applications'}
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
              {isDirectorView ? 'Principal & Escalated Staff Leave Applications' : 'Leave Applications'}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filtered.length} record{filtered.length !== 1 ? 's' : ''})
              </span>
            </CardTitle>
            <CardDescription>{canManageLeaveApplications ? `Click Approve or Reject to act on a pending ${applicantRoleLabel} application` : `${portalRoleLabel} read-only monitoring view.`}</CardDescription>
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
                      <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Handled By</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">File</th>
                      {canManageLeaveApplications && <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">{actionRoleLabel} Action</th>}
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
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                          {formatReviewSummary(app)}
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
                        {canManageLeaveApplications && (
                          <td className="whitespace-nowrap px-4 py-3">
                            {canActOnApplication(app) ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-8 bg-green-600 text-white hover:bg-green-700"
                                  onClick={() => openDialog(app, 'approve')}
                                  disabled={processingAppId === app.id}
                                >
                                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8"
                                  onClick={() => openDialog(app, 'reject')}
                                  disabled={processingAppId === app.id}
                                >
                                  <XCircle className="mr-1 h-3.5 w-3.5" />
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                {formatReviewSummary(app)}
                              </span>
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

      {/* Approve / Reject Dialog */}
      {canManageLeaveApplications && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-playfair-display gradient-text">
              {action === 'approve' ? `Approve ${getApplicantRoleLabel(selectedApp)} Leave Application` : `Reject ${getApplicantRoleLabel(selectedApp)} Leave Application`}
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
                {actionRoleLabel} Response <span className="text-muted-foreground">(optional)</span>
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
      </Dialog>}
    </AdminLayout>
  );
}
