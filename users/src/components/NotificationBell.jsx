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
      addNotification(title || 'Notification', body || '', type);
    });
    return () => { 
      if (typeof unsubscribe === 'function') unsubscribe(); 
    };
  }, []);

  const addNotification = (title, body, type) => {
    setNotifications(prev => [{
      id: Date.now() + Math.random(), 
      title, 
      body, 
      type, 
      time: new Date(), 
      read: false,
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
      {/* Bell button styled exactly with Design reference reference layout */}
      <button
        onClick={() => {
          setShowDropdown(!showDropdown);
          if (!showDropdown) markAllRead();
        }}
        className="text-white/80 hover:text-white p-2 relative cursor-pointer transition-colors block border-none bg-transparent"
        aria-label="Notifications"
        title="View Alerts"
      >
        <FiBell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-yellow-400 text-[#7A2F3D] text-[9px] font-black grid place-items-center border-2 border-[#7A2F3D]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown with Design reference styling (rounded-2xl, crimson header, clean typography) */}
      {showDropdown && (
        <div className="absolute top-[calc(100%+0.5rem)] right-0 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-70 animate-in fade-in duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-[#7A2F3D]">
            <span className="text-white font-black text-xs uppercase tracking-wider">System Notifications</span>
            <button
              onClick={() => setShowDropdown(false)}
              className="grid place-items-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-none"
              aria-label="Close"
            >
              <FiX size={14} />
            </button>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 bg-slate-50/30">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-slate-400 text-xs">
                <FiBell className="text-2xl mb-2 opacity-30 animate-pulse" />
                <p className="font-bold">No active tap warnings or alerts</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`flex gap-3 items-start px-4 py-3 transition-colors ${
                    notif.read ? 'bg-white' : 'bg-yellow-50/50'
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">{getIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0 leading-tight">
                    <p className="font-black text-xs text-slate-900 truncate">{notif.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{notif.body}</p>
                    <p className="text-[9px] text-slate-400 mt-1 font-mono">
                      {new Date(notif.time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center">
              <button
                onClick={() => { setNotifications([]); setUnreadCount(0); }}
                className="w-full py-1.5 rounded-lg text-[10px] font-bold text-[#7A2F3D] hover:bg-[#7A2F3D]/5 transition-colors uppercase tracking-wider cursor-pointer border-none bg-transparent"
              >
                Clear All Logs
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
