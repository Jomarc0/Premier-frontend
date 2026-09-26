import { useCallback, useEffect, useState } from 'react';
import { FiBell, FiX } from 'react-icons/fi';
import { onForegroundMessage, requestNotificationPermission } from '../firebase';
import { formatTime } from '../lib/time';
import { useAuth } from '../context/AuthState';
import { useRealtime } from '../context/RealtimeState';
import API from '../api/axiosConfig';

const NotificationBell = () => {
  const { passenger } = useAuth();
  const { subscribe } = useRealtime();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!passenger?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      if (import.meta.env.DEV) console.info('[Notifications] Fetching backend history');
      const response = await API.get('/notifications?page=0&size=20');
      const content = response.data?.data?.content;
      if (import.meta.env.DEV) console.info('[Notifications] Response', response.data?.data);
      setNotifications(Array.isArray(content) ? content : []);
      setUnreadCount(Number(response.data?.data?.unreadCount || 0));
    } catch (requestError) {
      console.error('[Notifications] Fetch failed', requestError.response?.status || requestError.message);
      setError(requestError.response?.data?.message || 'Failed to load notifications.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [passenger?.id]);

  useEffect(() => {
    queueMicrotask(() => fetchNotifications({ silent: true }));
  }, [fetchNotifications]);

  useEffect(() => {
    const unsubscribe = onForegroundMessage(() => fetchNotifications({ silent: true }));
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [fetchNotifications]);

  useEffect(() => subscribe((event) => {
    if (event?.entity === 'TRANSACTION' || event?.entity === 'TOPUP') {
      window.setTimeout(() => fetchNotifications({ silent: true }), 250);
    }
  }), [fetchNotifications, subscribe]);

  const markRead = async (notification) => {
    if (notification.read) return;
    try {
      await API.patch(`/notifications/${notification.id}/read`);
      setNotifications((items) => items.map((item) => (
        item.id === notification.id ? { ...item, read: true } : item
      )));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update notification.');
    }
  };

  const markAllRead = async () => {
    try {
      await API.put('/notifications/read-all');
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update notifications.');
    }
  };

  const enableBrowserNotifications = async () => {
    const token = await requestNotificationPermission();
    if (token) await API.put('/notifications/fcm-token', { fcmToken: token });
  };

  const getIcon = (type) => ({ TOPUP: '💳', FARE: '🚌', LOW_BALANCE: '⚠️', TICKET: '🎫', CARD: '🛡️' }[type] || '🔔');

  const toggleDropdown = () => {
    const opening = !showDropdown;
    setShowDropdown(opening);
    if (opening) {
      fetchNotifications();
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') enableBrowserNotifications();
    }
  };

  return (
    <div className="relative">
      <button onClick={toggleDropdown} className="relative block cursor-pointer border-none bg-transparent p-2 text-white/80 transition-colors hover:text-white" aria-label="Notifications" title="View notifications">
        <FiBell size={20} />
        {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-[#6E2233] bg-[#D4AF37] px-1 text-[9px] font-black text-[#6E2233]">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {showDropdown && (
        <div className="absolute top-[calc(100%+0.5rem)] right-0 z-70 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl md:w-96">
          <div className="flex items-center justify-between bg-[#7A2F3D] px-5 py-3">
            <span className="text-xs font-black uppercase tracking-wider text-white">Notifications</span>
            <button onClick={() => setShowDropdown(false)} className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border-none bg-white/10 text-white transition-colors hover:bg-white/20" aria-label="Close"><FiX size={14} /></button>
          </div>
          <div className="max-h-80 divide-y divide-slate-50 overflow-y-auto bg-slate-50/30">
            {loading ? (
              <div className="px-4 py-12 text-center text-xs font-semibold text-slate-500" role="status">Loading notifications...</div>
            ) : error ? (
              <div className="px-4 py-10 text-center text-xs text-red-600" role="alert"><p className="font-bold">Failed to load notifications</p><p className="mt-1">{error}</p><button type="button" onClick={() => fetchNotifications()} className="mt-3 font-bold underline">Retry</button></div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-xs text-slate-400"><FiBell className="mb-2 text-2xl opacity-30" /><p className="font-bold">No notifications yet</p></div>
            ) : notifications.map((notification) => (
              <button type="button" onClick={() => markRead(notification)} key={notification.id} className={`flex w-full items-start gap-3 border-0 px-4 py-3 text-left ${notification.read ? 'bg-white' : 'bg-yellow-50/50'}`}>
                <span className="mt-0.5 shrink-0 text-lg">{getIcon(notification.type)}</span>
                <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-xs font-black text-slate-900">{notification.title}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600">{notification.message}</span><span className="mt-1 block font-mono text-[9px] text-slate-400">{formatTime(notification.createdAt)}</span></span>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center">
            {typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? (
              <button onClick={enableBrowserNotifications} className="w-full cursor-pointer rounded-lg border-none bg-transparent py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7A2F3D] transition-colors hover:bg-[#7A2F3D]/5">Enable browser notifications</button>
            ) : unreadCount > 0 && <button onClick={markAllRead} className="w-full cursor-pointer rounded-lg border-none bg-transparent py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7A2F3D] transition-colors hover:bg-[#7A2F3D]/5">Mark all as read</button>}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
