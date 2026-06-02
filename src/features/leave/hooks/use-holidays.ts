import { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { Holiday } from '@/types';

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });

      if (data) {
        setHolidays(data);
      }
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  const isHoliday = (date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.some(h => h.date === dateStr);
  };

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isValidLeaveDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate <= today) return false;
    if (isWeekend(checkDate)) return false;
    if (isHoliday(checkDate)) return false;

    return true;
  };

  return { holidays, loading, isHoliday, isWeekend, isValidLeaveDate };
}
