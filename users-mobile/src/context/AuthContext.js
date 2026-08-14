import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRef } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePostHog } from 'posthog-react-native';

import { setUnauthorizedHandler } from '../api/api';
import { clearHceToken } from '../api/hceTokenStore';
import { registerPushNotifications } from '../notifications/pushNotifications';
import { identifyMobileUser, resetMobileAnalytics } from '../analytics/posthog';

const AuthContext = createContext(null);
const FINGERPRINT_ENABLED_KEY = 'premier_fingerprint_enabled';

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

  useEffect(() => {
    setUnauthorizedHandler(clearSessionState);
    return () => setUnauthorizedHandler(null);
  }, [clearSessionState]);

  useEffect(() => {
    const init = async () => {
      const token = await SecureStore.getItemAsync('token');
      const name = await SecureStore.getItemAsync('passengerName');

      if (token) {
        const decoded = decodeJwt(token);

        if (!decoded?.exp || decoded.exp * 1000 > Date.now()) {
          const secureEnabled = await SecureStore.getItemAsync('biometricEnabled');
          const storedEnabled = await AsyncStorage.getItem(FINGERPRINT_ENABLED_KEY);
          const enabled = secureEnabled === 'true' && storedEnabled === 'true';
          setBiometricEnabled(enabled);

          if (enabled) {
            const compatible = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();

            if (compatible && enrolled) {
              setLockedPassenger({ id: decoded?.sub, name, token });
              setBiometricUnlockAvailable(true);
            }
          }
        } else {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('passengerName');
          await SecureStore.deleteItemAsync('tempToken');
          await SecureStore.deleteItemAsync('biometricEnabled');
          await clearHceToken();
        }
      }

      setLoading(false);
    };

    init();
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
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        throw new Error('Biometric authentication is not available or not enrolled on this device.');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric login',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        throw new Error('Biometric verification was cancelled or failed.');
      }

      await SecureStore.setItemAsync('biometricEnabled', 'true');
      await AsyncStorage.setItem(FINGERPRINT_ENABLED_KEY, 'true');
      setBiometricEnabled(true);
    },
    disableBiometrics: async () => {
      await SecureStore.deleteItemAsync('biometricEnabled');
      await AsyncStorage.removeItem(FINGERPRINT_ENABLED_KEY);
      setBiometricEnabled(false);
      setBiometricUnlockAvailable(false);
      setLockedPassenger(null);
    },
    unlockWithBiometrics: async () => {
      if (!lockedPassenger) {
        throw new Error('No saved passenger session is available.');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Premier Transit',
        cancelLabel: 'Use card login',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        throw new Error('Biometric unlock failed.');
      }

      setPassenger(lockedPassenger);
      setLockedPassenger(null);
      setBiometricUnlockAvailable(false);
    },
    syncPushNotifications: syncPushNotificationToken,
    logout: async () => {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('passengerName');
      await SecureStore.deleteItemAsync('tempToken');
      await SecureStore.deleteItemAsync('biometricEnabled');
      await AsyncStorage.removeItem(FINGERPRINT_ENABLED_KEY);
      await clearHceToken();
      clearSessionState();
    },
  }), [biometricEnabled, biometricUnlockAvailable, clearSessionState, loading, lockedPassenger, passenger]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

