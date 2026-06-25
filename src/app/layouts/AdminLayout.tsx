import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  History, 
  Calendar, 
  Bell, 
  BarChart3, 
  Menu, 
  LogOut,
  Shield,
  Users,
  Building2,
  CalendarDays,
  ClipboardList
} from 'lucide-react';
import { useState } from 'react';
import { useNotifications } from '@/hooks/use-notifications';

interface AdminLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Employees', href: '/admin/employees', icon: Users },
  { name: 'Departments', href: '/admin/departments', icon: Building2 },
  { name: 'Leave Types', href: '/admin/leave-types', icon: CalendarDays },
  { name: 'View Leave', href: '/admin/view-leave', icon: ClipboardList },
  { name: 'All Applications', href: '/admin/applications', icon: History },
  { name: 'Leave Calendar', href: '/admin/calendar', icon: Calendar },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Notifications', href: '/admin/notifications', icon: Bell },
  { name: 'My Profile', href: '/admin/profile', icon: Shield },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isViewer } = useAuth();
  const { unreadCount } = useNotifications(profile?.id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const NavContent = () => (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border p-6">
        <Link
          to="/admin/dashboard"
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
            <h2 className="font-playfair-display text-lg font-semibold gradient-text">{isViewer ? 'Viewer Portal' : 'Admin Portal'}</h2>
            <p className="text-xs text-sidebar-foreground">G.D Sawant College</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
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
          <p className="mt-2 text-xs text-primary">{isViewer ? 'Viewer (Read Only)' : 'Administrator'}</p>
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
            <h1 className="font-playfair-display text-lg font-semibold gradient-text">Admin Portal</h1>
          </div>
          <Link
            to="/admin/dashboard"
            className="hidden md:flex items-center gap-3 rounded-md transition-opacity hover:opacity-90"
            title="Go to dashboard"
          >
            <img 
              src="https://miaoda-conversation-file.s3cdn.medo.dev/user-940k6ouwh91c/conv-bmt0l5ltqby8/20260515/file-bnj2ppyfkutc.png" 
              alt="G.D. Sawant College" 
              className="h-12 w-12 object-contain"
            />
            <div>
              <h1 className="font-playfair-display text-xl font-bold gradient-text">Admin Portal</h1>
              <p className="text-xs text-muted-foreground">G.D. Sawant College</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Link to="/admin/notifications">
                <Button variant="ghost" size="icon" className="relative text-sidebar-foreground hover:bg-sidebar-accent">
                  <Bell className="h-5 w-5" />
                  <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-xs">
                    {unreadCount}
                  </Badge>
                </Button>
              </Link>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
