import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types';

export type NotificationScope = 'own' | 'all' | 'principal' | 'director';

function isDirectorOnlyNotification(notification: Notification) {
  const text = `${notification.type ?? ''} ${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();
  return (
    text.includes('director') ||
    text.includes('main admin') ||
    text.includes('main_admin') ||
    text.includes('principal registration') ||
    text.includes('principal leave')
  );
}

function isPrincipalOnlyNotification(notification: Notification) {
  const text = `${notification.type ?? ''} ${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();
  return text.includes('principal') && !text.includes('staff');
}

function filterNotificationsByScope(rows: Notification[], scope: NotificationScope) {
  if (scope === 'principal') {
    return rows.filter((notification) => {
      const text = `${notification.type ?? ''} ${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();
      const isStaffRelated = text.includes('staff') || notification.type === 'staff_registration_pending' || notification.type === 'staff_leave_pending';
      return isStaffRelated && !isDirectorOnlyNotification(notification) && !isPrincipalOnlyNotification(notification);
    });
  }

  if (scope === 'director') {
    return rows.filter((notification) => {
      const text = `${notification.type ?? ''} ${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();
      return text.includes('principal') || notification.type === 'principal_registration_pending' || notification.type === 'principal_leave_pending';
    });
  }

  return rows;
}

export function useNotifications(userId?: string, scope: NotificationScope = 'own') {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (scope === 'own' && !userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let rows: Notification[] = [];

      // For management roles, use a security-definer RPC so Principal/Director
      // notification visibility does not break because of old user_id/type values or RLS.
      if (scope === 'principal' || scope === 'director' || scope === 'all') {
        const { data, error } = await supabase.rpc('get_management_notifications', {
          p_scope: scope,
        });

        if (error) throw error;
        rows = (data ?? []) as Notification[];
      } else {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        rows = (data ?? []) as Notification[];
      }

      const scopedRows = filterNotificationsByScope(rows, scope);
      setNotifications(scopedRows);
      setUnreadCount(scopedRows.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);

      // Final fallback: at least try own notifications so the page never looks broken.
      if (userId) {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);

        const fallbackRows = filterNotificationsByScope((data ?? []) as Notification[], scope);
        setNotifications(fallbackRows);
        setUnreadCount(fallbackRows.filter(n => !n.is_read).length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, scope]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    try {
      // Mark only notifications assigned to the logged-in user.
      // This avoids Principal accidentally marking shared/backfilled records for others.
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.user_id === userId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - notifications.filter(n => n.user_id === userId && !n.is_read).length));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
