import axios from 'axios';
import { apiOrigin } from './apiOrigin';

const API = axios.create({
    baseURL: `${apiOrigin}/api/passenger`,
});

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

API.interceptors.response.use(
    (response) => response,
    (error) => {
        const requestUrl = error.config?.url || '';
        const isPublicAuthRequest =
            requestUrl.includes('/auth/login') ||
            requestUrl.includes('/auth/verify-totp') ||
            requestUrl.includes('/auth/totp/setup') ||
            requestUrl.includes('/chat/');

        if (error.response?.status === 401 && !isPublicAuthRequest) {
            localStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default API;
