export const PHT_TIME_ZONE = 'Asia/Manila';

const dateValue = (value) => {
  const text = String(value || '');
  return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text}+08:00`);
};

export const formatPhtDateTime = (value) => new Intl.DateTimeFormat('en-PH', {
  timeZone: PHT_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short',
}).format(dateValue(value));

export const formatPhtTime = (value) => new Intl.DateTimeFormat('en-PH', {
  timeZone: PHT_TIME_ZONE, hour: '2-digit', minute: '2-digit',
}).format(dateValue(value));

export const phtDateKey = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: PHT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(dateValue(value));
