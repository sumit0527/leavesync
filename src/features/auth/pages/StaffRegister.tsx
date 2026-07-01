import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartments } from '@/hooks/use-departments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { sendRegistrationReviewEmail } from '@/lib/email-notifications';

export default function StaffRegister() {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const { signUpWithUsername } = useAuth();
  const { departments, loading: deptLoading } = useDepartments();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreed) {
      toast.error('Please agree to the User Agreement and Privacy Policy');
      return;
    }

    if (!username || !fullName || !email || !phone || !address || !departmentId || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      toast.error('Please enter a valid 10-digit phone number');
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
    const { error } = await signUpWithUsername(username, password, fullName, phone, email, address, departmentId);
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    try {
      await sendRegistrationReviewEmail({ applicantUsername: username, applicantRole: 'staff' });
    } catch (emailError) {
      console.error('Staff registration email failed:', emailError);
      toast.warning('Registration saved, but Principal / UH email could not be sent. Principal / UH can still review from the portal.');
    }

    setShowSuccessDialog(true);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 -z-10 opacity-20">
        <img
          src="https://miaoda-site-img.s3cdn.medo.dev/images/KLing_6c476016-c27a-4f96-9ea3-8132b9754858.jpg"
          alt="College Campus"
          className="h-full w-full object-contain p-2"
        />
      </div>

      <Card className="w-full max-w-2xl gold-border">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-2 border-primary">
            <img
              src="https://miaoda-conversation-file.s3cdn.medo.dev/user-940k6ouwh91c/conv-bmt0l5ltqby8/20260515/file-bnj2ppyfkutc.png"
              alt="G.D. Sawant College Logo"
              className="h-full w-full object-contain p-2"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-playfair-display gradient-text">Staff Registration</CardTitle>
            <CardDescription className="mt-2">Create your staff account</CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="10-digit number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  disabled={loading}
                  className="px-3"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId} disabled={loading || deptLoading}>
                <SelectTrigger id="department" className="px-3">
                  {deptLoading ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading departments...
                    </span>
                  ) : (
                    <SelectValue placeholder="Select your department" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {departments.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      No departments available
                    </div>
                  ) : (
                    departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Textarea
                id="address"
                placeholder="Enter your complete address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
                className="px-3"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>
            </div>

            <div className="flex items-start space-x-2 pt-2">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked as boolean)}
                disabled={loading}
              />
              <label htmlFor="terms" className="text-sm leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                I agree to the User Agreement and Privacy Policy (By using this system, you agree to the terms of service)
              </label>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register
            </Button>

            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link to="/staff/login" className="text-primary hover:underline">
                Sign in here
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>

      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-playfair-display gradient-text">
              Registration Successful!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base space-y-3 pt-2">
              <p>
                Thank you for registering with G.D. Sawant College Leave Management System.
              </p>
              <p className="font-medium text-foreground">
                Your account is currently pending approval by the Principal.
              </p>
              <p>
                You will receive a notification once your account has been reviewed. Please check back later or contact the Principal office for any queries.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => navigate('/staff/login')} className="w-full">
              Go to Login
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
