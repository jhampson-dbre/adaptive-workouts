export const visibleCalendarDate = value => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const RANGE_MONTHS = Object.freeze({ '1M': 1, '3M': 3, '6M': 6, '1Y': 12 });

export function calendarRangeBounds({ range, endDate }) {
  const months = RANGE_MONTHS[range];
  if (!months || !/^\d{4}-\d{2}-\d{2}$/.test(endDate ?? '')) throw new RangeError('Range must be 1M, 3M, 6M, or 1Y with a calendar end date.');
  const [year, month, day] = endDate.split('-').map(Number); const end = new Date(year, month - 1, day);
  if (end.getFullYear() !== year || end.getMonth() !== month - 1 || end.getDate() !== day) throw new RangeError('End date must be a valid calendar date.');
  const start = new Date(year, month - 1, 1); start.setMonth(start.getMonth() - months);
  start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
  const startDate = [start.getFullYear(), String(start.getMonth() + 1).padStart(2, '0'), String(start.getDate()).padStart(2, '0')].join('-');
  return { startDate, endDate };
}
