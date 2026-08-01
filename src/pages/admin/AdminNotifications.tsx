import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { AlertCircle, Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { formatCollegeUnit } from '@/lib/college-units';

export default function AdminNotifications() {
  const { profile, portalRoleLabel, isViewer, isPrincipal, isMainAdmin } = useAuth();

  const scope = isViewer ? 'all' : isPrincipal ? 'principal' : isMainAdmin ? 'director' : 'own';
  const {
    notifications,
    loading,
    errorMessage,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications(profile?.id, scope);

  const pageTitle = isPrincipal
    ? `${formatCollegeUnit((profile as any)?.college_unit)} Principal / UH Notifications`
    : `${portalRoleLabel} Notifications`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-playfair-display font-bold leading-tight gradient-text sm:text-3xl">
              {pageTitle}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Only unread, relevant alerts are shown. Mark an alert as read and it disappears from this inbox.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {notifications.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full whitespace-normal sm:w-auto sm:whitespace-nowrap"
                onClick={markAllAsRead}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all as read
              </Button>
            )}
          </div>
        </div>

        {errorMessage && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading notifications...
            </CardContent>
          </Card>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Bell className="mx-auto h-11 w-11 text-muted-foreground" />
              <p className="mt-4 font-medium">You are all caught up</p>
              <p className="mt-1 text-sm text-muted-foreground">
                New pending requests and personal leave updates will appear here automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card key={notification.id} className="border-primary/50 bg-primary/[0.03]">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                      <Badge>New</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="break-words text-sm leading-relaxed text-muted-foreground">
                    {notification.message}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => markAsRead(notification.id)}
                  >
                    Mark as Read
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
