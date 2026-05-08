import { useState, useEffect } from 'react';
import { FiBell, FiX } from 'react-icons/fi';
import { onForegroundMessage } from '../firebase';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      const type = payload.data?.type || 'INFO';
      addNotification(title, body, type);
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const addNotification = (title, body, type) => {
    setNotifications(prev => [{
      id: Date.now(), title, body, type, time: new Date(), read: false,
    }, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const getIcon = (type) => ({
    TOPUP: '💳', FARE: '🚌', LOW_BALANCE: '⚠️', TICKET: '🎫',
  }[type] || '🔔');

  return (
    <div className="relative">

      {/* Bell button */}
      <button
        onClick={() => {
          setShowDropdown(!showDropdown);
          if (!showDropdown) markAllRead();
        }}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg border-2 border-[#f4c84d] text-[#f4c84d] bg-transparent hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <FiBell className="text-base" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-[#f4c84d] text-[#8f151d] text-[0.68rem] font-black grid place-items-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-[calc(100%+0.75rem)] right-0 w-80 bg-white rounded-xl shadow-[0_18px_42px_rgba(44,36,41,0.14)] border border-[#e6e8ee] overflow-hidden z-50">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#8f151d]">
            <span className="text-white font-bold text-sm">Notifications</span>
            <button
              onClick={() => setShowDropdown(false)}
              className="grid place-items-center w-7 h-7 rounded-md bg-white/15 hover:bg-white/25 text-white transition-colors"
              aria-label="Close"
            >
              <FiX />
            </button>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-[#717680] text-sm">
                <FiBell className="text-3xl mb-2 opacity-40" />
                <p className="font-medium">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`flex gap-3 items-start px-4 py-3 border-b border-[#e6e8ee] hover:bg-gray-50 transition-colors ${notif.read ? 'bg-white' : 'bg-[#fef5f5]'}`}
                >
                  <span className="text-2xl shrink-0">{getIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[#392d33] truncate mb-0.5">{notif.title}</p>
                    <p className="text-xs text-[#555] mb-1">{notif.body}</p>
                    <p className="text-xs text-[#717680]">
                      {new Date(notif.time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-3 py-2 border-t border-[#e6e8ee]">
              <button
                onClick={() => { setNotifications([]); setUnreadCount(0); }}
                className="w-full py-2 rounded-lg text-sm font-bold text-[#8f151d] hover:bg-[#fae7e9] bg-transparent transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;