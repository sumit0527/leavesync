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
        const { data, error } = await supabase.rpc('get_management_notifications', {
          p_scope: scope,
        });

        if (error) throw error;
        rows = (data ?? []) as Notification[];

        // Request-inbox items are generated from current pending data, not always stored rows.
        // Mark as Read hides them from this user's popup/inbox until the request changes.
        const dismissed = new Set(readDismissedIds(userId, scope));
        rows = rows.filter((row) => !dismissed.has(row.id));
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
    // Principal/Director request-inbox rows may be generated virtual rows.
    // Hide them locally so the bell popup/count can be cleared without changing the real request.
    if (scope === 'principal' || scope === 'director' || scope === 'all') {
      const nextDismissed = [...readDismissedIds(userId, scope), notificationId];
      writeDismissedIds(userId, scope, nextDismissed);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
      return;
    }

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
    if (scope === 'principal' || scope === 'director' || scope === 'all') {
      const allIds = notifications.map(n => n.id);
      writeDismissedIds(userId, scope, [...readDismissedIds(userId, scope), ...allIds]);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

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
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
