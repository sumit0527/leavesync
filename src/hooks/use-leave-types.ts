import { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { LeaveType } from '@/types';

export function useLeaveTypes() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('leave_types')
        .select('*')
        .order('name');

      if (data) {
        setLeaveTypes(data);
      }
    } catch (err) {
      console.error('Failed to fetch leave types:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  return { leaveTypes, loading, refetch: fetchLeaveTypes };
}
