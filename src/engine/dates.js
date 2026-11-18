// Calendar helpers. Every date is a plain "YYYY-MM-DD" string in UTC, so the maths
// never shifts by a day because of the viewer's time zone.

const DAY = 86400000;

/** Parse "YYYY-MM-DD" or any ISO timestamp to a UTC-midnight Date. */
export function toDay(value) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a Date back to "YYYY-MM-DD". */
export function fmt(d) {
  return d.toISOString().slice(0, 10);
}

const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/**
 * Working days from `start` to `end`: a request opened and finished on the same day
 * takes 0, opened Monday and finished Wednesday takes 2. Weekends are skipped.
 */
export function businessDaysBetween(start, end) {
  const a = toDay(start);
  const b = toDay(end);
  if (!a || !b || b <= a) return 0;
  let n = 0;
  for (let t = a.getTime() + DAY; t <= b.getTime(); t += DAY) {
    if (!isWeekend(new Date(t))) n++;
  }
  return n;
}

/** The working day that is `days` working days after `start` (rounded up). */
export function addBusinessDays(start, days) {
  let d = toDay(start);
  let left = Math.ceil(days);
  // A start on a weekend counts from the next Monday.
  while (isWeekend(d)) d = new Date(d.getTime() + DAY);
  while (left > 0) {
    d = new Date(d.getTime() + DAY);
    if (!isWeekend(d)) left--;
  }
  return fmt(d);
}
