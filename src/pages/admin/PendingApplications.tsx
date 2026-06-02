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
  const { profile } = useAuth();
  const { applications, loading, refetch } = useLeaveApplications();
  const { departments } = useDepartments();
  const { leaveTypes } = useLeaveTypes();
  const [selectedApp, setSelectedApp] = useState<LeaveApplication | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [response, setResponse] = useState('');
  const [processing, setProcessing] = useState(false);
  const [generatingResponse, setGeneratingResponse] = useState(false);
  
  // Search filters
  const [searchName, setSearchName] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterLeaveType, setFilterLeaveType] = useState('all');

  const pendingApplications = applications
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
    setSelectedApp(app);
    setAction(actionType);
    setResponse('');
    setDialogOpen(true);
  };

  const generateAIResponse = async () => {
    if (!selectedApp) return;

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
    if (!selectedApp) return;

    setProcessing(true);

    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      
      const { error: updateError } = await supabase
        .from('leave_applications')
        .update({
          status: newStatus,
          admin_response: response.trim(),
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedApp.id);

      if (updateError) throw updateError;

      if (action === 'approve') {
        const { error: balanceError } = await supabase
          .from('profiles')
          .update({
            leave_balance: (selectedApp.staff?.leave_balance || 0) - selectedApp.leave_days
          })
          .eq('id', selectedApp.staff_id);

        if (balanceError) throw balanceError;
      }

      await supabase
        .from('notifications')
        .insert({
          user_id: selectedApp.staff_id,
          title: `Leave Application ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          message: `Your leave application from ${format(new Date(selectedApp.start_date), 'MMM dd')} to ${format(new Date(selectedApp.end_date), 'MMM dd')} has been ${action === 'approve' ? 'approved' : 'rejected'}. ${response.trim()}`,
          type: action === 'approve' ? 'success' : 'error',
          related_application_id: selectedApp.id
        });

      await supabase.functions.invoke('send-approval-notification', {
        body: {
          staffName: selectedApp.staff?.full_name,
          staffEmail: selectedApp.staff?.email,
          leaveType: selectedApp.leave_type?.name ?? 'Leave',
          startDate: selectedApp.start_date,
          endDate: selectedApp.end_date,
          leaveDays: selectedApp.leave_days,
          status: newStatus,
          adminResponse: response.trim()
        }
      });

      toast.success(`Application ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Action error:', error);
      toast.error(`Failed to ${action} application`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Pending Applications</h1>
          <p className="mt-2 text-muted-foreground">Review and process leave requests</p>
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
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleAction(app, 'approve')}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleAction(app, 'reject')}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
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
                {action === 'approve' ? 'Approve' : 'Reject'} Leave Application
              </DialogTitle>
              <DialogDescription>
                Provide a response for {selectedApp?.staff?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="response">Admin Response</Label>
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
