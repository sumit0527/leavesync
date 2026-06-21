import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Shield, KeyRound, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/db/supabase';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot secret key dialog state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fkStep, setFkStep] = useState<'verify' | 'reset'>('verify');
  const [fkUsername, setFkUsername] = useState('');
  const [fkPassword, setFkPassword] = useState('');
  const [fkNewKey, setFkNewKey] = useState('');
  const [fkConfirmKey, setFkConfirmKey] = useState('');
  const [fkLoading, setFkLoading] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState('');

  const { signInWithUsername } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !adminSecret) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    const { error } = await signInWithUsername(username, password, adminSecret);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Admin login successful!');
      navigate('/admin/dashboard');
    }
  };

  // Step 1: verify admin username + password
  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fkUsername || !fkPassword) {
      toast.error('Please enter your username and password');
      return;
    }
    setFkLoading(true);
    try {
      // Sign in temporarily to verify credentials
      const authEmail = fkUsername.trim().toLowerCase().includes('@')
        ? fkUsername.trim().toLowerCase()
        : `${fkUsername.trim().toLowerCase()}@miaoda.com`;
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: fkPassword });
      if (error) throw new Error('Invalid username or password');

      // Verify it's actually an admin account
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, approval_status')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('This account does not have admin privileges');
      }
      if (profile.approval_status !== 'approved') {
        await supabase.auth.signOut();
        throw new Error('Your admin account is not yet approved');
      }

      setVerifiedUserId(data.user.id);
      // Sign out immediately — we only used this to verify identity
      await supabase.auth.signOut();
      setFkStep('reset');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setFkLoading(false);
    }
  };

  // Step 2: set new secret key
  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fkNewKey || !fkConfirmKey) {
      toast.error('Please fill in both fields');
      return;
    }
    if (fkNewKey.length < 8) {
      toast.error('Secret key must be at least 8 characters');
      return;
    }
    if (fkNewKey !== fkConfirmKey) {
      toast.error('Keys do not match');
      return;
    }
    setFkLoading(true);
    try {
      // Re-authenticate to get a valid session for the RLS-protected update
      const authEmail = fkUsername.trim().toLowerCase().includes('@')
        ? fkUsername.trim().toLowerCase()
        : `${fkUsername.trim().toLowerCase()}@miaoda.com`;
      await supabase.auth.signInWithPassword({ email: authEmail, password: fkPassword });

      const { error } = await supabase
        .from('admin_settings')
        .update({ value: fkNewKey, updated_at: new Date().toISOString() })
        .eq('key', 'admin_secret_key');

      await supabase.auth.signOut();

      if (error) throw new Error('Failed to update secret key: ' + error.message);

      toast.success('Admin secret key updated successfully!');
      setForgotOpen(false);
      setFkStep('verify');
      setFkUsername(''); setFkPassword(''); setFkNewKey(''); setFkConfirmKey('');
      setVerifiedUserId('');
    } catch (err) {
      toast.error((err as Error).message);
      await supabase.auth.signOut();
    } finally {
      setFkLoading(false);
    }
  };

  const closeForgotDialog = () => {
    setForgotOpen(false);
    setFkStep('verify');
    setFkUsername(''); setFkPassword(''); setFkNewKey(''); setFkConfirmKey('');
    setVerifiedUserId('');
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 -z-10 opacity-20">
        <img
          src="https://miaoda-site-img.s3cdn.medo.dev/images/KLing_e87ef494-02d6-4d5f-b79a-57897a413594.jpg"
          alt="Admin Office"
          className="h-full w-full object-cover"
        />
      </div>

      <Card className="w-full max-w-md double-gold-border">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-2 border-primary">
            <img
              src="https://miaoda-conversation-file.s3cdn.medo.dev/user-940k6ouwh91c/conv-bmt0l5ltqby8/20260515/file-bnj2ppyfkutc.png"
              alt="G.D. Sawant College Logo"
              className="h-full w-full object-contain p-2"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-playfair-display gradient-text">Admin Portal</CardTitle>
            <CardDescription className="mt-2">G.D. Sawant College — LeaveSync</CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Admin Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="px-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="px-3"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="adminSecret" className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  Admin Secret Key
                </Label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <KeyRound className="h-3 w-3" />
                  Forgot Secret Key?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="adminSecret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Enter admin secret key"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  disabled={loading}
                  className="px-3 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Required for admin access</p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Admin Sign In
            </Button>
            <div className="text-center text-sm">
              Don't have an admin account?{' '}
              <Link to="/admin/register" className="text-primary hover:underline">
                Register here
              </Link>
            </div>
            <div className="flex items-center justify-center gap-4 text-sm">
              <Link to="/admin/forgot-password" className="text-muted-foreground hover:text-primary">
                Forgot Password
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link to="/admin/forgot-username" className="text-muted-foreground hover:text-primary">
                Forgot Username
              </Link>
            </div>
            <div className="text-center text-sm">
              <Link to="/" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back to Portal
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>

      {/* Forgot Secret Key Dialog */}
      <Dialog open={forgotOpen} onOpenChange={closeForgotDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {fkStep === 'verify' ? 'Verify Your Identity' : 'Set New Secret Key'}
            </DialogTitle>
            <DialogDescription>
              {fkStep === 'verify'
                ? 'Enter your admin username and password to verify your identity before resetting the secret key.'
                : 'Create a new admin secret key. All admins will need to use this new key to log in.'}
            </DialogDescription>
          </DialogHeader>

          {fkStep === 'verify' ? (
            <form onSubmit={handleForgotVerify} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="fk-username">Admin Username</Label>
                <Input
                  id="fk-username"
                  type="text"
                  placeholder="Enter your admin username"
                  value={fkUsername}
                  onChange={(e) => setFkUsername(e.target.value)}
                  disabled={fkLoading}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fk-password">Password</Label>
                <Input
                  id="fk-password"
                  type="password"
                  placeholder="Enter your password"
                  value={fkPassword}
                  onChange={(e) => setFkPassword(e.target.value)}
                  disabled={fkLoading}
                  className="px-3"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={closeForgotDialog} disabled={fkLoading}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={fkLoading}>
                  {fkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Identity
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotReset} className="space-y-4 pt-2">
              <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                ✓ Identity verified for <span className="font-medium text-foreground">{fkUsername}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fk-newkey">New Secret Key</Label>
                <Input
                  id="fk-newkey"
                  type="text"
                  placeholder="Minimum 8 characters"
                  value={fkNewKey}
                  onChange={(e) => setFkNewKey(e.target.value)}
                  disabled={fkLoading}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fk-confirmkey">Confirm New Secret Key</Label>
                <Input
                  id="fk-confirmkey"
                  type="text"
                  placeholder="Re-enter new secret key"
                  value={fkConfirmKey}
                  onChange={(e) => setFkConfirmKey(e.target.value)}
                  disabled={fkLoading}
                  className="px-3"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setFkStep('verify')} disabled={fkLoading}>
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={fkLoading}>
                  {fkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save New Key
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
