export const PHT_TIME_ZONE = 'Asia/Manila';
export const formatPhtTime = (value) => new Intl.DateTimeFormat('en-PH', { timeZone: PHT_TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
