import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { API_BASE_URL } from '../config';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext({ connected: false, lastEvent: null });
const brokerURL = `${API_BASE_URL.replace(/^http/i, 'ws')}/ws-native`;

export function RealtimeProvider({ children }) {
  const { passenger } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const seen = useRef(new Map());

  useEffect(() => {
    if (!passenger?.token) return undefined;
    const client = new Client({
      brokerURL,
      connectHeaders: { Authorization: `Bearer ${passenger.token}` },
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);
        client.subscribe('/user/queue/realtime', (frame) => {
          try {
            const event = JSON.parse(frame.body);
            if (!event?.eventId || seen.current.has(event.eventId)) return;
            seen.current.set(event.eventId, Date.now());
            for (const [id, timestamp] of seen.current) if (Date.now() - timestamp > 60000) seen.current.delete(id);
            setLastEvent(event);
          } catch { /* Ignore malformed realtime envelopes. */ }
        });
      },
      onDisconnect: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
      onStompError: () => setConnected(false),
    });
    client.activate();
    return () => { setConnected(false); client.deactivate(); };
  }, [passenger?.token]);

  const value = useMemo(() => ({ connected, lastEvent }), [connected, lastEvent]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
