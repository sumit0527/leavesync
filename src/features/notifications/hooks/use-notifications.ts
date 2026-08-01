import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types';

export type NotificationScope = 'own' | 'all' | 'principal' | 'director';

function getDismissedKey(userId: string | undefined, scope: NotificationScope) {
  return `leavesync-dismissed-notifications:${userId ?? 'guest'}:${scope}`;
}

function readDismissedIds(userId: string | undefined, scope: NotificationScope): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getDismissedKey(userId, scope));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDismissedIds(userId: string | undefined, scope: NotificationScope, ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getDismissedKey(userId, scope), JSON.stringify(Array.from(new Set(ids)).slice(-300)));
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

      // Management roles use a clean request-inbox RPC.
      // It returns ONLY real currently-pending requests:
      // Principal => pending staff registrations + pending staff leaves
      // Director => pending Principal registrations + pending Principal leaves.
      if (scope === 'principal' || scope === 'director' || scope === 'all') {
        const [{ data: requestData, error: requestError }, { data: ownData, error: ownError }] = await Promise.all([
          supabase.rpc('get_management_notifications', {
            p_scope: scope,
          }),
          userId
            ? supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (requestError) throw requestError;
        if (ownError) throw ownError;

        // Management roles need both:
        // 1) pending requests waiting for their action, and
        // 2) personal notifications about their own account/leave applications.
        const dismissed = new Set(readDismissedIds(userId, scope));
        const requestRows = ((requestData ?? []) as Notification[])
          .filter((row) => !dismissed.has(row.id));
        const ownRows = (ownData ?? []) as Notification[];

        const merged = new Map<string, Notification>();
        [...ownRows, ...requestRows].forEach((row) => merged.set(row.id, row));
        rows = Array.from(merged.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
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

      setNotifications(rows);
      setUnreadCount(rows.filter(n => !n.is_read).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
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
    const selected = notifications.find((notification) => notification.id === notificationId);
    const isOwnStoredNotification = Boolean(userId && selected?.user_id === userId);

    try {
      if (isOwnStoredNotification) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .eq('user_id', userId);

        if (error) throw error;

        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
      } else if (scope === 'principal' || scope === 'director' || scope === 'all') {
        const nextDismissed = [...readDismissedIds(userId, scope), notificationId];
        writeDismissedIds(userId, scope, nextDismissed);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      }

      if (!selected?.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    try {
      const ownNotifications = notifications.filter(n => n.user_id === userId);
      const requestNotifications = notifications.filter(n => n.user_id !== userId);

      if (ownNotifications.some(n => !n.is_read)) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .eq('is_read', false);

        if (error) throw error;
      }

      if (scope === 'principal' || scope === 'director' || scope === 'all') {
        const requestIds = requestNotifications.map(n => n.id);
        writeDismissedIds(userId, scope, [
          ...readDismissedIds(userId, scope),
          ...requestIds,
        ]);
        setNotifications(ownNotifications.map(n => ({ ...n, is_read: true })));
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }

      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
