export const visibleCalendarDate = value => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
