import API from './axiosConfig';

export const sendChatMessage = async (message, sessionId) => {
    const response = await API.post('/chat/message', { 
        message,
        sessionId,
    });

    return response.data?.data || response.data;
};