const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!envApiBaseUrl) {
  throw new Error('Missing EXPO_PUBLIC_API_BASE_URL in users-mobile/.env');
}

export const API_BASE_URL = envApiBaseUrl.replace(/\/$/, '');

export const API_PASSENGER_BASE = `${API_BASE_URL}/api/passenger`;