import axios from 'axios';
import API from './axiosConfig';

export const sendChatMessage = async (message, sessionId) => {
    const response = await API.post('/chat/message', { 
        message,
        sessionId,
    });

    return response.data?.data || response.data;
};

export const submitPublicSupportTicket = async ({ cardNumber, email, issueType, reason }) => {
    const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/public/support-tickets`, {
        cardNumber,
        email,
        issueType,
        reason,
    });

    return {
        ...(response.data?.data || {}),
        message: response.data?.message,
    };
};
