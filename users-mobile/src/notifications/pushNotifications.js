import { Platform } from 'react-native';

import api from '../api/api';

let notificationHandlerSet = false;

async function ensureNotificationHandler() {
  if (notificationHandlerSet) return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerSet = true;
  } catch {
    // Notification handler not available in Expo Go (SDK 53+)
    notificationHandlerSet = true;
  }
}

export async function registerPushNotifications() {
  await ensureNotificationHandler();

  try {
    const Notifications = await import('expo-notifications');
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Premier alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#9B1022',
      });
    }

    const currentPermission = await Notifications.getPermissionsAsync();
    let finalStatus = currentPermission.status;

    if (finalStatus !== 'granted') {
      const requestedPermission = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermission.status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const fcmToken = deviceToken?.data;

    if (!fcmToken) {
      return null;
    }

    await api.put('/notifications/fcm-token', { fcmToken });
    return fcmToken;
  } catch (error) {
    console.warn('Push notification registration failed:', error?.message || error);
    return null;
  }
}