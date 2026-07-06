import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, CheckCheck } from 'lucide-react';

function isPrincipalManagementNotification(notification: any) {
  const text = `${notification.title ?? ''} ${notification.message ?? ''} ${notification.type ?? ''}`.toLowerCase();
  return (
    text.includes('staff registration pending') ||
    text.includes('staff leave request pending') ||
    text.includes('staff_registration_pending') ||
    text.includes('staff_leave_pending') ||
    text.includes('review required') ||
    text.includes('request inbox')
  );
}

export default function Notifications() {
  const { profile, isPrincipal } = useAuth();
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(profile?.id);

  const visibleNotifications = isPrincipal
    ? notifications.filter((notification) => !isPrincipalManagementNotification(notification))
    : notifications;

  const markVisibleAsRead = async () => {
    if (!isPrincipal) {
      await markAllAsRead();
      return;
    }
    await Promise.all(visibleNotifications.filter(n => !n.is_read).map(n => markAsRead(n.id)));
  };

  return (
    <StaffLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-playfair-display font-bold leading-tight gradient-text sm:text-3xl">{isPrincipal ? 'Principal Leave Notifications' : 'Notifications'}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{isPrincipal ? 'Only your own Principal leave/account updates appear here' : 'Stay updated on your leave applications'}</p>
          </div>
          {visibleNotifications.some(n => !n.is_read) && (
            <Button onClick={markVisibleAsRead} variant="secondary" size="sm" className="w-full shrink-0 whitespace-normal text-center sm:w-auto sm:whitespace-nowrap">
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : visibleNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`transition-all ${!notification.is_read ? 'border-primary' : ''}`}
              >
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <CardTitle className="break-words text-sm leading-snug sm:text-base">{notification.title}</CardTitle>
                    {!notification.is_read && <Badge variant="default" className="w-fit">New</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="break-words text-sm leading-relaxed text-muted-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                  {!notification.is_read && (
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => markAsRead(notification.id)}>
                      Mark as Read
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
