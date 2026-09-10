import { NativeModules, Platform } from 'react-native';
const native = Platform.OS === 'android' ? NativeModules.PremierHceTokenModule : null;
export async function getHceStatus() {
  if (Platform.OS !== 'android' || !native?.getStatus) return { supported: false, enabled: false };
  try {
    const status = await native.getStatus();
    return { supported: status?.supported === true, enabled: status?.enabled === true };
  } catch {
    return { supported: false, enabled: false };
  }
}
export async function beginHceSession() {
  if (!native?.beginSession) return -1;
  const generation = await native.beginSession();
  return Number.isFinite(generation) && generation >= 0 ? generation : -1;
}
export async function saveHceToken(token, ttlMs, generation) {
  if (!native?.setToken || !token || !Number.isFinite(ttlMs) || ttlMs <= 0 || generation < 0) return false;
  return (await native.setToken(token, Math.floor(ttlMs), generation)) === true;
}
export async function clearHceToken() {
  if (!native?.clearToken) return false;
  try { return (await native.clearToken()) === true; } catch { return false; }
}
export async function isHceReady() {
  if (!native?.isReady) return false;
  try { return (await native.isReady()) === true; } catch { return false; }
}
