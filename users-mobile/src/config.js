const envApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://api-proxy.rayjomar15.workers.dev';

export const API_BASE_URL = envApiBaseUrl.replace(/\/$/, '');

export const API_PASSENGER_BASE = `${API_BASE_URL}/api/passenger`;
