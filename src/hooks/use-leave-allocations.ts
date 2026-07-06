import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import type { StaffLeaveAllocation } from '@/types';

export function useLeaveAllocations(staffId?: string) {
  const [allocations, setAllocations] = useState<StaffLeaveAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllocations = useCallback(async () => {
    if (!staffId) { setLoading(false); return; }
    try {
      setLoading(true);
      // Year-safe guard: when a new year starts, ensure this user has that year's allocation rows before reading balances.
      await supabase.rpc('initialize_staff_leave_allocations', {
        p_staff_id: staffId,
        p_year: new Date().getFullYear(),
      });
      const { data, error } = await supabase
        .from('staff_leave_allocations')
        .select('*, leave_type:leave_types(id, name, annual_allocation, description)')
        .eq('staff_id', staffId)
        .eq('year', new Date().getFullYear())
        .order('created_at', { ascending: true });
      if (error) { console.error('Failed to fetch allocations:', error); return; }
      if (data) {
        // Ensure remaining is always computed as total_allocated - used (client-side safeguard)
        const normalized = (data as unknown as StaffLeaveAllocation[]).map(a => ({
          ...a,
          used: a.used ?? 0,
          remaining: a.total_allocated - (a.used ?? 0),
        }));
        setAllocations(normalized);
      }
    } catch (err) {
      console.error('Failed to fetch leave allocations:', err);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    fetchAllocations();
    if (!staffId) return;
    const channel = supabase
      .channel(`allocations-${staffId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'staff_leave_allocations',
        filter: `staff_id=eq.${staffId}`,
      }, () => { fetchAllocations(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAllocations, staffId]);

  return { allocations, loading, refetch: fetchAllocations };
}
