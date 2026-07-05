import API from './axiosConfig';

export const sendChatMessage = async (message, sessionId) => {
    const response = await API.post('/chat/message', { 
        message,
        sessionId,
    });

    return response.data?.data || response.data;
};
export const submitCardRequest = async ({ requestType, reason }) => {
    const response = await API.post('/card-freeze-requests', {
        requestType,
        reason,
    });

    return response.data?.data || response.data;
};
