import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLeaveApplications } from '@/hooks/use-leave-applications';
import { useDepartments } from '@/hooks/use-departments';
import { useLeaveTypes } from '@/hooks/use-leave-types';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CheckCircle, XCircle, FileText, Loader2, ExternalLink, Search, Sparkles } from 'lucide-react';
import type { LeaveApplication } from '@/types';

export default function PendingApplications() {
  const { profile, isPrincipal, isMainAdmin, isViewer } = useAuth();
  const { applications, loading, refetch } = useLeaveApplications();
  const { departments } = useDepartments();
  const { leaveTypes } = useLeaveTypes();
  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [response, setResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingAppId, setProcessingAppId] = useState<string | null>(null);
  const [generatingResponse, setGeneratingResponse] = useState(false);
  
  // Search filters
  const [searchName, setSearchName] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterLeaveType, setFilterLeaveType] = useState('all');

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
    if (isPrincipal && !isDirectorView) return staffRole === 'staff';
    if (isMainAdmin) return staffRole === 'principal' || staffRole === 'admin' || isEscalatedStaffLeave(app);
    return false;
  };

  const pendingApplications = applications
    .filter(app => {
      const staffRole = String((app.staff as any)?.role ?? '').toLowerCase();
      if (isDirectorView) return staffRole === 'principal' || staffRole === 'admin' || isEscalatedStaffLeave(app);
      if (isPrincipal && !isViewer) return staffRole === 'staff';
      return false;
    })
    .filter(app => app.status === 'pending')
    .filter(app => {
      if (searchName && !app.staff?.full_name?.toLowerCase().includes(searchName.toLowerCase())) {
        return false;
      }
      if (filterDepartment !== 'all' && app.staff?.department_id !== filterDepartment) {
        return false;
      }
      if (filterLeaveType !== 'all' && app.leave_type_id !== filterLeaveType) {
        return false;
      }
      return true;
    });

  const handleAction = (app: LeaveApplication, actionType: 'approve' | 'reject') => {
    if (!canActOnApplication(app)) return;
    setSelectedApp(app);
    setAction(actionType);
    setResponse('');
    setDialogOpen(true);
  };

  const generateAIResponse = async () => {
    if (!selectedApp || !canManageLeaveApplications) return;

    setGeneratingResponse(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-response', {
        body: {
          action,
          staffName: selectedApp.staff?.full_name || 'Staff',
          leaveType: selectedApp.leave_type?.name || 'Leave',
          leaveDays: selectedApp.leave_days,
          reason: selectedApp.reason,
          startDate: format(new Date(selectedApp.start_date), 'MMM dd, yyyy'),
          endDate: format(new Date(selectedApp.end_date), 'MMM dd, yyyy'),
        }
      });

      if (error) {
        const msg = await error?.context?.text?.();
        throw new Error(msg || error.message);
      }
      setResponse(data?.response || '');
      toast.success('AI response generated successfully');
    } catch (err: any) {
      console.error('AI generation error:', err);
      toast.error(err.message ?? 'Failed to generate AI response');
    } finally {
      setGeneratingResponse(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedApp || !canManageLeaveApplications) return;

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

      toast.success(result.message || `Application ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setDialogOpen(false);
      setSelectedApp(null);
      await refetch();
    } catch (error) {
      console.error('Action error:', error);
      toast.error(`Failed to ${action} application`);
    } finally {
      setProcessing(false);
      setProcessingAppId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Pending Applications</h1>
          <p className="mt-2 text-muted-foreground">Review and process pending {applicantRoleLabel} leave requests</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">Search & Filter</CardTitle>
            <CardDescription>Find specific applications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="searchName">Employee Name</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="searchName"
                    placeholder="Search by name..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterDepartment">Department</Label>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger id="filterDepartment" className="px-3">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filterLeaveType">Leave Type</Label>
                <Select value={filterLeaveType} onValueChange={setFilterLeaveType}>
                  <SelectTrigger id="filterLeaveType" className="px-3">
                    <SelectValue placeholder="All leave types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leave Types</SelectItem>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Loading applications...</p>
            </CardContent>
          </Card>
        ) : pendingApplications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">
                {searchName || filterDepartment !== 'all' || filterLeaveType !== 'all'
                  ? 'No applications match your filters'
                  : 'No pending applications'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingApplications.map((app) => (
              <Card key={app.id} className="gold-border">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{app.staff?.full_name}</CardTitle>
                      <CardDescription>
                        @{app.staff?.username} • {app.staff?.department?.name || 'No Department'}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {format(new Date(app.start_date), 'MMM dd')} - {format(new Date(app.end_date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">{app.leave_days} days</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Leave Type</p>
                      <p className="text-sm font-semibold">{app.leave_type?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Department</p>
                      <p className="text-sm font-semibold">{app.staff?.department?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Reason:</p>
                    <p className="text-sm text-muted-foreground">{app.reason}</p>
                  </div>
                  {app.document_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={app.document_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Document
                      </a>
                    </Button>
                  )}
                  {canManageLeaveApplications && (
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleAction(app, 'approve')}
                        disabled={processingAppId === app.id}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleAction(app, 'reject')}
                        disabled={processingAppId === app.id}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Applied on {format(new Date(app.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-playfair-display">
                {action === 'approve' ? 'Approve' : 'Reject'} {getApplicantRoleLabel(selectedApp)} Leave Application
              </DialogTitle>
              <DialogDescription>
                Provide a response for {selectedApp?.staff?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="response">{actionRoleLabel} Response</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateAIResponse}
                    disabled={generatingResponse || processing}
                  >
                    {generatingResponse ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-3 w-3" />
                    )}
                    Generate AI Response
                  </Button>
                </div>
                <Textarea
                  id="response"
                  placeholder={`Enter your ${action === 'approve' ? 'approval' : 'rejection'} message...`}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={4}
                  className="resize-none px-3"
                />
                <p className="text-xs text-muted-foreground">
                  Click "Generate AI Response" for a professional message, or write your own
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm {action === 'approve' ? 'Approval' : 'Rejection'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
