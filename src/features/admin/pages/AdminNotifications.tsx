import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, CheckCheck, UserCheck, FileText, ShieldCheck, Eye, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import type { Notification } from '@/types';

type NotificationContext = {
  source: string;
  action: string;
  tone: 'principal' | 'director' | 'success' | 'danger' | 'neutral';
  icon: typeof Bell;
  summary: string;
  needsReview: boolean;
};

function normalize(notification: Notification) {
  return `${notification.type ?? ''} ${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();
}

function getStatus(notification: Notification): 'pending' | 'approved' | 'rejected' | 'record' | 'info' {
  const text = normalize(notification);

  if (text.includes('reject')) return 'rejected';
  if (text.includes('approved') || text.includes('approve')) return 'approved';
  if (text.includes('already available') || text.includes('record') || text.includes('existing')) return 'record';
  if (text.includes('pending') || text.includes('needs')) return 'pending';

  return 'info';
}

function getNotificationContext(notification: Notification): NotificationContext {
  const searchable = normalize(notification);
  const status = getStatus(notification);
  const isStaffRegistration = searchable.includes('staff') && searchable.includes('registration');
  const isStaffLeave = searchable.includes('staff') && (searchable.includes('leave') || searchable.includes('application'));
  const isPrincipalRegistration = searchable.includes('principal') && searchable.includes('registration');
  const isPrincipalLeave = searchable.includes('principal') && (searchable.includes('leave') || searchable.includes('application'));

  if (isStaffRegistration) {
    if (status === 'pending') {
      return {
        source: 'Staff Registration',
        action: 'Review Required',
        tone: 'principal',
        icon: UserCheck,
        summary: 'A new staff account is waiting for Principal approval.',
        needsReview: true,
      };
    }

    if (status === 'approved') {
      return {
        source: 'Staff Registration',
        action: 'Already Approved',
        tone: 'success',
        icon: CheckCircle2,
        summary: 'This staff account is already approved. No review action is needed.',
        needsReview: false,
      };
    }

    if (status === 'rejected') {
      return {
        source: 'Staff Registration',
        action: 'Rejected',
        tone: 'danger',
        icon: XCircle,
        summary: 'This staff registration was rejected. No pending action remains.',
        needsReview: false,
      };
    }

    return {
      source: 'Staff Registration',
      action: 'Record Only',
      tone: 'neutral',
      icon: UserCheck,
      summary: 'This is a staff registration record. No pending review is required.',
      needsReview: false,
    };
  }

  if (isStaffLeave) {
    if (status === 'pending') {
      return {
        source: 'Staff Leave Request',
        action: 'Review Required',
        tone: 'principal',
        icon: FileText,
        summary: 'A staff leave application is waiting for Principal approval.',
        needsReview: true,
      };
    }

    if (status === 'approved') {
      return {
        source: 'Staff Leave Request',
        action: 'Already Approved',
        tone: 'success',
        icon: CheckCircle2,
        summary: 'This staff leave request has already been approved.',
        needsReview: false,
      };
    }

    if (status === 'rejected') {
      return {
        source: 'Staff Leave Request',
        action: 'Rejected',
        tone: 'danger',
        icon: XCircle,
        summary: 'This staff leave request has already been rejected.',
        needsReview: false,
      };
    }

    return {
      source: 'Staff Leave Request',
      action: 'Information',
      tone: 'neutral',
      icon: FileText,
      summary: 'Staff leave-related information.',
      needsReview: false,
    };
  }

  if (isPrincipalRegistration) {
    if (status === 'pending') {
      return {
        source: 'Principal Registration',
        action: 'Director Review Required',
        tone: 'director',
        icon: ShieldCheck,
        summary: 'A Principal account is waiting for Director approval.',
        needsReview: true,
      };
    }

    return {
      source: 'Principal Registration',
      action: status === 'approved' ? 'Already Approved' : status === 'rejected' ? 'Rejected' : 'Record Only',
      tone: status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'neutral',
      icon: status === 'approved' ? CheckCircle2 : status === 'rejected' ? XCircle : ShieldCheck,
      summary: status === 'approved'
        ? 'This Principal account is already approved.'
        : status === 'rejected'
          ? 'This Principal registration was rejected.'
          : 'This is a Principal registration record.',
      needsReview: false,
    };
  }

  if (isPrincipalLeave) {
    if (status === 'pending') {
      return {
        source: 'Principal Leave Request',
        action: 'Director Review Required',
        tone: 'director',
        icon: FileText,
        summary: 'A Principal leave application is waiting for Director approval.',
        needsReview: true,
      };
    }

    return {
      source: 'Principal Leave Request',
      action: status === 'approved' ? 'Already Approved' : status === 'rejected' ? 'Rejected' : 'Information',
      tone: status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'neutral',
      icon: status === 'approved' ? CheckCircle2 : status === 'rejected' ? XCircle : FileText,
      summary: status === 'approved'
        ? 'This Principal leave request has already been approved.'
        : status === 'rejected'
          ? 'This Principal leave request has already been rejected.'
          : 'Principal leave-related information.',
      needsReview: false,
    };
  }

  return {
    source: 'System Notification',
    action: 'Information',
    tone: 'neutral',
    icon: Bell,
    summary: 'System update or record notification.',
    needsReview: false,
  };
}

function badgeVariant(tone: NotificationContext['tone']) {
  if (tone === 'success') return 'default' as const;
  if (tone === 'danger') return 'destructive' as const;
  if (tone === 'director') return 'default' as const;
  return 'outline' as const;
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
    ? 'Director notifications show Principal registrations and Principal leave requests only.'
    : isPrincipal
      ? 'Principal notifications show staff registrations and staff leave requests only.'
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
                  className={`transition-all ${!notification.is_read ? 'border-primary bg-primary/5' : ''}`}
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
                            <Badge variant={badgeVariant(context.tone)}>
                              {context.needsReview && <Clock3 className="mr-1 h-3 w-3" />}
                              {context.action}
                            </Badge>
                            {isViewer && (
                              <Badge variant="outline" className="gap-1">
                                <Eye className="h-3 w-3" /> Read Only
                              </Badge>
                            )}
                            {!notification.is_read && <Badge variant="default">New</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <p className="text-xs text-muted-foreground sm:text-right">
                          {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                        {canMarkRead && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            Mark as Read
                          </Button>
                        )}
                      </div>
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
