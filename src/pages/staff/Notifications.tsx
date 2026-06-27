import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, CheckCheck } from 'lucide-react';

export default function Notifications() {
  const { profile, isPrincipal } = useAuth();
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(profile?.id);

  const visibleNotifications = isPrincipal
    ? notifications.filter((notification) => {
        const text = `${notification.title} ${notification.message} ${notification.type}`.toLowerCase();
        // Principal self-leave portal should show only their own account/leave updates,
        // not management/request notifications such as Director or Principal registration alerts.
        if (text.includes('director registration') || text.includes('principal registration') || text.includes('review required') || text.includes('request inbox')) return false;
        return text.includes('leave') || text.includes('account approved') || text.includes('account rejected') || text.includes('password');
      })
    : notifications;

  return (
    <StaffLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">{isPrincipal ? 'Principal Leave Notifications' : 'Notifications'}</h1>
            <p className="mt-2 text-muted-foreground">{isPrincipal ? 'Only your own Principal leave/account updates appear here' : 'Stay updated on your leave applications'}</p>
          </div>
          {visibleNotifications.some(n => !n.is_read) && (
            <Button onClick={markAllAsRead} variant="secondary">
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark All as Read
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
                className={`cursor-pointer transition-all ${!notification.is_read ? 'border-primary' : ''}`}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{notification.title}</CardTitle>
                    {!notification.is_read && <Badge variant="default">New</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
