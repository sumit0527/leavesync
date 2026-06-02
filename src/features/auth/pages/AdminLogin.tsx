import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
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
              <Label htmlFor="adminSecret" className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Admin Secret Key
              </Label>
              <Input
                id="adminSecret"
                type="password"
                placeholder="Enter admin secret key"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                disabled={loading}
                className="px-3"
              />
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
              <Link to="/staff/login" className="text-muted-foreground hover:text-primary">
                Staff Login
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
