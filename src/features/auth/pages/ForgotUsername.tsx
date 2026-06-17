import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, User } from 'lucide-react';

interface ForgotUsernameProps {
  role?: 'staff' | 'admin';
}

export default function ForgotUsername({ role = 'staff' }: ForgotUsernameProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundUsername, setFoundUsername] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');

  const backLink = role === 'admin' ? '/admin/login' : '/staff/login';
  const forgotPasswordLink = role === 'admin' ? '/admin/forgot-password' : '/staff/forgot-password';

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Please enter your registered phone number');
      return;
    }
    setLoading(true);
    try {
      const { data: matches, error } = await supabase
        .rpc('find_username_by_phone', {
          p_phone: phone.replace(/\s/g, ''),
          p_role: role,
        });

      if (error) throw error;

      if (!matches || matches.length === 0) {
        toast.error('No account found with this phone number');
        return;
      }

      setFoundUsername(matches[0].username);
      setFullName(matches[0].full_name || '');
      toast.success('Account found!');
    } catch (err: any) {
      toast.error(err.message ?? 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFoundUsername(null);
    setFullName('');
    setPhone('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md gold-border">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-playfair-display text-2xl gradient-text">
            Forgot Username
          </CardTitle>
          <CardDescription>
            {foundUsername ? 'Your username has been found' : 'Enter your phone number to recover your username'}
          </CardDescription>
        </CardHeader>

        {!foundUsername ? (
          <form onSubmit={handleLookup}>
            <CardContent className="space-y-4">
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
                Enter your registered phone number and we will find your username.
              </p>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Find My Username
              </Button>
              <Link to={backLink} className="flex items-center gap-1 text-sm text-primary hover:underline">
                <ArrowLeft className="h-3 w-3" />
                Back to Login
              </Link>
            </CardFooter>
          </form>
        ) : (
          <>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <User className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">{fullName}</p>
                    <p className="text-lg font-bold text-primary">@{foundUsername}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Your username is displayed above. You can now log in with this username.
              </p>
              <p className="text-sm text-muted-foreground">
                Also forgot your password?{' '}
                <Link to={forgotPasswordLink} className="font-medium text-primary hover:underline">
                  Reset Password
                </Link>
              </p>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Link to={backLink} className="w-full">
                <Button className="w-full">
                  Back to Login
                </Button>
              </Link>
              <Button variant="secondary" className="w-full" onClick={handleReset}>
                Look Up Another Account
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
