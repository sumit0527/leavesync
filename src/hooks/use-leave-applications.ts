import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import type { LeaveApplication } from '@/types';

export function useLeaveApplications(staffId?: string) {
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('leave_applications')
        .select(`
          *,
          staff:profiles!leave_applications_staff_id_fkey(*, department:departments(*)),
          reviewer:profiles!leave_applications_reviewed_by_fkey(id, username, full_name),
          leave_type:leave_types(*)
        `)
        .order('created_at', { ascending: false });

      if (staffId) {
        query = query.eq('staff_id', staffId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    fetchApplications();
    // Realtime subscription
    const channel = supabase
      .channel(`leave-apps-${staffId ?? 'admin'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_applications' }, () => {
        fetchApplications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchApplications]);

  return { applications, loading, error, refetch: fetchApplications };
}

export function useLeaveStats(staffId?: string) {
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('leave_applications').select('status');
      if (staffId) query = query.eq('staff_id', staffId);
      const { data } = await query;
      if (data) {
        setStats({
          total: data.length,
          approved: data.filter(a => a.status === 'approved').length,
          rejected: data.filter(a => a.status === 'rejected').length,
          pending: data.filter(a => a.status === 'pending').length,
        });
      }
    } catch (err) {
      console.error('Stats fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    fetchStats();
    const channel = supabase
      .channel(`leave-stats-${staffId ?? 'admin'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_applications' }, () => {
        fetchStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
