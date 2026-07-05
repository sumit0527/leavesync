import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useHolidays } from '@/hooks/use-holidays';
import { useLeaveTypes } from '@/hooks/use-leave-types';
import { useLeaveAllocations } from '@/hooks/use-leave-allocations';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, AlertCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { LeaveType } from '@/types';

type LeaveDuration = 'full_day' | 'half_day';
type HalfDayPeriod = 'first_half' | 'second_half';

export default function ApplyLeave() {
  const { profile, isPrincipal } = useAuth();
  const navigate = useNavigate();
  const { isValidLeaveDate } = useHolidays();
  const { leaveTypes } = useLeaveTypes();
  const { allocations, refetch: refetchAllocations } = useLeaveAllocations(profile?.id);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);
  const [leaveDuration, setLeaveDuration] = useState<LeaveDuration>('full_day');
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>('first_half');
  const [reason, setReason] = useState('');
  const [document, setDocument] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceDialogMessage, setBalanceDialogMessage] = useState('');
  const [directorEmails, setDirectorEmails] = useState<string[]>([]);

  useEffect(() => {
    fetchDirectorEmails();
  }, []);

  useEffect(() => {
    if (!leaveTypeId || !profile?.id) return;

    const loadedBalance = getBalanceFromLoadedAllocations();
    if (loadedBalance !== null) {
      setAvailableBalance(loadedBalance);
      return;
    }

    fetchLeaveBalance();
  }, [leaveTypeId, profile?.id, allocations]);

  useEffect(() => {
    if (leaveTypeId) {
      const selected = leaveTypes.find(lt => lt.id === leaveTypeId);
      setSelectedLeaveType(selected || null);
    }
  }, [leaveTypeId, leaveTypes]);

  useEffect(() => {
    if (leaveDuration === 'half_day' && startDate) {
      setEndDate(startDate);
    }
  }, [leaveDuration, startDate]);


  const getBalanceFromLoadedAllocations = (): number | null => {
    if (!leaveTypeId) return null;

    const allocation = allocations.find((item) => item.leave_type_id === leaveTypeId);
    if (!allocation) return null;

    const balance = Number(
      allocation.remaining ?? ((allocation.total_allocated ?? 0) - (allocation.used ?? 0)) ?? 0
    );

    return Math.max(0, balance);
  };

  const fetchDirectorEmails = async () => {
    try {
      // Staff users normally cannot read Director profiles because of RLS.
      // This SECURITY DEFINER RPC safely returns only approved Director email addresses.
      const { data, error } = await supabase.rpc('get_approved_director_emails');

      if (error) {
        console.error('Failed to fetch director emails via RPC:', error);
        setDirectorEmails([]);
        return;
      }

      const emails = Array.from(new Set((Array.isArray(data) ? data : []).filter(Boolean))) as string[];
      setDirectorEmails(emails);
    } catch (error) {
      console.error('Failed to fetch director emails:', error);
      setDirectorEmails([]);
    }
  };

  const ensureAndFetchLeaveBalance = async (showError = false): Promise<number> => {
    if (!profile?.id || !leaveTypeId) return 0;

    // Strongest path first: use the same allocation rows already loaded by the portal.
    // This fixes the issue where allocations are visible elsewhere, but Apply Leave still shows 0.
    const loadedBalance = getBalanceFromLoadedAllocations();
    if (loadedBalance !== null) {
      setAvailableBalance(loadedBalance);
      return loadedBalance;
    }

    const currentYear = new Date().getFullYear();

    try {
      // Create missing allocation rows if this user was approved before allocations existed.
      const { error: initError } = await supabase.rpc('initialize_staff_leave_allocations', {
        staff_id_param: profile.id,
      });
      if (initError) console.error('Failed to initialize allocations before balance check:', initError);

      // Refetch the shared allocation hook data.
      await refetchAllocations();

      // Direct table check after initialization. This matches the allocation list used by the rest of the portal.
      const { data: directRows, error: directError } = await supabase
        .from('staff_leave_allocations')
        .select('id,total_allocated,used,remaining,leave_type_id,year')
        .eq('staff_id', profile.id)
        .eq('leave_type_id', leaveTypeId)
        .eq('year', currentYear)
        .limit(1);

      if (directError) throw directError;

      const directAllocation = Array.isArray(directRows) ? directRows[0] : directRows;
      if (directAllocation) {
        const balance = Number(
          directAllocation.remaining ??
          ((directAllocation.total_allocated ?? 0) - (directAllocation.used ?? 0)) ??
          0
        );
        setAvailableBalance(Math.max(0, balance));
        return Math.max(0, balance);
      }

      // Final fallback: SECURITY DEFINER RPC, if it exists in the DB.
      const { data, error } = await supabase.rpc('get_staff_leave_balance_for_type', {
        p_staff_id: profile.id,
        p_leave_type_id: leaveTypeId,
        p_year: currentYear,
      });

      if (error) throw error;

      // Support both possible RPC styles:
      // 1) returns numeric balance
      // 2) returns row/table with remaining,total_allocated,used
      let balance = 0;
      if (typeof data === 'number') {
        balance = data;
      } else {
        const allocation = Array.isArray(data) ? data[0] : data;
        balance = Number(
          allocation?.remaining ??
          ((allocation?.total_allocated ?? 0) - (allocation?.used ?? 0)) ??
          0
        );
      }

      setAvailableBalance(Math.max(0, balance));
      return Math.max(0, balance);
    } catch (error) {
      console.error('Failed to fetch leave balance:', error);
      if (showError) {
        toast.error('No leave allocation found for this leave type. Please contact admin.');
      }
      setAvailableBalance(0);
      return 0;
    }
  };

  const fetchLeaveBalance = async () => {
    await ensureAndFetchLeaveBalance(false);
  };

  const calculateLeaveDays = async (start: Date, end: Date): Promise<number> => {
    if (leaveDuration === 'half_day') return 0.5;
    const { data } = await supabase.rpc('calculate_leave_days', {
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd')
    });
    return Number(data || 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast.error('File size must be less than 1MB');
        return;
      }
      setDocument(file);
    }
  };

  const uploadDocument = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const fileName = `${profile?.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('leave-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('leave-documents')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const getExtraLeaveEmailDetails = () => {
    const to = directorEmails.join(',');
    const subject = `Extra Leave Request - ${profile?.full_name ?? (isPrincipal ? 'Principal / UH' : 'Staff')} - ${selectedLeaveType?.name ?? 'Leave'}`;
    const body = `Dear Director,

