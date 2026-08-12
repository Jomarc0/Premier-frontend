import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBell, FiX } from 'react-icons/fi';
import { onForegroundMessage } from '../firebase';
import { formatTime } from '../lib/time';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import API from '../api/axiosConfig';
import { requestNotificationPermission } from '../firebase';

const MAX_NOTIFICATIONS = 20;

const notificationForEvent = (event) => {
  switch (event?.type) {
    case 'TICKET_CREATED':
      return { title: 'Support request received', body: 'Your request was received. We will send important updates to your email.', type: 'TICKET' };
    case 'TICKET_STATUS_CHANGED':
    case 'TICKET_UPDATED':
      return { title: 'Support request updated', body: 'There is an update to your support request. Please check your email for details.', type: 'TICKET' };
    case 'CARD_STATUS_CHANGED':
    case 'PASSENGER_UPDATED':
      return { title: 'Card account updated', body: 'Your card account information was updated.', type: 'CARD' };
    case 'BALANCE_UPDATED':
      return { title: 'Balance updated', body: 'Your available balance was updated.', type: 'TOPUP' };
    case 'TOPUP_COMPLETED':
      return { title: 'Top-up completed', body: 'Your card balance has been updated successfully.', type: 'TOPUP' };
    case 'TRANSACTION_CREATED':
    case 'FARE_PAID':
      return { title: 'Recent activity', body: 'A new card transaction was recorded.', type: 'FARE' };
    default:
      return null;
  }
};

const NotificationBell = () => {
  const { passenger } = useAuth();
  const { subscribe } = useRealtime();
  const storageKey = useMemo(
    () => (passenger?.id ? `premier:passenger-notifications:${passenger.id}` : null),
    [passenger?.id],
  );
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      setNotifications([]);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setNotifications(Array.isArray(saved) ? saved.slice(0, MAX_NOTIFICATIONS) : []);
    } catch {
      setNotifications([]);
    }
  }, [storageKey]);

  const addNotification = useCallback((title, body, type = 'INFO', id = `${Date.now()}-${Math.random()}`, time = new Date()) => {
    const notification = {
      id,
      title: title || 'Notification',
      body: body || '',
      type,
      time: new Date(time).toISOString(),
      read: false,
    };
    setNotifications((previous) => {
      if (previous.some((item) => item.id === notification.id)) return previous;
      const next = [notification, ...previous].slice(0, MAX_NOTIFICATIONS);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      addNotification(title, body, payload.data?.type || 'INFO', payload.messageId);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [addNotification]);

  useEffect(() => subscribe((event) => {
    const notification = notificationForEvent(event);
    if (notification) {
      addNotification(notification.title, notification.body, notification.type, event.eventId, event.occurredAt);
    }
  }), [addNotification, subscribe]);

  const updateNotifications = (update) => {
    setNotifications((previous) => {
      const next = update(previous);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const markAllRead = () => {
    updateNotifications((previous) => previous.map((item) => ({ ...item, read: true })));
  };
  const enableBrowserNotifications = async () => {
    const token = await requestNotificationPermission();
    if (token) {
      await API.put('/notifications/fcm-token', { fcmToken: token });
      addNotification('Browser notifications enabled', 'This browser will now receive Premier updates.', 'INFO');
    }
  };
  const unreadCount = notifications.filter((item) => !item.read).length;
  const getIcon = (type) => ({ TOPUP: '💳', FARE: '🚌', LOW_BALANCE: '⚠️', TICKET: '🎫', CARD: '🛡️' }[type] || '🔔');

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (typeof Notification !== 'undefined' && Notification.permission === 'default') enableBrowserNotifications();
          if (!showDropdown) markAllRead();
          setShowDropdown(!showDropdown);
        }}
        className="relative block cursor-pointer border-none bg-transparent p-2 text-white/80 transition-colors hover:text-white"
        aria-label="Notifications"
        title="View notifications"
      >
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
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-xs text-slate-400"><FiBell className="mb-2 text-2xl opacity-30" /><p className="font-bold">No new notifications</p></div>
            ) : notifications.map((notification) => (
              <div key={notification.id} className={`flex items-start gap-3 px-4 py-3 ${notification.read ? 'bg-white' : 'bg-yellow-50/50'}`}>
                <span className="mt-0.5 shrink-0 text-lg">{getIcon(notification.type)}</span>
                <div className="min-w-0 flex-1 leading-tight"><p className="truncate text-xs font-black text-slate-900">{notification.title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{notification.body}</p><p className="mt-1 font-mono text-[9px] text-slate-400">{formatTime(notification.time)}</p></div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center">
            {typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? (
              <button onClick={enableBrowserNotifications} className="w-full cursor-pointer rounded-lg border-none bg-transparent py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7A2F3D] transition-colors hover:bg-[#7A2F3D]/5">Enable browser notifications</button>
            ) : notifications.length > 0 && <button onClick={markAllRead} className="w-full cursor-pointer rounded-lg border-none bg-transparent py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7A2F3D] transition-colors hover:bg-[#7A2F3D]/5">Mark all as read</button>}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
