import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRef } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePostHog } from 'posthog-react-native';

import api, { setUnauthorizedHandler } from '../api/api';
import { clearHceToken } from '../api/hceTokenStore';
import { registerPushNotifications } from '../notifications/pushNotifications';
import { identifyMobileUser, resetMobileAnalytics } from '../analytics/posthog';

const AuthContext = createContext(null);
const FINGERPRINT_ENABLED_KEY = 'premier_fingerprint_enabled';
const BIOMETRIC_REFRESH_TOKEN_KEY = 'premier_biometric_refresh_token';
const BIOMETRIC_DEVICE_ID_KEY = 'premier_biometric_device_id';
const BIOMETRIC_REFRESH_READY_KEY = 'premier_biometric_refresh_ready';
const BIOMETRIC_SECURE_OPTIONS = {
  requireAuthentication: true,
  authenticationPrompt: 'Verify your identity to use Premier biometric login',
};

function syncPushNotificationToken() {
  registerPushNotifications().catch((error) => {
    console.warn('Push notification registration failed:', error?.message || error);
  });
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function isUnexpiredToken(token) {
  if (!token) return false;
  const decoded = decodeJwt(token);
  return Boolean(decoded && (!decoded.exp || decoded.exp * 1000 > Date.now()));
}

async function getOrCreateDeviceId() {
  const existing = await SecureStore.getItemAsync(BIOMETRIC_DEVICE_ID_KEY);
  if (existing) return existing;

  const randomPart = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
  const deviceId = `premier-${Date.now().toString(36)}-${randomPart}`.slice(0, 128);
  await SecureStore.setItemAsync(BIOMETRIC_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

async function biometricCapability() {
  const [compatible, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return compatible && enrolled;
}

async function clearBiometricStorage() {
  await Promise.all([
    SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, BIOMETRIC_SECURE_OPTIONS).catch(() => {}),
    SecureStore.deleteItemAsync('biometricEnabled'),
    AsyncStorage.removeItem(FINGERPRINT_ENABLED_KEY),
    AsyncStorage.removeItem(BIOMETRIC_REFRESH_READY_KEY),
  ]);
}

export function AuthProvider({ children }) {
  const posthog = usePostHog();
  const trackedPassengerId = useRef(null);
  const [passenger, setPassenger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricUnlockAvailable, setBiometricUnlockAvailable] = useState(false);
  const [lockedPassenger, setLockedPassenger] = useState(null);

  const clearSessionState = useCallback(() => {
    setPassenger(null);
    setLockedPassenger(null);
    setBiometricUnlockAvailable(false);
    setBiometricEnabled(false);
  }, []);

  const lockSession = useCallback(async () => {
    setPassenger(null);
    setLockedPassenger(null);
    const storedEnabled = await AsyncStorage.getItem(FINGERPRINT_ENABLED_KEY);
    const enabled = storedEnabled === 'true';
    setBiometricEnabled(enabled);
    setBiometricUnlockAvailable(enabled && await biometricCapability());
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      lockSession().catch(clearSessionState);
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSessionState, lockSession]);

  useEffect(() => {
    const init = async () => {
      try {
        const [token, name, secureEnabled, storedEnabled] = await Promise.all([
          SecureStore.getItemAsync('token'),
          SecureStore.getItemAsync('passengerName'),
          SecureStore.getItemAsync('biometricEnabled'),
          AsyncStorage.getItem(FINGERPRINT_ENABLED_KEY),
        ]);
        const enabled = secureEnabled === 'true' && storedEnabled === 'true';
        const available = enabled && await biometricCapability();
        setBiometricEnabled(enabled);

        if (isUnexpiredToken(token) && available) {
          const decoded = decodeJwt(token);
          setLockedPassenger({ id: decoded?.sub, name, token });
          setBiometricUnlockAvailable(true);
        } else if (!isUnexpiredToken(token)) {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('tempToken');
          await clearHceToken();
          setBiometricUnlockAvailable(available);
        }
      } finally {
        setLoading(false);
      }
    };

    init().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const passengerId = passenger?.id;
    if (passengerId) {
      identifyMobileUser(posthog, passengerId);
      trackedPassengerId.current = passengerId;
    } else if (trackedPassengerId.current) {
      resetMobileAnalytics(posthog);
      trackedPassengerId.current = null;
    }
  }, [passenger?.id, posthog]);

  const value = useMemo(() => ({
    passenger,
    loading,
    biometricEnabled,
    biometricUnlockAvailable,
    login: async (token, name) => {
      await SecureStore.setItemAsync('token', token);
      await SecureStore.setItemAsync('passengerName', name || '');
      const decoded = decodeJwt(token);
      setPassenger({ id: decoded?.sub, name, token });
      setLockedPassenger(null);
      setBiometricUnlockAvailable(false);
    },
    enableBiometrics: async () => {
      if (!await biometricCapability()) {
        throw new Error('Biometric authentication is not available or not enrolled on this device.');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        biometricsSecurityLevel: 'strong',
      });

      if (!result.success) {
        throw new Error('Biometric verification was cancelled or failed.');
      }

      const deviceId = await getOrCreateDeviceId();
      const response = await api.post('/auth/biometric/enroll', { deviceId });
      const { token, refreshToken, passengerName } = response.data?.data || {};
      if (!refreshToken) throw new Error('Unable to create a biometric session.');

      await SecureStore.setItemAsync(
        BIOMETRIC_REFRESH_TOKEN_KEY,
        refreshToken,
        BIOMETRIC_SECURE_OPTIONS,
      );
      await Promise.all([
        SecureStore.setItemAsync('biometricEnabled', 'true'),
        AsyncStorage.setItem(FINGERPRINT_ENABLED_KEY, 'true'),
        AsyncStorage.setItem(BIOMETRIC_REFRESH_READY_KEY, 'true'),
      ]);
      if (token) await SecureStore.setItemAsync('token', token);
      if (passengerName) await SecureStore.setItemAsync('passengerName', passengerName);
      setBiometricEnabled(true);
    },
    disableBiometrics: async () => {
      try {
        const deviceId = await getOrCreateDeviceId();
        await api.post('/auth/biometric/revoke-device', { deviceId });
      } catch {
        // Local removal still prevents this app installation from using the credential.
      }
      await clearBiometricStorage();
      setBiometricEnabled(false);
      setBiometricUnlockAvailable(false);
      setLockedPassenger(null);
    },
    unlockWithBiometrics: async () => {
      if (lockedPassenger && isUnexpiredToken(lockedPassenger.token)) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Premier Transit',
          cancelLabel: 'Use card login',
          disableDeviceFallback: false,
          biometricsSecurityLevel: 'strong',
        });
        if (!result.success) throw new Error('Biometric unlock failed.');

        const refreshReady = await AsyncStorage.getItem(BIOMETRIC_REFRESH_READY_KEY);
        if (refreshReady !== 'true') {
          try {
            const deviceId = await getOrCreateDeviceId();
            const response = await api.post('/auth/biometric/enroll', { deviceId });
            const refreshToken = response.data?.data?.refreshToken;
            if (refreshToken) {
              await SecureStore.setItemAsync(
                BIOMETRIC_REFRESH_TOKEN_KEY,
                refreshToken,
                BIOMETRIC_SECURE_OPTIONS,
              );
              await AsyncStorage.setItem(BIOMETRIC_REFRESH_READY_KEY, 'true');
            }
          } catch (error) {
            console.warn('Unable to upgrade the biometric session:', error?.message || error);
          }
        }
        setPassenger(lockedPassenger);
        setLockedPassenger(null);
        setBiometricUnlockAvailable(false);
        return;
      }

      const deviceId = await getOrCreateDeviceId();
      const refreshToken = await SecureStore.getItemAsync(
        BIOMETRIC_REFRESH_TOKEN_KEY,
        BIOMETRIC_SECURE_OPTIONS,
      );
      if (!refreshToken) {
        await clearBiometricStorage();
        setBiometricEnabled(false);
        setBiometricUnlockAvailable(false);
        throw new Error('No biometric session is saved. Please sign in with your card and OTP.');
      }

      try {
        const response = await api.post('/auth/biometric/refresh', { refreshToken, deviceId });
        const data = response.data?.data || {};
        if (!data.token || !data.refreshToken) {
          throw new Error('The biometric session response is incomplete.');
        }

        await SecureStore.setItemAsync(
          BIOMETRIC_REFRESH_TOKEN_KEY,
          data.refreshToken,
          BIOMETRIC_SECURE_OPTIONS,
        );
        await SecureStore.setItemAsync('token', data.token);
        await SecureStore.setItemAsync('passengerName', data.passengerName || '');
        const decoded = decodeJwt(data.token);
        setPassenger({ id: decoded?.sub, name: data.passengerName, token: data.token });
        setLockedPassenger(null);
        setBiometricUnlockAvailable(false);
      } catch (error) {
        if (error.response?.status === 401) {
          await clearBiometricStorage();
          setBiometricEnabled(false);
          setBiometricUnlockAvailable(false);
        }
        throw new Error(error.response?.data?.message || error.message || 'Biometric unlock failed.');
      }
    },
    syncPushNotifications: syncPushNotificationToken,
    logout: async () => {
      try {
        const deviceId = await getOrCreateDeviceId();
        await api.post('/auth/biometric/revoke-device', { deviceId });
      } catch {
        // Always clear local credentials even when the server cannot be reached.
      }
      await Promise.all([
        SecureStore.deleteItemAsync('token'),
        SecureStore.deleteItemAsync('passengerName'),
        SecureStore.deleteItemAsync('tempToken'),
        clearBiometricStorage(),
      ]);
      await clearHceToken();
      clearSessionState();
    },
  }), [biometricEnabled, biometricUnlockAvailable, clearSessionState, loading, lockedPassenger, passenger]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

