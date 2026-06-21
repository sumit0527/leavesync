import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, KeyRound, User } from 'lucide-react';

interface ForgotCredentialsProps {
  role?: 'staff' | 'admin';
}

export default function ForgotCredentials({ role = 'staff' }: ForgotCredentialsProps) {
  const [step, setStep] = useState<'verify' | 'found' | 'change-password'>('verify');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundUser, setFoundUser] = useState<{ id: string; full_name: string; email: string | null } | null>(null);

  const backLink = role === 'admin' ? '/admin/login' : '/staff/login';

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !phone.trim()) {
      toast.error('Please enter both username and phone number');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('verify_user_credentials', {
          p_username: username.trim(),
          p_phone: phone.replace(/\s/g, ''),
          p_role: role,
        })
        .maybeSingle();

      if (error) throw error;
      const userData = data as { id: string; full_name: string; email: string | null } | null;
      if (!userData) {
        toast.error('No account found with this username');
        return;
      }
      setFoundUser({ id: userData.id, full_name: userData.full_name, email: userData.email });
      setStep('found');
      toast.success(`Account verified for ${userData.full_name}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      if (!foundUser) {
        throw new Error('Please verify your identity first.');
      }

      const { data: success, error } = await supabase.rpc('reset_password_by_verified_identity', {
        p_username: username.trim().toLowerCase(),
        p_phone: phone.replace(/\s/g, ''),
        p_role: role,
        p_new_password: newPassword,
      });

      if (error) throw error;
      if (!success) {
        throw new Error('Password reset failed. Please verify your username and phone number again.');
      }

      toast.success('Password reset successfully! You can now log in with your new password.');
      setStep('verify');
      setUsername('');
      setPhone('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message ?? 'Unable to reset password. Please contact your administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md gold-border">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-playfair-display text-2xl gradient-text">
            Forgot Credentials
          </CardTitle>
          <CardDescription>
            {step === 'verify' ? 'Verify your identity to reset your password' :
             step === 'found' ? `Account found! Choose an option below` :
             'Set your new password'}
          </CardDescription>
        </CardHeader>

        {step === 'verify' && (
          <form onSubmit={handleVerify}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Registered Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your username and registered phone number to verify your identity.
              </p>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Identity
              </Button>
              <Link to={backLink} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <ArrowLeft className="h-3 w-3" />
                Back to Login
              </Link>
            </CardFooter>
          </form>
        )}

        {step === 'found' && foundUser && (
          <>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <User className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">{foundUser.full_name}</p>
                    <p className="text-xs text-muted-foreground">@{username}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Your username is: <span className="font-bold text-foreground">@{username}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                To reset your password, click below. You will need your administrator's help to complete the process.
              </p>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button className="w-full" onClick={() => setStep('change-password')}>
                <KeyRound className="mr-2 h-4 w-4" />
                Reset Password
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => setStep('verify')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </CardFooter>
          </>
        )}

        {step === 'change-password' && (
          <form onSubmit={handleChangePassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Note: Password reset requires administrator assistance. Please contact your admin if you encounter issues.
              </p>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Reset Request
              </Button>
              <Button variant="secondary" className="w-full" type="button" onClick={() => setStep('found')} disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
