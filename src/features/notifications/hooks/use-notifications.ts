import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types';

export type NotificationScope = 'own' | 'all' | 'principal' | 'director';

function notificationText(notification: Notification) {
  return `${notification.type ?? ''} ${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();
}

function isDirectorOnlyNotification(notification: Notification) {
  const text = notificationText(notification);
  return (
    text.includes('director') ||
    text.includes('main admin') ||
    text.includes('main_admin') ||
    text.includes('principal registration') ||
    text.includes('principal leave')
  );
}

function isPrincipalOnlyNotification(notification: Notification) {
  const text = notificationText(notification);
  return text.includes('principal') && !text.includes('staff');
}

function isStaffRelatedNotification(notification: Notification) {
  const staffTypes = new Set([
    'staff_registration_pending',
    'staff_registration_approved',
    'staff_registration_rejected',
    'staff_registration_record',
    'new_staff_registration',
    'staff_registration',
    'staff_leave_pending',
    'staff_leave_approved',
    'staff_leave_rejected',
    'staff_leave_application',
  ]);

  const text = notificationText(notification);
  return staffTypes.has(String(notification.type ?? '')) || text.includes('staff');
}

function filterNotificationsByScope(rows: Notification[], scope: NotificationScope) {
  if (scope === 'principal') {
    return rows.filter((notification) => {
      return (
        isStaffRelatedNotification(notification) &&
        !isDirectorOnlyNotification(notification) &&
        !isPrincipalOnlyNotification(notification)
      );
    });
  }

  if (scope === 'director') {
    return rows.filter((notification) => {
      const text = notificationText(notification);
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
