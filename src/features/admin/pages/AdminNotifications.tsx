import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, CheckCheck } from 'lucide-react';

export default function AdminNotifications() {
  const { profile, portalRoleLabel, isViewer, isPrincipal, isMainAdmin } = useAuth();

  // Principal and Director see notifications assigned to their own account.
  // Viewer can see all notifications in read-only mode for record checking.
  const notificationScope = isViewer ? 'all' : 'own';

  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(
    profile?.id,
    notificationScope
  );

  const pageTitle = `${portalRoleLabel} Notifications`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">{pageTitle}</h1>
            <p className="mt-2 text-muted-foreground">{isMainAdmin ? 'Director notifications for Principal-level approvals and monitoring' : isPrincipal ? 'Principal notifications for staff registrations and staff leave applications' : 'Read-only notification records'}</p>
          </div>
          {!isViewer && notifications.some(n => !n.is_read) && (
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
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`transition-all ${!notification.is_read ? 'border-primary' : ''} ${!isViewer ? 'cursor-pointer' : ''}`}
                onClick={() => !isViewer && !notification.is_read && markAsRead(notification.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
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
    </AdminLayout>
  );
}
