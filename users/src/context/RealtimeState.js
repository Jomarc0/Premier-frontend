import { createContext, useContext } from 'react';
export const RealtimeContext = createContext({ connected: false, subscribe: () => () => {} });
export const useRealtime = () => useContext(RealtimeContext);
