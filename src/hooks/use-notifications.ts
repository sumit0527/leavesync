import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types';

export type NotificationScope = 'own' | 'all' | 'principal' | 'director';

export function useNotifications(userId?: string, scope: NotificationScope = 'own') {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (scope === 'principal' || scope === 'director' || scope === 'all') {
        // Management notification inbox is generated from current database state.
        // It contains ONLY records that are still pending and already applies:
        // - Principal/UH: same-unit staff registrations and staff leave requests
        // - Director/Viewer: Principal/UH registrations and Principal/UH leave requests
        const { data, error } = await supabase.rpc('get_management_notifications', {
          p_scope: scope,
        });

        if (error) throw error;

        const rows = ((data ?? []) as Notification[]).map((row) => ({
          ...row,
          __source: 'request',
          is_read: false,
        })) as Notification[];

        setNotifications(rows);
        setUnreadCount(rows.length);
        return;
      }

      // Staff portal: personal stored notifications only.
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const rows = (data ?? []) as Notification[];
      setNotifications(rows);
      setUnreadCount(rows.filter((notification) => !notification.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId, scope]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    // Pending management requests must remain visible until they are actually
    // approved or rejected. They cannot be dismissed as "read".
    if (scope !== 'own' || !userId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );
      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    // Management requests are live pending work items and cannot be cleared.
    if (scope !== 'own' || !userId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications((previous) =>
        previous.map((notification) => ({ ...notification, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
