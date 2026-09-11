const AUTH_KEYS = [
  'token',
  'tempToken',
  'passengerName',
  'passengerCardNumber',
  'pendingCardNumber',
  'postLoginAction',
];
const PRIVATE_PREFIXES = ['premier_chat_history', 'premier_chat_session', 'premier:passenger-notifications:'];
export function clearPrivateStorage(storage) {
  const remove = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (AUTH_KEYS.includes(key) || PRIVATE_PREFIXES.some(prefix => key?.startsWith(prefix))) remove.push(key);
  }
  remove.forEach(key => storage.removeItem(key));
}
export function clearAuthStorage() {
  clearPrivateStorage(sessionStorage);
  clearPrivateStorage(localStorage);
}
// Do not silently migrate indefinitely retained credentials from older builds.
export function removeLegacyCredentials() { clearPrivateStorage(localStorage); }
