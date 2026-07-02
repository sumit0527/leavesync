import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useHolidays } from '@/hooks/use-holidays';
import { useLeaveTypes } from '@/hooks/use-leave-types';
import { format } from 'date-fns';
import { CalendarIcon, Upload, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { LeaveType } from '@/types';

export default function ApplyLeave() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { isValidLeaveDate } = useHolidays();
  const { leaveTypes } = useLeaveTypes();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);
  const [reason, setReason] = useState('');
  const [document, setDocument] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<number>(0);

  useEffect(() => {
    if (leaveTypeId && profile?.id) {
      fetchLeaveBalance();
    }
  }, [leaveTypeId, profile?.id]);

  useEffect(() => {
    if (leaveTypeId) {
      const selected = leaveTypes.find(lt => lt.id === leaveTypeId);
      setSelectedLeaveType(selected || null);
    }
  }, [leaveTypeId, leaveTypes]);

  const fetchLeaveBalance = async () => {
    if (!profile?.id || !leaveTypeId) return;

    const { data } = await supabase
      .from('staff_leave_allocations')
      .select('remaining')
      .eq('staff_id', profile.id)
      .eq('leave_type_id', leaveTypeId)
      .eq('year', new Date().getFullYear())
      .maybeSingle();

    setAvailableBalance(data?.remaining || 0);
  };

  const calculateLeaveDays = async (start: Date, end: Date): Promise<number> => {
    const { data } = await supabase.rpc('calculate_leave_days', {
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd')
    });
    return data || 0;
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

      if (availableBalance < leaveDays) {
        toast.error(`Insufficient leave balance. You need ${leaveDays} days but have ${availableBalance} days available for this leave type`);
        setLoading(false);
        return;
      }

      if (leaveDays > 2 && !document) {
        if (selectedLeaveType?.requires_document) {
          toast.error('Document attachment is mandatory for leaves exceeding 2 days');
          setLoading(false);
          return;
        }
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
        }).catch((err) => console.error('Leave review email failed:', err));
      }

      toast.success(isPrincipal ? 'Leave application submitted to Director for approval!' : 'Leave application submitted to Principal for approval!');
      navigate('/staff/history');
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
          <h1 className="text-3xl font-playfair-display font-bold gradient-text">Apply for Leave</h1>
          <p className="mt-2 text-muted-foreground">Submit a new leave application</p>
        </div>

        <Card className="gold-border">
          <CardHeader>
            <CardTitle className="font-playfair-display">Leave Application Form</CardTitle>
            <CardDescription>
              Fill in the details below to submit your leave request
            </CardDescription>
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
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !startDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
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
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !endDate && 'text-muted-foreground'
                        )}
                      >
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
                <Label htmlFor="document">
                  Supporting Document (Optional)
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="document"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="px-3"
                  />
                  {document && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDocument(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Max file size: 1MB. Supported formats: PDF, JPG, PNG
                  </p>
                  {startDate && endDate && (
                    <div className="flex items-start gap-2 text-xs">
                      <AlertCircle className="h-3 w-3 mt-0.5 text-amber-600" />
                      <span className="text-amber-600">
                        Document attachment is mandatory for leaves exceeding 2 days
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading || uploading} className="flex-1">
                  {(loading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {uploading ? 'Uploading...' : 'Submit Application'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/staff/dashboard')}
                  disabled={loading || uploading}
                >
                  Cancel
                </Button>
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
            <p>• Only working days are counted in your leave balance</p>
            <p>• You will receive a notification once your application is reviewed by the {isPrincipal ? 'Director' : 'Principal'}</p>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  );
}
