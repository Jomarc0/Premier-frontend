import axios from 'axios';

const driverAPI = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL}/api/driver`,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10_000,
});

driverAPI.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('driverToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

driverAPI.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            sessionStorage.removeItem('driverToken');
            sessionStorage.removeItem('driverInfo');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    },
);

export default driverAPI;