export const PHT_TIME_ZONE = 'Asia/Manila';
const normalizedDate = (value) => {
  if (value instanceof Date) return value;
  const text = String(value || '');
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text}+08:00`);
};
const format = (value, options) => {
  const date = normalizedDate(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('en-PH', { timeZone: PHT_TIME_ZONE, ...options }).format(date);
};
export const formatDateTime = (value, options = {}) => format(value, { dateStyle: 'medium', timeStyle: 'short', ...options });
export const formatDate = (value, options = {}) => format(value, { dateStyle: 'medium', ...options });
export const formatTime = (value, options = {}) => format(value, { hour: '2-digit', minute: '2-digit', ...options });
export const phtDateKey = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: PHT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(normalizedDate(value));
