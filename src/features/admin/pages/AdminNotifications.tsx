import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications, type PortalNotification } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, ClipboardCheck, CheckCheck, AlertCircle } from 'lucide-react';
import { formatCollegeUnit } from '@/lib/college-units';

export default function AdminNotifications() {
  const { profile, portalRoleLabel, isViewer, isPrincipal, isMainAdmin } = useAuth();

  const notificationScope = isViewer
    ? 'all'
    : isPrincipal
      ? 'principal'
      : isMainAdmin
        ? 'director'
        : 'own';

  const {
    notifications,
    loading,
    errorMessage,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications(profile?.id, notificationScope);

  const pendingNotifications = notifications.filter(
    (notification) => notification.__source === 'request'
  );

  const personalNotifications = notifications.filter(
    (notification) => notification.__source !== 'request'
  );

  const unreadPersonalCount = personalNotifications.filter(
    (notification) => !notification.is_read
  ).length;

  const pageTitle = isPrincipal
    ? `${formatCollegeUnit((profile as any)?.college_unit)} Principal / UH Notifications`
    : `${portalRoleLabel} Notifications`;

  const pendingDescription = isPrincipal
    ? `Only pending staff registrations and staff leave requests from ${formatCollegeUnit((profile as any)?.college_unit)} are shown here.`
    : 'Only pending Principal/UH registrations and Principal/UH leave requests from all units are shown here.';

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-playfair-display font-bold gradient-text sm:text-3xl">
              {pageTitle}
            </h1>
            <p className="mt-2 max-w-4xl text-sm text-muted-foreground sm:text-base">
              Pending work and your own leave/account updates are shown separately.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>

        {errorMessage && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <ClipboardCheck className="h-5 w-5 text-amber-600" />
              Pending Requests
              {pendingNotifications.length > 0 && (
                <Badge className="bg-amber-600 hover:bg-amber-600">
                  {pendingNotifications.length}
                </Badge>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{pendingDescription}</p>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Loading notifications...
              </CardContent>
            </Card>
          ) : pendingNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 font-medium">No pending requests</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nothing is currently waiting for review in your authorised scope.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingNotifications.map((notification: PortalNotification) => (
                <Card
                  key={`request-${notification.type}-${notification.id}`}
                  className="border-amber-500/50 bg-amber-500/5"
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="break-words text-sm leading-snug sm:text-base">
                          {notification.title}
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {notification.college_unit && (
                          <Badge variant="outline">
                            {formatCollegeUnit(notification.college_unit)}
                          </Badge>
                        )}
                        <Badge className="bg-amber-600 hover:bg-amber-600">
                          Pending Action
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="break-words text-sm leading-relaxed text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      {isViewer
                        ? 'Read-only: this request is waiting for the authorised approver.'
                        : 'This item disappears automatically when the request is approved or rejected.'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Bell className="h-5 w-5 text-primary" />
                My Updates
                {unreadPersonalCount > 0 && (
                  <Badge variant="destructive">{unreadPersonalCount}</Badge>
                )}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Updates about your own leave applications and account only.
              </p>
            </div>
            {unreadPersonalCount > 0 && (
              <Button variant="secondary" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>

          {!loading && personalNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No personal updates yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {personalNotifications.map((notification: PortalNotification) => (
                <Card
                  key={`personal-${notification.id}`}
                  className={!notification.is_read ? 'border-primary/60' : ''}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="break-words text-sm leading-snug sm:text-base">
                          {notification.title}
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      <Badge variant={notification.is_read ? 'outline' : 'default'}>
                        {notification.is_read ? 'Read' : 'New'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="break-words text-sm leading-relaxed text-muted-foreground">
                      {notification.message}
                    </p>
                    {!notification.is_read && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsRead(notification.id)}
                      >
                        Mark as Read
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
