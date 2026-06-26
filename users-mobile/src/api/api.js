import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

import { API_PASSENGER_BASE } from '../config';

const api = axios.create({
  baseURL: API_PASSENGER_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
