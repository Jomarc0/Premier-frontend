import axios from 'axios';
import API from './axiosConfig';

export const sendChatMessage = async (message, sessionId) => {
    const response = await API.post('/chat/message', { 
        message,
        sessionId,
    });

    return response.data?.data || response.data;
};

export const submitPublicSupportTicket = async ({ email, issueType, reason }) => {
    const response = await API.post('/support-tickets', {
        email,
        issueType,
        reason,
    });

    return {
        ...(response.data?.data || {}),
        message: response.data?.message,
    };
};

export const getMySupportTickets = async () => {
    const response = await API.get('/support-tickets');
    return response.data?.data || [];
};

export const getMySupportTicket = async (id) => {
    const response = await API.get(`/support-tickets/${id}`);
    return response.data?.data;
};
