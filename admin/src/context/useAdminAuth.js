import { useContext } from 'react';
import { AdminAuthContext } from './AdminAuthContext';

export const useAdminAuth = () => useContext(AdminAuthContext);