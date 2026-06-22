import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle, Clock, XCircle, CalendarDays, History, User } from 'lucide-react';
import { useLeaveStats } from '@/hooks/use-leave-applications';
import { Link } from 'react-router-dom';

const compactCardClass = 'rounded-xl border-border/80 shadow-sm transition hover:border-primary/40 hover:shadow-md';

export default function StaffDashboard() {
  const { profile } = useAuth();
  const { stats } = useLeaveStats(profile?.id);

  const dashboardCards = [
    { title: 'Total Applications', value: stats.total, note: 'All time', icon: FileText, color: 'text-primary' },
    { title: 'Approved', value: stats.approved, note: 'Applications', icon: CheckCircle, color: 'text-green-600' },
    { title: 'Pending', value: stats.pending, note: 'Awaiting review', icon: Clock, color: 'text-yellow-600' },
    { title: 'Rejected', value: stats.rejected, note: 'Applications', icon: XCircle, color: 'text-red-600' },
  ];

  const quickActions = [
    { label: 'Apply Leave', to: '/staff/apply-leave', icon: FileText, variant: 'default' as const },
    { label: 'Leave History', to: '/staff/leave-history', icon: History, variant: 'secondary' as const },
    { label: 'Calendar', to: '/staff/calendar', icon: CalendarDays, variant: 'secondary' as const },
    { label: 'Profile', to: '/staff/profile', icon: User, variant: 'secondary' as const },
  ];

  return (
    <StaffLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-playfair-display font-bold gradient-text">Welcome, {profile?.full_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your leave applications and track your leave balance</p>
        </div>

        <div className="grid grid-cols-2 gap-2 max-w-2xl">
          {dashboardCards.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className={compactCardClass}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2.5 pb-1">
                  <CardTitle className="text-xs font-medium leading-tight sm:text-sm">{item.title}</CardTitle>
                  <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                </CardHeader>
                <CardContent className="p-2.5 pt-0">
                  <div className={`text-lg font-bold sm:text-xl ${item.color}`}>{item.value}</div>
                  <p className="text-[11px] text-muted-foreground sm:text-xs">{item.note}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className={`${compactCardClass} gold-border`}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="font-playfair-display text-lg">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Use these shortcuts to finish common work faster</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="grid grid-cols-2 gap-2 max-w-2xl">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.to} variant={action.variant} size="sm" className="h-9 justify-start gap-2 px-3 text-xs sm:text-sm" asChild>
                    <Link to={action.to}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{action.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  );
}
