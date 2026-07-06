import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

import { setUnauthorizedHandler } from '../api/api';
import { clearHceToken } from '../api/hceTokenStore';
import { registerPushNotifications } from '../notifications/pushNotifications';

const AuthContext = createContext(null);

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
  const [passenger, setPassenger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [needsBiometricUnlock, setNeedsBiometricUnlock] = useState(false);
  const [lockedPassenger, setLockedPassenger] = useState(null);

  const clearSessionState = useCallback(() => {
    setPassenger(null);
    setLockedPassenger(null);
    setNeedsBiometricUnlock(false);
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
          const enabled = await SecureStore.getItemAsync('biometricEnabled');
          setBiometricEnabled(enabled === 'true');

          if (enabled === 'true') {
            setLockedPassenger({ id: decoded?.sub, name, token });
            setNeedsBiometricUnlock(true);
          } else {
            setPassenger({ id: decoded?.sub, name, token });
            syncPushNotificationToken();
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

  const value = useMemo(() => ({
    passenger,
    loading,
    biometricEnabled,
    needsBiometricUnlock,
    login: async (token, name) => {
      await SecureStore.setItemAsync('token', token);
      await SecureStore.setItemAsync('passengerName', name || '');
      const decoded = decodeJwt(token);
      setPassenger({ id: decoded?.sub, name, token });
      syncPushNotificationToken();
      setLockedPassenger(null);
      setNeedsBiometricUnlock(false);
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
      setBiometricEnabled(true);
    },
    disableBiometrics: async () => {
      await SecureStore.deleteItemAsync('biometricEnabled');
      setBiometricEnabled(false);
      setNeedsBiometricUnlock(false);
      setLockedPassenger(null);
    },
    unlockWithBiometrics: async () => {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Premier Transit',
        cancelLabel: 'Use card login',
        disableDeviceFallback: false,
      });

      if (!result.success) {
        throw new Error('Biometric unlock failed.');
      }

      setPassenger(lockedPassenger);
      syncPushNotificationToken();
      setLockedPassenger(null);
      setNeedsBiometricUnlock(false);
    },
    logout: async () => {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('passengerName');
      await SecureStore.deleteItemAsync('tempToken');
      await SecureStore.deleteItemAsync('biometricEnabled');
      await clearHceToken();
      clearSessionState();
    },
  }), [biometricEnabled, clearSessionState, loading, lockedPassenger, needsBiometricUnlock, passenger]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);



