import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, CheckCheck, UserCheck, FileText, ShieldCheck, Eye } from 'lucide-react';
import type { Notification } from '@/types';

function getNotificationContext(notification: Notification) {
  const searchable = `${notification.type ?? ''} ${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();

  if (searchable.includes('staff') && searchable.includes('registration')) {
    return {
      source: 'Staff Registration',
      action: 'Needs Principal Review',
      tone: 'principal',
      icon: UserCheck,
      summary: 'A staff account registration needs Principal approval or review.',
    };
  }

  if (searchable.includes('staff') && (searchable.includes('leave') || searchable.includes('application'))) {
    return {
      source: 'Staff Leave Request',
      action: 'Needs Principal Review',
      tone: 'principal',
      icon: FileText,
      summary: 'A staff leave application needs Principal approval or review.',
    };
  }

  if (searchable.includes('principal') && searchable.includes('registration')) {
    return {
      source: 'Principal Registration',
      action: 'Needs Director Review',
      tone: 'director',
      icon: ShieldCheck,
      summary: 'A Principal account registration needs Director approval or review.',
    };
  }

  if (searchable.includes('principal') && (searchable.includes('leave') || searchable.includes('application'))) {
    return {
      source: 'Principal Leave Request',
      action: 'Needs Director Review',
      tone: 'director',
      icon: FileText,
      summary: 'A Principal leave application needs Director approval or review.',
    };
  }

  return {
    source: 'System Notification',
    action: 'Information',
    tone: 'neutral',
    icon: Bell,
    summary: 'System update or record notification.',
  };
}

export default function AdminNotifications() {
  const { profile, portalRoleLabel, isViewer, isPrincipal, isMainAdmin } = useAuth();

  const notificationScope = isViewer ? 'all' : isPrincipal ? 'principal' : isMainAdmin ? 'director' : 'own';

  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications(
    profile?.id,
    notificationScope
  );

  const pageTitle = `${portalRoleLabel} Notifications`;
  const pageDescription = isMainAdmin
    ? 'Director notifications only show Principal-related approvals and monitoring.'
    : isPrincipal
      ? 'Principal notifications only show staff registrations and staff leave applications.'
      : isViewer
        ? 'Viewer can read notification records only. Action controls are hidden.'
        : 'Your latest notifications and updates.';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-playfair-display font-bold gradient-text">{pageTitle}</h1>
            <p className="mt-2 text-muted-foreground">{pageDescription}</p>
          </div>
          {!isViewer && notifications.some(n => !n.is_read && n.user_id === profile?.id) && (
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
              <p className="mt-2 text-sm text-muted-foreground">
                {isPrincipal
                  ? 'Only staff registration and staff leave notifications will appear here.'
                  : isMainAdmin
                    ? 'Only Principal registration and Principal leave notifications will appear here.'
                    : 'No matching records found.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const context = getNotificationContext(notification);
              const ContextIcon = context.icon;
              const canMarkRead = !isViewer && notification.user_id === profile?.id && !notification.is_read;

              return (
                <Card
                  key={notification.id}
                  className={`transition-all ${!notification.is_read ? 'border-primary bg-primary/5' : ''} ${canMarkRead ? 'cursor-pointer hover:shadow-md' : ''}`}
                  onClick={() => canMarkRead && markAsRead(notification.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          <ContextIcon className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <CardTitle className="text-base">{notification.title}</CardTitle>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{context.source}</Badge>
                            <Badge variant={context.tone === 'director' ? 'default' : 'outline'}>{context.action}</Badge>
                            {isViewer && (
                              <Badge variant="outline" className="gap-1">
                                <Eye className="h-3 w-3" /> Read Only
                              </Badge>
                            )}
                            {!notification.is_read && <Badge variant="default">New</Badge>}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground sm:text-right">
                        {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm font-medium text-foreground/90">{context.summary}</p>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
