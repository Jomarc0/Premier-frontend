import { NativeModules, Platform } from 'react-native';

const { PremierHceTokenModule } = NativeModules;

export async function saveHceToken(token) {
  if (Platform.OS !== 'android' || !PremierHceTokenModule?.setToken || !token) {
    return false;
  }

  await PremierHceTokenModule.setToken(token);
  return true;
}

export async function clearHceToken() {
  if (Platform.OS !== 'android' || !PremierHceTokenModule?.clearToken) {
    return false;
  }

  await PremierHceTokenModule.clearToken();
  return true;
}
