import { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { Department } from '@/types';

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (data) {
        setDepartments(data);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  return { departments, loading, refetch: fetchDepartments };
}
