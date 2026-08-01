import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, ClipboardCheck } from 'lucide-react';
import { formatCollegeUnit } from '@/lib/college-units';
import type { Notification } from '@/types';

type DisplayNotification = Notification & {
  college_unit?: string | null;
};

export default function AdminNotifications() {
  const { profile, portalRoleLabel, isViewer, isPrincipal, isMainAdmin } = useAuth();

  const notificationScope = isViewer
    ? 'all'
    : isPrincipal
      ? 'principal'
      : isMainAdmin
        ? 'director'
        : 'own';

  const { notifications, loading } = useNotifications(
    profile?.id,
    notificationScope
  );

  const pendingNotifications = notifications as DisplayNotification[];

  const pageTitle = isPrincipal
    ? `${formatCollegeUnit((profile as any)?.college_unit)} Principal / UH Notifications`
    : `${portalRoleLabel} Notifications`;

  const description = isPrincipal
    ? `Only currently pending staff registrations and leave requests from ${formatCollegeUnit((profile as any)?.college_unit)} are shown.`
    : 'Only currently pending Principal/UH registrations and leave requests from all units are shown.';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-playfair-display font-bold gradient-text sm:text-3xl">
            {pageTitle}
          </h1>
          <p className="mt-2 max-w-4xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading pending notifications...
            </CardContent>
          </Card>
        ) : pendingNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 font-medium">No pending notifications</p>
              <p className="mt-1 text-sm text-muted-foreground">
                There are currently no registrations or leave applications waiting for review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingNotifications.map((notification) => (
              <Card
                key={`${notification.type}-${notification.id}`}
                className="border-amber-500/50 bg-amber-500/5"
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-amber-500/10 p-2 text-amber-700">
                        <ClipboardCheck className="h-4 w-4" />
                      </div>

                      <div>
                        <CardTitle className="break-words text-sm leading-snug sm:text-base">
                          {notification.title}
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
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
                      : 'This notification will disappear automatically after the request is approved or rejected.'}
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
