import { useAuth } from '@/contexts/AuthContext';
import StaffLayout from '@/components/layouts/StaffLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';

export default function Notifications() {
  const { profile, isPrincipal } = useAuth();
  const { notifications, loading, markAsRead, markAllAsRead, refetch } =
    useNotifications(profile?.id);

  return (
    <StaffLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-playfair-display font-bold leading-tight gradient-text sm:text-3xl">
              {isPrincipal ? 'My Leave Notifications' : 'Notifications'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Only unread updates are shown. Marking one as read removes it from this inbox.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {notifications.length > 0 && (
              <Button
                onClick={markAllAsRead}
                variant="secondary"
                size="sm"
                className="w-full whitespace-normal sm:w-auto sm:whitespace-nowrap"
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Mark all as read
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading notifications...
            </CardContent>
          </Card>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 font-medium">You are all caught up</p>
              <p className="mt-1 text-sm text-muted-foreground">
                New leave updates will appear here automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card key={notification.id} className="border-primary/50">
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
                    <Badge className="w-fit">New</Badge>
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
    </StaffLayout>
  );
}
