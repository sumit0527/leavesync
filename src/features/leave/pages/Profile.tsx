import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, User, Mail, Phone, MapPin, AtSign, Award, Loader2, Edit3, Save, X, KeyRound } from 'lucide-react';
import { useLeaveStats } from '@/hooks/use-leave-applications';
import { useLeaveAllocations } from '@/hooks/use-leave-allocations';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { Badge } from '@/components/ui/badge';
import { generateProfileReport, downloadWorkbook } from '@/lib/excel-report';


export default function Profile() {
  const { profile, refreshProfile, isPrincipal } = useAuth();
  const { stats } = useLeaveStats(profile?.id);
  const { allocations, loading: allocationsLoading } = useLeaveAllocations(profile?.id);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
  });

  // Password change
  const [pwDialog, setPwDialog] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const startEdit = () => {
    setFormData({
      full_name: profile?.full_name ?? '',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      address: profile?.address ?? '',
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const handlePasswordChange = async () => {
    if (!newPw || newPw.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      const email = `${profile?.username}@miaoda.com`;
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
      if (signInErr) { toast.error('Current password is incorrect'); return; }
      const { error: updErr } = await supabase.auth.updateUser({ password: newPw });
      if (updErr) throw updErr;
      toast.success('Password changed successfully');
      setPwDialog(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const openPwDialog = () => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwDialog(true); };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
        })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const downloadFullReport = () => {
    const wb = generateProfileReport({
      full_name: profile?.full_name || '',
      username: profile?.username || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      address: profile?.address || '',
      role: isPrincipal ? 'Principal' : 'Staff Member',
      stats,
      allocations: allocations.map(a => ({
        leave_type: a.leave_type?.name || 'N/A',
        total_allocated: a.total_allocated,
        used: a.used,
        remaining: a.remaining,
      })),
    });
    downloadWorkbook(wb, `profile_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <StaffLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">My Profile</h1>
            <p className="mt-2 text-muted-foreground">View and update your profile information</p>
          </div>
          {!editing ? (
            <Button onClick={startEdit} variant="secondary">
              <Edit3 className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={cancelEdit} variant="secondary" disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Personal Information */}
        <Card className="gold-border">
          <CardHeader>
            <CardTitle className="font-playfair-display">Personal Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input id="full_name" value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} className="px-3" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="px-3" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="px-3" placeholder="+91 XXXXXXXXXX" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} className="px-3" placeholder="Your address" />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { icon: User, label: 'Full Name', value: profile?.full_name },
                  { icon: AtSign, label: 'Username', value: `@${profile?.username}` },
                  { icon: Mail, label: 'Email', value: profile?.email || 'Not provided' },
                  { icon: Phone, label: 'Phone', value: profile?.phone || 'Not provided' },
                  { icon: Award, label: 'Role', value: isPrincipal ? 'Principal' : 'Staff Member' },
                  { icon: MapPin, label: 'Address', value: profile?.address || 'Not provided' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 rounded-md border border-border p-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium break-words">{value}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-md border border-border p-3 md:col-span-2">
                  <Award className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Account Status</p>
                    <Badge variant="secondary" className={profile?.approval_status === 'approved' ? 'bg-green-600/20 text-green-600' : ''}>
                      {profile?.approval_status}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Allocation — red cards exactly matching the reference design */}
        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display text-primary">Leave Allocation</CardTitle>
            <CardDescription>
              Your leave balance for {new Date().getFullYear()} — counts update automatically when applications are approved
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allocationsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : allocations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No leave allocations found. Please contact the Director/administration office.
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {allocations.map((allocation) => {
                  const used = allocation.used ?? 0;
                  const total = allocation.total_allocated;
                  const remaining = Math.max(0, total - used);
                  const isExhausted = remaining === 0 && total > 0;
                  const isOver = used > total;
                  const name = allocation.leave_type?.name ?? 'Leave';
                  // Abbreviation: first letter of each word
                  const abbr = name
                    .split(/\s+/)
                    .map((w: string) => w[0]?.toUpperCase() ?? '')
                    .join('')
                    .slice(0, 4);
                  return (
                    <div
                      key={allocation.id}
                      className="rounded-lg bg-primary p-4 space-y-2 shadow-md"
                    >
                      {/* Title row */}
                      <p className="font-bold text-sm text-primary-foreground leading-snug text-pretty">
                        {name}{abbr ? ` (${abbr})` : ''}
                      </p>

                      {/* Stats */}
                      <div className="space-y-1 text-sm text-primary-foreground/90">
                        <p>Total: {total}</p>
                        <p>Used: {used}</p>

                        {/* Remaining line with a contrasting pill for the number */}
                        <div className="flex items-center gap-2">
                          <span>Remaining:</span>
                          <span className="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold bg-white/20 text-primary-foreground min-w-[1.75rem]">
                            {remaining}
                          </span>
                        </div>
                      </div>

                      {/* Exhausted / over-limit warning */}
                      {(isExhausted || isOver) && (
                        <p className="mt-1 rounded bg-white/20 px-2 py-1 text-xs font-semibold text-primary-foreground">
                          {isOver
                            ? 'Limit exceeded — no further applications supported'
                            : 'All leaves used — no further applications supported'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">Leave Statistics</CardTitle>
            <CardDescription>Your application summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { label: 'Total Applications', value: stats.total, color: 'text-foreground' },
                { label: 'Approved', value: stats.approved, color: 'text-green-600' },
                { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
                { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-md border border-border p-4">
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">Account Actions</CardTitle>
            <CardDescription>Download reports or update your security settings</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row">
            <Button onClick={downloadFullReport} variant="secondary" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download Full Report
            </Button>
            <Button onClick={openPwDialog} variant="secondary" className="flex-1">
              <KeyRound className="mr-2 h-4 w-4" />
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Change Password Dialog */}
        <Dialog open={pwDialog} onOpenChange={setPwDialog}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-playfair-display">Change Password</DialogTitle>
              <DialogDescription>Enter your current password and choose a new one</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPw">Current Password</Label>
                <Input id="currentPw" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} disabled={pwLoading} className="px-3" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPw">New Password</Label>
                <Input id="newPw" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} disabled={pwLoading} className="px-3" placeholder="Min 6 characters" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPw">Confirm New Password</Label>
                <Input id="confirmPw" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} disabled={pwLoading} className="px-3" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setPwDialog(false)} disabled={pwLoading}>Cancel</Button>
              <Button onClick={handlePasswordChange} disabled={pwLoading}>
                {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StaffLayout>
  );
}
