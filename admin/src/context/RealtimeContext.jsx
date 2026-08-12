import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { useAdminAuth } from './AdminAuthContext';

const RealtimeContext = createContext({ connected: false, subscribe: () => () => {} });
const endpoint = () => {
  if (import.meta.env.DEV) return `ws://${window.location.host}/ws-native`;
  return `${(import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '')
    .replace(/^http/, 'ws')}/ws-native`;
};

export const RealtimeProvider = ({ children }) => {
  const { admin } = useAdminAuth();
  const listeners = useRef(new Set());
  const seenEvents = useRef(new Map());
  const [connected, setConnected] = useState(false);
  const subscribe = useCallback((listener) => { listeners.current.add(listener); return () => listeners.current.delete(listener); }, []);

  useEffect(() => {
    if (!admin?.token) return undefined;
    const client = new Client({
      brokerURL: endpoint(), connectHeaders: { Authorization: `Bearer ${admin.token}` },
      reconnectDelay: 3000, heartbeatIncoming: 10000, heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);
        client.subscribe('/topic/admin/realtime', (frame) => {
          try {
            const event = JSON.parse(frame.body);
            if (!event?.eventId || seenEvents.current.has(event.eventId)) return;
            seenEvents.current.set(event.eventId, Date.now());
            for (const [id, receivedAt] of seenEvents.current) if (Date.now() - receivedAt > 60000) seenEvents.current.delete(id);
            listeners.current.forEach((listener) => listener(event));
          } catch { /* Ignore malformed realtime envelopes. */ }
        });
      },
      onDisconnect: () => setConnected(false), onWebSocketClose: () => setConnected(false), onStompError: () => setConnected(false),
    });
    client.activate();
    return () => { setConnected(false); client.deactivate(); };
  }, [admin?.token]);
  return <RealtimeContext.Provider value={{ connected, subscribe }}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => useContext(RealtimeContext);
