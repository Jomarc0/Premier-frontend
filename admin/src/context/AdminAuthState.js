import { createContext, useContext } from 'react';
export const AdminAuthContext = createContext();
export const useAdminAuth = () => useContext(AdminAuthContext);
