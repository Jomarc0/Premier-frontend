// Per-tab credentials; remove legacy retained sessions instead of reusing them.
const KEYS = ["adminToken", "adminName", "adminUsername", "adminRole", "admin2FaEnabled"];
const TOKEN_KEY = "adminToken";
const LAST_ACTIVITY = 'admin_last_activity';
const IDLE_MS = 900000;
const privateKey = key => KEYS.includes(key) || key === LAST_ACTIVITY
  || key?.startsWith('premier:remittance-pending:') || key?.startsWith('premier_chat_') || key?.startsWith('premier:passenger-notifications:');
function clear(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index++) if (privateKey(storage.key(index))) keys.push(storage.key(index));
  keys.forEach(key => storage.removeItem(key));
}
export function installSessionGuard() {
  clear(localStorage);
  let previousToken = sessionStorage.getItem(TOKEN_KEY);
  const expire = () => { clear(sessionStorage); location.replace("/admin/login"); };
  const check = () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) { previousToken = null; sessionStorage.removeItem(LAST_ACTIVITY); return; }
    if (token !== previousToken) { previousToken = token; sessionStorage.setItem(LAST_ACTIVITY, String(Date.now())); }
    const last = Number(sessionStorage.getItem(LAST_ACTIVITY));
    if (!last) sessionStorage.setItem(LAST_ACTIVITY, String(Date.now()));
    else if (Date.now() - last >= IDLE_MS || last > Date.now() + 60000) expire();
  };
  const touch = () => {
    // Check before accepting activity, so a hidden stale tab cannot revive a session.
    check();
    if (sessionStorage.getItem(TOKEN_KEY)) sessionStorage.setItem(LAST_ACTIVITY, String(Date.now()));
  };
  for (const event of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(event, touch, { passive: true });
  document.addEventListener('visibilitychange', check);
  setInterval(check, 30000);
  check();
}
