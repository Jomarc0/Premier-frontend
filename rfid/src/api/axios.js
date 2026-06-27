import axios from 'axios';

const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const terminalToken = import.meta.env.VITE_RFID_TERMINAL_TOKEN;
    if (terminalToken) {
        config.headers['X-Terminal-Token'] = terminalToken;
    }
    return config;
});

export default api;
