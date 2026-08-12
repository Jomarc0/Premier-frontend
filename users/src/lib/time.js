export const PHT_TIME_ZONE = 'Asia/Manila';

const normalizedDate = (value) => {
  if (value instanceof Date) return value;
  const text = String(value || '');
  const hasOffset = /(?:Z|[+-]\d\d:\d\d)$/.test(text);
  return new Date(hasOffset ? text : `${text}+08:00`);
};

export const formatDateTime = (value, options = {}) => new Intl.DateTimeFormat('en-PH', {
  timeZone: PHT_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short', ...options,
}).format(normalizedDate(value));

export const formatTime = (value, options = {}) => new Intl.DateTimeFormat('en-PH', {
  timeZone: PHT_TIME_ZONE, hour: '2-digit', minute: '2-digit', ...options,
}).format(normalizedDate(value));

export const phtDateKey = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: PHT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(normalizedDate(value));
