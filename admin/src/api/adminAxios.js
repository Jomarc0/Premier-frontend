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
        return Promise.reject(error);
    }
);

export default adminAPI;