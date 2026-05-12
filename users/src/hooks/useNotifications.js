import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
    requestNotificationPermission,
    onForegroundMessage
} from '../firebase';
import API from '../api/axiosConfig';

const useNotifications = () => {
    const [fcmToken, setFcmToken] = useState(null);
    const [permission, setPermission] =
        useState(Notification.permission);

    useEffect(() => {
        setupNotifications();
    }, []);

    const setupNotifications = async () => {
        try {
            const token = await requestNotificationPermission();

            if (token) {
                setFcmToken(token);
                setPermission('granted');
                await saveFcmToken(token);

                onForegroundMessage((payload) => {
                    handleForegroundMessage(payload);
                });
            }
        } catch (error) {
            console.error('Notification setup failed:', error);
        }
    };

    const saveFcmToken = async (token) => {
        try {
            await API.put('/notifications/fcm-token', {
                fcmToken: token
            });
            console.log('FCM token saved to server');
        } catch (error) {
            console.error('Failed to save FCM token:', error);
        }
    };

    const handleForegroundMessage = (payload) => {
        const { title, body } = payload.notification || {};
        const data = payload.data || {};

        switch (data.type) {
            case 'TOPUP':
                toast.success(`${title} - ${body}`, { autoClose: 5000 });
                break;
            case 'FARE':
                toast.info(`${title} - ${body}`, { autoClose: 5000 });
                break;
            case 'LOW_BALANCE':
                toast.warning(`${title} - ${body}`, { autoClose: 8000 });
                break;
            case 'TICKET':
                toast.info(`${title} - ${body}`, { autoClose: 5000 });
                break;
            default:
                toast.info(`${title} - ${body}`, { autoClose: 5000 });
        }
    };

    return { fcmToken, permission };
};

export default useNotifications;