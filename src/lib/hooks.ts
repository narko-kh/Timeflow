/*
 * هوک‌های کوچک مشترک
 */
import { useEffect, useState } from 'react';

/** «الان» که هر intervalMs به‌روز می‌شه (برای ساعت تایمر) */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
