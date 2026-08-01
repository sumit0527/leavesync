import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, CheckCheck, ClipboardCheck, Info } from 'lucide-react';
import { formatCollegeUnit } from '@/lib/college-units';
import type { Notification } from '@/types';

type DisplayNotification = Notification & {
  __source?: 'request' | 'personal';
  college_unit?: string | null;
};

export default function AdminNotifications() {
  const { profile, portalRoleLabel, isViewer, isPrincipal, isMainAdmin } = useAuth();

  const notificationScope = isViewer ? 'all' : isPrincipal ? 'principal' : isMainAdmin ? 'director' : 'own';

  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(
    profile?.id,
    notificationScope
  );

  const displayNotifications = notifications as DisplayNotification[];
  const pendingRequests = displayNotifications.filter(
    (notification) => notification.__source === 'request'
  );
  const personalUpdates = displayNotifications.filter(
    (notification) => notification.__source !== 'request'
  );

  const pageTitle = isPrincipal
    ? 'Principal Notifications'
    : (isMainAdmin || isViewer)
      ? `${portalRoleLabel} Notifications`
      : `${portalRoleLabel} Notifications`;

  const description = isPrincipal
    ? 'Pending staff requests and updates about your own leave applications are shown separately.'
    : isViewer
      ? 'Read-only view of pending management requests and portal updates.'
      : 'Pending management requests and updates about your own leave applications are shown separately.';

  const renderNotification = (
    notification: DisplayNotification,
    kind: 'request' | 'personal'
  ) => {
    const isPendingRequest = kind === 'request';

    return (
      <Card
        key={`${kind}-${notification.id}`}
        className={`transition-all ${
          isPendingRequest
            ? 'border-amber-500/50 bg-amber-500/5'
            : !notification.is_read
              ? 'border-primary/70 bg-primary/5'
              : ''
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`mt-0.5 rounded-full p-2 ${
                  isPendingRequest
                    ? 'bg-amber-500/10 text-amber-700'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {isPendingRequest ? (
                  <ClipboardCheck className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
              </div>

              <div>
                <CardTitle className="break-words text-sm leading-snug sm:text-base">
                  {notification.title}
                </CardTitle>

                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                </p>

                {notification.college_unit && (
                  <p className="mt-1 text-[11px] font-medium text-primary">
                    {formatCollegeUnit(notification.college_unit)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              {notification.college_unit && (
                <Badge variant="outline">
                  {formatCollegeUnit(notification.college_unit)}
                </Badge>
              )}

              {isPendingRequest ? (
                <Badge className="bg-amber-600 hover:bg-amber-600">
                  Pending Action
                </Badge>
              ) : !notification.is_read ? (
                <Badge variant="default">Unread</Badge>
              ) : (
                <Badge variant="secondary">Read</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="break-words text-sm leading-relaxed text-muted-foreground">
            {notification.message}
          </p>

          {isPendingRequest && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {isViewer
                ? 'Read-only: this request is still awaiting action by the authorised approver.'
                : 'This request is still awaiting your action. Open the appropriate pending applications or registration section to review it.'}
            </p>
          )}

          {!isViewer && (
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => markAsRead(notification.id)}
              disabled={!isPendingRequest && notification.is_read}
            >
              {isPendingRequest ? 'Dismiss from inbox' : 'Mark as Read'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-playfair-display font-bold leading-tight gradient-text sm:text-3xl">
              {pageTitle}
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>

          {!isViewer && displayNotifications.some((notification) => !notification.is_read) && (
            <Button
              onClick={markAllAsRead}
              variant="secondary"
              size="sm"
              className="w-full shrink-0 whitespace-normal text-center sm:w-auto sm:whitespace-nowrap"
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Clear notifications
            </Button>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : displayNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 font-medium">No notifications</p>
              <p className="mt-1 text-sm text-muted-foreground">
                There are no pending requests or personal updates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Pending Requests</h2>
                <p className="text-sm text-muted-foreground">
                  Only requests that still require approval or review are shown here.
                </p>
              </div>

              {pendingRequests.length === 0 ? (
                <Card>
                  <CardContent className="p-5 text-sm text-muted-foreground">
                    No requests are currently waiting for your action.
                  </CardContent>
                </Card>
              ) : (
                pendingRequests.map((notification) =>
                  renderNotification(notification, 'request')
                )
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Personal Updates</h2>
                <p className="text-sm text-muted-foreground">
                  Approved, rejected and other completed updates about your own account or leave are shown here.
                </p>
              </div>

              {personalUpdates.length === 0 ? (
                <Card>
                  <CardContent className="p-5 text-sm text-muted-foreground">
                    No personal updates are available.
                  </CardContent>
                </Card>
              ) : (
                personalUpdates.map((notification) =>
                  renderNotification(notification, 'personal')
                )
              )}
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
