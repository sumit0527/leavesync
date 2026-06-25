import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Mail, Phone, MapPin, AtSign, Shield, Edit3, Save, X, Loader2, KeyRound, Lock } from 'lucide-react';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminProfile() {
  const { profile, refreshProfile, isViewer } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
  });

  // Password change state
  const [pwDialog, setPwDialog] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Admin secret key change state
  const [secretDialog, setSecretDialog] = useState(false);
  const [currentSecret, setCurrentSecret] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');
  const [secretLoading, setSecretLoading] = useState(false);

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
          updated_at: new Date().toISOString(),
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

  const handlePasswordChange = async () => {
    if (!newPw || newPw.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match');
      return;
    }
    setPwLoading(true);
    try {
      const email = `${profile?.username}@miaoda.com`;
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPw });
      if (signInError) {
        toast.error('Current password is incorrect');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) throw updateError;
      toast.success('Password changed successfully');
      setPwDialog(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const handleSecretKeyChange = async () => {
    if (!currentSecret.trim()) {
      toast.error('Please enter the current secret key');
      return;
    }
    if (!newSecret.trim() || newSecret.trim().length < 6) {
      toast.error('New secret key must be at least 6 characters');
      return;
    }
    if (newSecret !== confirmSecret) {
      toast.error('Secret keys do not match');
      return;
    }
    setSecretLoading(true);
    try {
      // Verify current secret key from DB
      const { data: setting, error: fetchErr } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'admin_secret_key')
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!setting) throw new Error('Secret key setting not found');

      if (setting.value !== currentSecret.trim()) {
        toast.error('Current secret key is incorrect');
        return;
      }

      const { error: updateErr } = await supabase
        .from('admin_settings')
        .update({ value: newSecret.trim(), updated_at: new Date().toISOString() })
        .eq('key', 'admin_secret_key');

      if (updateErr) throw updateErr;
      toast.success('Admin secret key updated successfully');
      setSecretDialog(false);
      setCurrentSecret(''); setNewSecret(''); setConfirmSecret('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update secret key');
    } finally {
      setSecretLoading(false);
    }
  };

  const openPwDialog = () => {
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setPwDialog(true);
  };

  const openSecretDialog = () => {
    setCurrentSecret(''); setNewSecret(''); setConfirmSecret('');
    setSecretDialog(true);
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">My Profile</h1>
            <p className="mt-2 text-muted-foreground">{isViewer ? 'View your viewer profile details' : 'Manage your admin profile and security settings'}</p>
          </div>
          {!isViewer && (!editing ? (
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
          ))}
        </div>

        {/* Profile Card */}
        <Card className="gold-border">
          <CardHeader>
            <CardTitle className="font-playfair-display">Personal Information</CardTitle>
            <CardDescription>{isViewer ? 'Viewer account details' : 'Administrator account details'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input id="full_name" value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} className="px-3" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
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
                  { icon: MapPin, label: 'Address', value: profile?.address || 'Not provided' },
                  { icon: Shield, label: 'Role', value: isViewer ? 'Viewer (Read Only)' : 'Administrator' },
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
                  <Shield className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Account Status</p>
                    <Badge className="bg-green-600/20 text-green-600">{isViewer ? 'Active Viewer' : 'Active Administrator'}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-border p-3 md:col-span-2">
                  <User className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Account Created</p>
                    <p className="text-sm font-medium">
                      {profile?.created_at ? format(new Date(profile.created_at), 'PPP') : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Card */}
        {!isViewer && (
          <Card>
          <CardHeader>
            <CardTitle className="font-playfair-display">Security Settings</CardTitle>
            <CardDescription>Manage your password and admin secret key</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={openPwDialog} variant="secondary">
              <KeyRound className="mr-2 h-4 w-4" />
              Change Password
            </Button>
            <Button onClick={openSecretDialog} variant="secondary">
              <Lock className="mr-2 h-4 w-4" />
              Change Admin Secret Key
            </Button>
          </CardContent>
          </Card>
        )}

        {/* Change Password Dialog */}
        <Dialog open={pwDialog} onOpenChange={setPwDialog}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-playfair-display">Change Password</DialogTitle>
              <DialogDescription>Enter your current password and a new password below</DialogDescription>
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

        {/* Change Admin Secret Key Dialog */}
        <Dialog open={secretDialog} onOpenChange={setSecretDialog}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-playfair-display">Change Admin Secret Key</DialogTitle>
              <DialogDescription>
                The admin secret key is required when registering new admin accounts. Keep it confidential.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentSecret">Current Secret Key</Label>
                <Input id="currentSecret" type="password" value={currentSecret} onChange={e => setCurrentSecret(e.target.value)} disabled={secretLoading} className="px-3" placeholder="Enter current key" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newSecret">New Secret Key</Label>
                <Input id="newSecret" type="password" value={newSecret} onChange={e => setNewSecret(e.target.value)} disabled={secretLoading} className="px-3" placeholder="Min 6 characters" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmSecret">Confirm New Secret Key</Label>
                <Input id="confirmSecret" type="password" value={confirmSecret} onChange={e => setConfirmSecret(e.target.value)} disabled={secretLoading} className="px-3" />
              </div>
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <strong>Important:</strong> After changing the secret key, ensure all existing admins are informed of the new key. The old key will no longer work for new admin registrations.
              </p>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setSecretDialog(false)} disabled={secretLoading}>Cancel</Button>
              <Button onClick={handleSecretKeyChange} disabled={secretLoading}>
                {secretLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Secret Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
