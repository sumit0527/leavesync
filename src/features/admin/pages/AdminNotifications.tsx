import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, CheckCheck, ClipboardCheck } from 'lucide-react';

export default function AdminNotifications() {
  const { profile, portalRoleLabel, isViewer, isPrincipal, isMainAdmin } = useAuth();

  const notificationScope = isViewer ? 'all' : isPrincipal ? 'principal' : isMainAdmin ? 'director' : 'own';
  const isRequestInbox = isPrincipal || isMainAdmin;

  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(
    profile?.id,
    notificationScope
  );

  const pageTitle = isPrincipal
    ? 'Principal Request Inbox'
    : isMainAdmin
      ? 'Director Request Inbox'
      : `${portalRoleLabel} Notifications`;

  const description = isPrincipal
    ? 'Only pending staff registrations and pending staff leave requests are shown here. Once handled, they disappear from this inbox.'
    : isMainAdmin
      ? 'Only pending Principal registrations and pending Principal leave requests are shown here. Once handled, they disappear from this inbox.'
      : 'Read-only notification records.';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">{pageTitle}</h1>
            <p className="mt-2 text-muted-foreground">{description}</p>
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
              <p className="mt-4 font-medium">No pending requests</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isPrincipal
                  ? 'There are no staff registrations or staff leave requests waiting for Principal action.'
                  : isMainAdmin
                    ? 'There are no Principal registrations or Principal leave requests waiting for Director action.'
                    : 'No notifications yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`transition-all ${!notification.is_read ? 'border-primary/70 bg-primary/5' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                        <ClipboardCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{notification.title}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    {!notification.is_read && <Badge variant="default">Pending</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  {isRequestInbox && (
                    <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      Review this request from the correct section. Staff requests are handled by Principal. Principal requests are handled by Director.
                    </p>
                  )}
                  {!isViewer && !notification.is_read && (
                    <Button size="sm" variant="outline" onClick={() => markAsRead(notification.id)}>
                      Mark as Read
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
