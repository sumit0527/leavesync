import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types';

export type NotificationScope = 'own' | 'all' | 'principal' | 'director';
export type PortalNotification = Notification & {
  __source?: 'request' | 'personal';
};

export function useNotifications(userId?: string, scope: NotificationScope = 'own') {
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setErrorMessage(null);

      const personalPromise = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (scope === 'own') {
        const { data, error } = await personalPromise;
        if (error) throw error;

        const personalRows = ((data ?? []) as Notification[]).map((row) => ({
          ...row,
          __source: 'personal' as const,
        }));

        setNotifications(personalRows);
        setUnreadCount(personalRows.filter((row) => !row.is_read).length);
        return;
      }

      // Management portals contain two strictly separated sources:
      // 1. Current pending requests for this approver's exact scope.
      // 2. The signed-in user's own leave/account updates only.
      const [requestResult, personalResult] = await Promise.all([
        supabase.rpc('get_management_notifications'),
        personalPromise,
      ]);

      if (requestResult.error) {
        console.error('Management notification RPC failed:', requestResult.error);
        setErrorMessage('Pending requests could not be loaded. Run the final notification SQL migration in Supabase.');
      }

      if (personalResult.error) {
        console.error('Personal notifications failed:', personalResult.error);
        setErrorMessage((current) => current ?? 'Your personal notifications could not be loaded.');
      }

      const requestRows = requestResult.error
        ? []
        : (((requestResult.data ?? []) as Notification[]).map((row) => ({
            ...row,
            __source: 'request' as const,
            is_read: false,
          })) as PortalNotification[]);

      const personalRows = personalResult.error
        ? []
        : (((personalResult.data ?? []) as Notification[]).map((row) => ({
            ...row,
            __source: 'personal' as const,
          })) as PortalNotification[]);

      const rows = [...requestRows, ...personalRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(rows);
      setUnreadCount(
        requestRows.length + personalRows.filter((row) => !row.is_read).length
      );
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load notifications.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, scope]);

  useEffect(() => {
    fetchNotifications();

    // A lightweight refresh keeps management pending lists accurate even when
    // approval happens from another browser or from an email action link.
    const intervalId = window.setInterval(() => {
      fetchNotifications(true);
    }, 30_000);

    const refreshOnFocus = () => fetchNotifications(true);
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;

    const target = notifications.find((row) => row.id === notificationId);
    if (target?.__source === 'request') return;

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
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      const newlyRead = notifications.filter(
        (row) => row.__source !== 'request' && !row.is_read
      ).length;

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.__source === 'request'
            ? notification
            : { ...notification, is_read: true }
        )
      );
      setUnreadCount((previous) => Math.max(0, previous - newlyRead));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    errorMessage,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
