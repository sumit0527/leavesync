import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  Calendar, 
  Bell, 
  User, 
  Menu, 
  LogOut 
} from 'lucide-react';
import { useState } from 'react';
import { useNotifications } from '@/hooks/use-notifications';

interface StaffLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
  { name: 'Apply Leave', href: '/staff/apply-leave', icon: FileText },
  { name: 'Leave History', href: '/staff/leave-history', icon: History },
  { name: 'Leave Calendar', href: '/staff/calendar', icon: Calendar },
  { name: 'Notifications', href: '/staff/notifications', icon: Bell },
  { name: 'Profile', href: '/staff/profile', icon: User },
];

export default function StaffLayout({ children }: StaffLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications(profile?.id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/staff/login');
  };

  const NavContent = () => (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border p-6">
        <Link
          to="/staff/dashboard"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center space-x-3 rounded-md transition-opacity hover:opacity-90"
          title="Go to dashboard"
        >
          <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-primary">
            <img
              src="https://miaoda-conversation-file.s3cdn.medo.dev/user-940k6ouwh91c/conv-bmt0l5ltqby8/20260515/file-bnj2ppyfkutc.png"
              alt="G.D. Sawant College Logo"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div>
            <h2 className="font-playfair-display text-lg font-semibold gradient-text">leaveSYNC</h2>
            <p className="text-xs text-sidebar-foreground">G.D Sawant College</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          const showBadge = item.name === 'Notifications' && unreadCount > 0;

          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </div>
              {showBadge && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 rounded-md bg-sidebar-accent p-3">
          <p className="text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
          <p className="text-xs text-muted-foreground">@{profile?.username}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        <NavContent />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-8">
          <div className="flex items-center gap-4 md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-sidebar p-0">
                <NavContent />
              </SheetContent>
            </Sheet>
            <h1 className="font-playfair-display text-lg font-semibold gradient-text">leaveSYNC</h1>
          </div>
          <Link
            to="/staff/dashboard"
            className="hidden md:flex items-center gap-3 rounded-md transition-opacity hover:opacity-90"
            title="Go to dashboard"
          >
            <img 
              src="https://miaoda-conversation-file.s3cdn.medo.dev/user-940k6ouwh91c/conv-bmt0l5ltqby8/20260515/file-bnj2ppyfkutc.png" 
              alt="G.D. Sawant College" 
              className="h-12 w-12 object-contain"
            />
            <div>
              <h1 className="font-playfair-display text-xl font-bold gradient-text">leaveSYNC</h1>
              <p className="text-xs text-muted-foreground">G.D. Sawant College</p>
            </div>
          </Link>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-x-hidden p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
