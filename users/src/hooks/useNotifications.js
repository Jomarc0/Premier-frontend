import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { requestNotificationPermission, onForegroundMessage } from '../firebase';
import API from '../api/axiosConfig';

export default function useNotifications() {
  const [fcmToken, setFcmToken] = useState(null);
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  // Permission prompts must follow an explicit user gesture, never an effect on mount.
  const enableNotifications = useCallback(async () => {
    const token = await requestNotificationPermission();
    if (!token) return false;
    try {
      await API.put('/notifications/fcm-token', { fcmToken: token });
      setFcmToken(token); setPermission('granted'); return true;
    } catch { toast.error('Unable to enable notifications. Please try again.'); return false; }
  }, []);
  useEffect(() => onForegroundMessage(() => {
    toast.info('There is an update to your Premier account. Open your history for details.');
  }), []);
  return { fcmToken, permission, enableNotifications };
}
