import { Platform } from 'react-native';

import api from '../api/api';

let notificationHandlerSet = false;
let activeSession = null;
const debug = (message, details = {}) => {
  if (__DEV__) console.info(`[FCM] ${message}`, details);
};
const safeFailure = (error) => ({ code: error?.code || error?.name || 'UNKNOWN', status: error?.response?.status });
const redact = (token) => token.length > 12 ? `${token.slice(0, 4)}...${token.slice(-4)}` : '[REDACTED]';

async function ensureNotificationHandler() {
  const Notifications = await import('expo-notifications');
  if (!notificationHandlerSet) {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request?.content?.data;
        debug('Foreground message received; requesting banner/list display', { type: data?.type, reference: data?.reference });
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
      handleSuccess: () => debug('Foreground presentation handler completed'),
      handleError: () => debug('Foreground presentation handler failed'),
    });
    notificationHandlerSet = true;
  }
  return Notifications;
}

const current = (session) => session && activeSession === session && !session.stopped;
const config = (session) => ({ notificationSessionToken: session.token, skipUnauthorizedHandler: true });

// Serialize refresh uploads so an older token cannot finish after a newer token.
function uploadToken(session, deviceToken) {
  session.pending = session.pending.catch(() => {}).then(async () => {
    if (!current(session)) return null;
    if (deviceToken?.type !== 'android' || typeof deviceToken.data !== 'string' || !deviceToken.data) {
      debug('Unsupported registration type; Android FCM token required', { type: deviceToken?.type });
      return null;
    }
    const fcmToken = deviceToken.data;
    debug('Native Firebase registration generated', { passenger: session.id, token: redact(fcmToken) });
    await api.put('/notifications/fcm-token', { fcmToken }, config(session));
    const previous = session.fcmToken;
    session.fcmToken = fcmToken;
    debug('Registration saved to backend', { passenger: session.id, token: redact(fcmToken) });
    if (previous && previous !== fcmToken && current(session)) {
      await api.delete('/notifications/fcm-token', { ...config(session), data: { fcmToken: previous } });
    }
    return fcmToken;
  });
  return session.pending;
}

export function activatePushSession(passenger) {
  if (activeSession) activeSession.stopped = true;
  const session = { id: passenger.id, token: passenger.token, stopped: false, pending: Promise.resolve(), registering: null };
  activeSession = session;
  ensureNotificationHandler().then((Notifications) => {
    if (!current(session) || Platform.OS !== 'android') return;
    session.listener = Notifications.addPushTokenListener((token) => {
      // Use the token supplied by the listener; requesting it again can loop.
      uploadToken(session, token).catch((error) => debug('Token refresh failed', safeFailure(error)));
    });
  }).catch((error) => debug('Notification initialization failed', safeFailure(error)));
  return () => {
    session.stopped = true;
    session.listener?.remove();
    if (activeSession === session) activeSession = null;
  };
}

export async function registerPushNotifications() {
  const session = activeSession;
  if (!current(session)) return null;
  if (session.registering) return session.registering;
  session.registering = (async () => {
    try {
      const Notifications = await ensureNotificationHandler();
      if (Platform.OS !== 'android') {
        // Expo returns APNs tokens on iOS; those cannot be passed to Firebase Admin as FCM tokens.
        debug('FCM registration unsupported on this platform', { platform: Platform.OS });
        return null;
      }
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Premier alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#9B1022',
      });
      const channel = await Notifications.getNotificationChannelAsync('default');
      debug('Android channel', { id: 'default', importance: channel?.importance });
      let permission = await Notifications.getPermissionsAsync();
      // Automatic login/resume sync must never repeatedly ask after a denial.
      if (permission.status === 'undetermined' && permission.canAskAgain && current(session)) {
        permission = await Notifications.requestPermissionsAsync();
      }
      debug(`Notification permission: ${permission.status.toUpperCase()}`);
      if (permission.status !== 'granted' || !current(session)) return null;
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      if (!current(session)) return null;
      return await uploadToken(session, deviceToken);
    } catch (error) {
      debug('Registration failed', safeFailure(error));
      throw error;
    } finally {
      session.registering = null;
    }
  })();
  return session.registering;
}

export async function unregisterPushNotifications() {
  const session = activeSession;
  if (!session) return;
  session.stopped = true;
  session.listener?.remove();
  activeSession = null;
  await session.pending.catch(() => {});
  if (!session.fcmToken) return;
  try {
    await api.delete('/notifications/fcm-token', { ...config(session), data: { fcmToken: session.fcmToken } });
    debug('Registration removed on logout', { passenger: session.id });
  } catch (error) {
    debug('Logout registration removal failed', safeFailure(error));
  }
}

// Initialize the foreground handler before login. Never claim an import failure was success.
ensureNotificationHandler().catch((error) => debug('Notification initialization failed', safeFailure(error)));

if (__DEV__) {
  // Call from React Native DevTools on an authenticated development build/server only.
  globalThis.__premierFcmTest = async () => {
    const session = activeSession;
    const fcmToken = await registerPushNotifications();
    if (!fcmToken || !current(session)) throw new Error('Current device is not registered');
    const response = await api.post('/notifications/test', { fcmToken }, config(session));
    debug('Direct test response (acceptance is not delivery)', response.data);
    return response.data;
  };
}
