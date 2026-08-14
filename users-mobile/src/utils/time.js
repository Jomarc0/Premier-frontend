export const PHT_TIME_ZONE = 'Asia/Manila';

const dateValue = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatPhtDateTime = (value) => {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat('en-PH', {
    timeZone: PHT_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short',
  }).format(date) : '';
};

export const formatPhtTime = (value) => {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat('en-PH', {
    timeZone: PHT_TIME_ZONE, hour: '2-digit', minute: '2-digit',
  }).format(date) : '';
};

export const phtDateKey = (value = new Date()) => {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat('en-CA', {
    timeZone: PHT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date) : '';
};
