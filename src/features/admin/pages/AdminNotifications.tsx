import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, CheckCheck, ClipboardCheck } from 'lucide-react';
import { formatCollegeUnit } from '@/lib/college-units';

export default function AdminNotifications() {
  const { profile, portalRoleLabel, isViewer, isPrincipal, isMainAdmin } = useAuth();

  const notificationScope = isViewer ? 'all' : isPrincipal ? 'principal' : isMainAdmin ? 'director' : 'own';
  const isRequestInbox = isPrincipal || isMainAdmin || isViewer;

  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(
    profile?.id,
    notificationScope
  );

  const pageTitle = isPrincipal
    ? 'Principal Request Inbox'
    : (isMainAdmin || isViewer)
      ? `${portalRoleLabel} Request Inbox`
      : `${portalRoleLabel} Notifications`;

  const description = isPrincipal
    ? 'Only pending staff registrations and pending staff leave requests are shown here. Once handled, they disappear from this inbox.'
    : (isMainAdmin || isViewer)
      ? isViewer
        ? 'Read-only notification view. You can view Director-level pending Principal and staff requests, but cannot mark, approve, reject, or change anything.'
        : 'Director-level request view: pending Principal registrations, pending Principal leave requests, pending staff registrations, and pending staff leave requests are visible here.'
      : 'Read-only notification records.';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-playfair-display font-bold leading-tight gradient-text sm:text-3xl">{pageTitle}</h1>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
          </div>
          {!isViewer && notifications.some(n => !n.is_read) && (
            <Button onClick={markAllAsRead} variant="secondary" size="sm" className="w-full shrink-0 whitespace-normal text-center sm:w-auto sm:whitespace-nowrap">
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                        <ClipboardCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="break-words text-sm leading-snug sm:text-base">{notification.title}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                        {(notification as any).college_unit && (
                          <p className="mt-1 text-[11px] font-medium text-primary">{formatCollegeUnit((notification as any).college_unit)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {(notification as any).college_unit && <Badge variant="outline">{formatCollegeUnit((notification as any).college_unit)}</Badge>}
                      {!notification.is_read && <Badge variant="default">Pending</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="break-words text-sm leading-relaxed text-muted-foreground">{notification.message}</p>
                  {isRequestInbox && (
                    <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      {isViewer
                        ? 'Read-only view: you can view this request, but cannot take action or clear it from here.'
                        : 'Review this request from the correct section. Staff requests are handled by Principal. Principal requests are handled by Director.'}
                    </p>
                  )}
                  {!isViewer && !notification.is_read && (
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
    </AdminLayout>
  );
}
