import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types';

export type NotificationScope = 'own' | 'all' | 'principal' | 'director';
export type PortalNotification = Notification;

function notificationType(notification: PortalNotification) {
  return String(notification.type ?? '').toLowerCase().trim();
}

function isManagementNotification(notification: PortalNotification) {
  const type = notificationType(notification);
  const text = `${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();

  return (
    type.startsWith('staff_registration_pending:') ||
    type.startsWith('management_registration_pending:') ||
    type === 'staff_leave_pending' ||
    type === 'management_leave_pending' ||
    type === 'live_leave_urgent' ||
    type === 'staff_leave_escalated' ||
    text.includes('registration pending') ||
    text.includes('leave request pending') ||
    text.includes('urgent leave') ||
    text.includes('review required')
  );
}

function isPrincipalManagementNotification(notification: PortalNotification) {
  const type = notificationType(notification);
  const text = `${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();

  return (
    type.startsWith('staff_registration_pending:') ||
    type === 'staff_leave_pending' ||
    type === 'live_leave_urgent' ||
    type === 'staff_leave_escalated' ||
    text.includes('staff registration pending') ||
    text.includes('staff leave request pending') ||
    text.includes('urgent leave')
  );
}

function filterForScope(rows: PortalNotification[], scope: NotificationScope) {
  if (scope === 'own') return rows.filter((row) => !isManagementNotification(row));
  if (scope === 'principal') return rows.filter(isPrincipalManagementNotification);
  if (scope === 'director' || scope === 'all') return rows.filter(isManagementNotification);
  return rows;
}

function dedupeNotifications(rows: PortalNotification[]) {
  const seen = new Set<string>();
  const result: PortalNotification[] = [];

  for (const row of rows) {
    const type = notificationType(row);
    const title = String(row.title ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    const message = String(row.message ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    const combined = `${type} ${title} ${message}`;
    const registrationEvent = type.startsWith('staff_registration_pending:') || type.startsWith('management_registration_pending:')
      ? type
      : '';
    const eventKind = combined.includes('urgent') || combined.includes('review required')
      ? 'urgent'
      : combined.includes('expired')
        ? 'expired'
        : combined.includes('approved')
          ? 'approved'
          : combined.includes('rejected')
            ? 'rejected'
            : combined.includes('submitted')
              ? 'submitted'
              : combined.includes('pending')
                ? 'pending'
                : type || title;
    const key = registrationEvent
      || (row.related_application_id ? `${row.related_application_id}|${eventKind}` : `${eventKind}|${title}|${message}`);

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

function friendlyNotificationError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const text = raw.toLowerCase();
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'Notifications could not be loaded because the connection was interrupted. Please check your internet and tap Refresh.';
  }
  if (text.includes('jwt') || text.includes('unauthorized') || text.includes('401')) {
    return 'Your login session has expired. Please sign in again to view notifications.';
  }
  if (text.includes('permission') || text.includes('policy') || text.includes('403')) {
    return 'You do not have permission to view these notifications from this portal.';
  }
  return 'Notifications could not be loaded right now. Please tap Refresh. If the problem continues, contact the portal administrator.';
}

/**
 * Notification inbox rules:
 * - Database rows belong to one exact recipient.
 * - "own" is the personal My Leave inbox only.
 * - "principal" is the Principal/UH management inbox for staff work in that unit.
 * - "director" / "all" are management inboxes for Director/Viewer.
 * - Duplicate rows are collapsed in the UI as an additional safety net.
 * - Marking a notification as read removes it immediately.
 */
export function useNotifications(userId?: string, scope: NotificationScope = 'own') {
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!userId) {
      setNotifications([]);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      const scopedRows = filterForScope((data ?? []) as PortalNotification[], scope);
      setNotifications(dedupeNotifications(scopedRows));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      if (!silent) setNotifications([]);
      setErrorMessage(friendlyNotificationError(error));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [scope, userId]);

  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    const channelName = `notifications-${userId}-${scope}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchNotifications(true)
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Notification realtime channel ${status}; polling remains active.`);
        }
      });

    const intervalId = window.setInterval(() => fetchNotifications(true), 30_000);
    const refreshOnFocus = () => fetchNotifications(true);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, scope, userId]);

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;

    const previous = notifications;
    setNotifications((rows) => rows.filter((row) => row.id !== notificationId));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      setNotifications(previous);
      throw new Error('Could not mark this notification as read. Please try again.');
    }
  };

  const markAllAsRead = async () => {
    if (!userId || notifications.length === 0) return;

    const previous = notifications;
    const ids = notifications.map((row) => row.id);
    setNotifications([]);

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .in('id', ids);

    if (error) {
      console.error('Failed to mark all notifications as read:', error);
      setNotifications(previous);
      throw new Error('Could not mark the notifications as read. Please try again.');
    }
  };

  return {
    notifications,
    unreadCount: notifications.length,
    loading,
    errorMessage,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
