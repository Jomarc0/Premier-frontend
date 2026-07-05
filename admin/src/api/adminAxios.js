import axios from 'axios';

const adminAPI = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL}/api/admin`,
    timeout: 10000,
});

adminAPI.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

adminAPI.interceptors.response.use(
    (response) => response,
    (error) => {
        const requestUrl = error.config?.url || '';
        const isLoginRequest = requestUrl.includes('/auth/login');
        const isTotpVerifyRequest = requestUrl.includes('/auth/totp/verify');

        if (error.response?.status === 401 && !isLoginRequest && !isTotpVerifyRequest) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminName');
            localStorage.removeItem('adminUsername');
            localStorage.removeItem('adminRole');
            window.location.href = '/admin/login';
        }
        return Promise.reject(error);
    }
);

export default adminAPI;
