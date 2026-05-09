import axios from 'axios';

const adminAPI = axios.create({
    baseURL: 'http://localhost:8080/api/admin',
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