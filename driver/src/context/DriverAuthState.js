import { createContext, useContext } from 'react';
export const DriverContext = createContext(null);
export const useDriver = () => {
    const ctx = useContext(DriverContext);
    if (!ctx) throw new Error('useDriver must be used within DriverProvider');
    return ctx;
};
