import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const AuthContext = createContext(null);

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
          }
        } else {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('passengerName');
          await SecureStore.deleteItemAsync('biometricEnabled');
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
      setLockedPassenger(null);
      setNeedsBiometricUnlock(false);
    },
    logout: async () => {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('passengerName');
      await SecureStore.deleteItemAsync('tempToken');
      await SecureStore.deleteItemAsync('biometricEnabled');
      setPassenger(null);
      setLockedPassenger(null);
      setNeedsBiometricUnlock(false);
      setBiometricEnabled(false);
    },
  }), [biometricEnabled, loading, lockedPassenger, needsBiometricUnlock, passenger]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
