import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types';

export type NotificationScope = 'own' | 'all' | 'principal' | 'director';
export type PortalNotification = Notification;

/**
 * Notification inbox rules:
 * - The database creates a notification only for the exact intended recipient.
 * - This hook loads unread notifications only.
 * - Marking a notification as read removes it from the visible inbox immediately.
 * - The notification page is not an approval queue; pending work remains available
 *   in the relevant Registration / View Leave pages even after the alert is read.
 */
export function useNotifications(userId?: string, _scope: NotificationScope = 'own') {
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
        .limit(50);

      if (error) throw error;
      setNotifications((data ?? []) as PortalNotification[]);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      if (!silent) setNotifications([]);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to load notifications.'
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    // Realtime insert/update events make new alerts appear without requiring a demo
    // refresh. A periodic refresh remains as a safe fallback.
    // Several parts of the portal use this hook at the same time (layout badge +
    // notifications page). Supabase does not allow adding postgres_changes
    // callbacks to an already-subscribed channel, so every hook instance must use
    // its own unique channel name.
    const channelName = `notifications-${userId}-${Date.now()}-${Math.random()
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
  }, [fetchNotifications, userId]);

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;

    // Optimistic removal keeps the inbox calm and uncluttered.
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
      throw error;
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
      throw error;
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