I request extra approval for ${selectedLeaveType?.name ?? 'selected leave type'} because my leave allocation is over or insufficient.

${isPrincipal ? 'Principal / UH Details' : 'Staff Details'}:
Name: ${profile?.full_name ?? ''}
Username: ${profile?.username ?? ''}
Phone: ${profile?.phone ?? ''}
Department: ${profile?.department?.name ?? 'N/A'}
College Unit: ${profile?.college_unit ?? 'N/A'}

Requested Leave Details:
Leave Type: ${selectedLeaveType?.name ?? 'N/A'}
Requested Date(s): ${startDate ? format(startDate, 'dd/MM/yyyy') : 'N/A'}${endDate ? ` to ${format(endDate, 'dd/MM/yyyy')}` : ''}
Duration: ${leaveDuration === 'half_day' ? `Half Day (${halfDayPeriod === 'first_half' ? 'First Half' : 'Second Half'})` : 'Full Day'}
Available Balance: ${availableBalance} day(s)

Reason:
${reason.trim() || 'Please type your detailed reason here.'}

Regards,
${profile?.full_name ?? ''}`;

    const encodedTo = encodeURIComponent(to);
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);

    return {
      to,
      subject,
      body,
      mailtoHref: `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`,
      gmailHref: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`,
    };
  };

  const handleExtraLeaveEmailClick = async () => {
    if (directorEmails.length === 0) {
      await fetchDirectorEmails();
      toast.error('No approved Director email found. Please check Director role, approval status, and email.');
      return;
    }

    const email = getExtraLeaveEmailDetails();

    try {
      await navigator.clipboard?.writeText(`To: ${email.to}\nSubject: ${email.subject}\n\n${email.body}`);
    } catch {
      // Clipboard is only a helper. Do not block the email action if copying is unavailable.
    }

    // Desktop browsers often do nothing with mailto: if no default mail app is configured.
    // Gmail compose opens reliably in a new tab. If popups are blocked, fall back to mailto.
    const composeWindow = window.open(email.gmailHref, '_blank', 'noopener,noreferrer');

    if (!composeWindow) {
      window.location.href = email.mailtoHref;
      toast.info('Opening your email app. If it does not open, the email details were copied.');
      return;
    }

    toast.success('Email draft opened. Details were also copied for backup.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!leaveTypeId) {
      toast.error('Please select a leave type');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for leave');
      return;
    }

    if (startDate > endDate) {
      toast.error('End date must be after start date');
      return;
    }

    if (leaveDuration === 'half_day' && format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd')) {
      toast.error('Half-day leave must be for one selected date only');
      return;
    }

    if (!isValidLeaveDate(startDate)) {
      toast.error('Start date is not valid (same day, weekend, or holiday)');
      return;
    }

    setLoading(true);

    try {
      const leaveDays = await calculateLeaveDays(startDate, endDate);

      if (leaveDays === 0) {
        toast.error('No valid leave days in the selected range');
        setLoading(false);
        return;
      }

      const latestBalance = await ensureAndFetchLeaveBalance(true);

      if (latestBalance < leaveDays) {
        setBalanceDialogMessage(`Insufficient leave balance. You need ${leaveDays} day(s), but only ${latestBalance} day(s) are available for ${selectedLeaveType?.name ?? 'this leave type'}.`);
        setBalanceDialogOpen(true);
        setLoading(false);
        return;
      }

      if (leaveDays > 2 && !document && selectedLeaveType?.requires_document) {
        toast.error('Document attachment is mandatory for leaves exceeding 2 days');
        setLoading(false);
        return;
      }

      let documentUrl = null;
      if (document) {
        documentUrl = await uploadDocument(document);
        if (!documentUrl) {
          setLoading(false);
          return;
        }
      }

      const { data: insertedApplication, error: insertError } = await supabase
        .from('leave_applications')
        .insert({
          staff_id: profile?.id,
          leave_type_id: leaveTypeId,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          leave_days: leaveDays,
          leave_duration: leaveDuration,
          half_day_period: leaveDuration === 'half_day' ? halfDayPeriod : null,
          reason: reason.trim(),
          document_url: documentUrl
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (insertedApplication?.id) {
        supabase.functions.invoke('send-leave-review-email', {
          body: {
            applicationId: insertedApplication.id
          }
        }).catch((err: unknown) => console.error('Leave review email failed:', err));
      }

      toast.success(isPrincipal ? 'Leave application submitted to Director for approval!' : 'Leave application submitted to Principal for approval!');
      navigate('/staff/leave-history');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit leave application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <StaffLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">{isPrincipal ? 'Principal Leave Application' : 'Apply for Leave'}</h1>
          <p className="mt-2 text-muted-foreground">{isPrincipal ? 'Submit your own leave request to Director' : 'Submit a new leave application to Principal'}</p>
        </div>

        <Card className="gold-border">
          <CardHeader>
            <CardTitle className="font-playfair-display">Leave Application Form</CardTitle>
            <CardDescription>Fill in the details below to submit your leave request</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type *</Label>
                <Select value={leaveTypeId} onValueChange={setLeaveTypeId} disabled={loading}>
                  <SelectTrigger id="leaveType" className="px-3">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} ({type.annual_allocation} days/year)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {leaveTypeId && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Available Balance:</span>
                    <span className="font-semibold text-primary">{Math.max(0, availableBalance)} days</span>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                <Label>Leave Duration *</Label>
                <RadioGroup value={leaveDuration} onValueChange={(value) => setLeaveDuration(value as LeaveDuration)} className="grid gap-2 sm:grid-cols-2">
                  <Label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background p-3 text-sm hover:bg-muted/40">
                    <RadioGroupItem value="full_day" />
                    Full Day
                  </Label>
                  <Label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background p-3 text-sm hover:bg-muted/40">
                    <RadioGroupItem value="half_day" />
                    Half Day
                  </Label>
                </RadioGroup>
                {leaveDuration === 'half_day' && (
                  <RadioGroup value={halfDayPeriod} onValueChange={(value) => setHalfDayPeriod(value as HalfDayPeriod)} className="grid gap-2 sm:grid-cols-2">
                    <Label className="flex cursor-pointer items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm hover:bg-primary/10">
                      <RadioGroupItem value="first_half" />
                      First Half
                    </Label>
                    <Label className="flex cursor-pointer items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm hover:bg-primary/10">
                      <RadioGroupItem value="second_half" />
                      Second Half
                    </Label>
                  </RadioGroup>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date);
                          if (leaveDuration === 'half_day') setEndDate(date);
                        }}
                        disabled={(date) => !isValidLeaveDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')} disabled={leaveDuration === 'half_day'}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => {
                          if (startDate && date < startDate) return true;
                          return !isValidLeaveDate(date);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {leaveDuration === 'half_day' && <p className="text-xs text-muted-foreground">Half-day leave uses the same start date.</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason for Leave</Label>
                <Textarea
                  id="reason"
                  placeholder="Please provide a detailed reason for your leave request..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={5}
                  className="resize-none px-3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document">Supporting Document (Optional)</Label>
                <div className="flex items-center gap-3">
                  <Input id="document" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="px-3" />
                  {document && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDocument(null)}>Remove</Button>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Max file size: 1MB. Supported formats: PDF, JPG, PNG</p>
                  {startDate && endDate && (
                    <div className="flex items-start gap-2 text-xs">
                      <AlertCircle className="h-3 w-3 mt-0.5 text-amber-600" />
                      <span className="text-amber-600">Document attachment is mandatory for leaves exceeding 2 days when required by leave type</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading || uploading} className="flex-1">
                  {(loading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {uploading ? 'Uploading...' : 'Submit Application'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate('/staff/dashboard')} disabled={loading || uploading}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Important Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• You cannot apply for leave on the same day</p>
            <p>• Leave cannot be applied on weekends or public holidays</p>
            <p>• Full day counts as 1 day and half day counts as 0.5 day</p>
            <p>• Only working days are counted in your leave balance</p>
            <p>• You will receive a notification once your application is reviewed by the {isPrincipal ? 'Director' : 'Principal'}</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-playfair-display gradient-text">Leave Balance Not Available</DialogTitle>
            <DialogDescription>{balanceDialogMessage}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            If this leave is urgent, you can request extra approval by sending an email to the Directors with your reason and supporting details.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBalanceDialogOpen(false)}>Close</Button>
            <Button type="button" onClick={handleExtraLeaveEmailClick}>
              <Mail className="mr-2 h-4 w-4" />
              {directorEmails.length > 0 ? 'Request Extra Leave Approval' : 'Check Director Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}
