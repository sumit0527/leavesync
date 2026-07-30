import { useState, useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { Holiday } from '@/types';

const getIndiaNowParts = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
};

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchHolidays(); }, []);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('holidays').select('*').order('date', { ascending: true });
      if (data) setHolidays(data);
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  const toLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isHoliday = (date: Date): boolean => holidays.some((h) => h.date === toLocalDateString(date));

  // Saturday is a working day. Only Sunday is treated as weekly off.
  const isWeekend = (date: Date): boolean => date.getDay() === 0;

  const isSameDayBlockedNow = (): boolean => {
    const { minutes } = getIndiaNowParts();
    return minutes >= 10 * 60 && minutes < 17 * 60;
  };

  const isValidLeaveDate = (date: Date): boolean => {
    const selected = toLocalDateString(date);
    const { date: indiaToday } = getIndiaNowParts();

    if (selected < indiaToday) return false;
    if (selected === indiaToday && isSameDayBlockedNow()) return false;
    if (isWeekend(date)) return false;
    if (isHoliday(date)) return false;
    return true;
  };

  return { holidays, loading, isHoliday, isWeekend, isSameDayBlockedNow, isValidLeaveDate };
}
