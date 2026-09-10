import { useContext } from 'react';
import { AdminAuthContext } from './AdminAuthState';

export const useAdminAuth = () => useContext(AdminAuthContext);