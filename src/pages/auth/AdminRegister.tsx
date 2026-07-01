import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Shield, Eye, EyeOff } from 'lucide-react';
import { sendRegistrationReviewEmail } from '@/lib/email-notifications';

export default function AdminRegister() {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUpWithUsername } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreed) {
      toast.error('Please agree to the User Agreement and Privacy Policy');
      return;
    }

    if (!username || !fullName || !password || !confirmPassword || !adminSecret) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await signUpWithUsername(
      username,
      password,
      fullName,
      '',
      '',
      '',
      '',
      adminSecret,
      'principal'
    );
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    try {
      await sendRegistrationReviewEmail({ applicantUsername: username, applicantRole: 'principal' });
    } catch (emailError) {
      console.error('Principal / UH registration email failed:', emailError);
      toast.warning('Registration saved, but Director email could not be sent. Director can still review from the portal.');
    }

    toast.success('Principal / UH registration submitted! Director approval is required before login.');
    navigate('/admin/login');
  };

  const PasswordToggle = ({ show, onClick }: { show: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      tabIndex={-1}
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 -z-10 opacity-20">
        <img
          src="https://miaoda-site-img.s3cdn.medo.dev/images/KLing_e87ef494-02d6-4d5f-b79a-57897a413594.jpg"
          alt="Principal Office"
          className="h-full w-full object-contain p-2"
        />
      </div>

      <Card className="w-full max-w-md double-gold-border">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-card">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-playfair-display gradient-text">Principal / UH Registration</CardTitle>
            <CardDescription className="mt-2">
              Register as Principal / UH. Director approval is required before login.
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              Only approved Principal / UH accounts are allowed. After registration, a Director must approve this account.
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Enter principal / UH full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                className="px-3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="px-3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="px-3 pr-10"
                />
                <PasswordToggle show={showPassword} onClick={() => setShowPassword((prev) => !prev)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="px-3 pr-10"
                />
                <PasswordToggle show={showConfirmPassword} onClick={() => setShowConfirmPassword((prev) => !prev)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminSecret">Management Secret Key</Label>
              <div className="relative">
                <Input
                  id="adminSecret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Enter management secret key"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  disabled={loading}
                  className="px-3 pr-10"
                />
                <PasswordToggle show={showSecret} onClick={() => setShowSecret((prev) => !prev)} />
              </div>
              <p className="text-xs text-muted-foreground">Contact Director/college administration for the secret key</p>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
                disabled={loading}
              />
              <label htmlFor="terms" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                I agree to the User Agreement and Privacy Policy
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Principal / UH Registration
            </Button>

            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link to="/admin/login" className="text-primary hover:underline">
                Sign in here
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
