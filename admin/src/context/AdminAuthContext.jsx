import { AdminAuthContext } from './AdminAuthState';
import { useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { identifyUser, resetAnalytics } from '../lib/posthog';



export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);
    const [twoFactorEnabled, setTwoFactorEnabledState] = useState(false);

    const clearSession = useCallback(() => {
        for (const key of Object.keys(sessionStorage)) {
            if (key.startsWith('premier:remittance-pending:')) sessionStorage.removeItem(key);
        }
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminName');
        sessionStorage.removeItem('adminUsername');
        sessionStorage.removeItem('adminRole');
        sessionStorage.removeItem('admin2FaEnabled');
        setAdmin(null);
        setTwoFactorEnabledState(false);
    }, []);

    const restoreSession = useCallback(() => {
        try {
            const token    = sessionStorage.getItem('adminToken');
            const fullName = sessionStorage.getItem('adminName');
            const username = sessionStorage.getItem('adminUsername');
            const role     = sessionStorage.getItem('adminRole');
            const savedTwoFactor = sessionStorage.getItem('admin2FaEnabled') === 'true';

            if (!token) return;

            const decoded   = jwtDecode(token);
            const isExpired = decoded.exp * 1000 < Date.now();

            if (isExpired) {
                clearSession();
                return;
            }

            setAdmin({
                token,
                fullName,
                username,
                role,
                id: decoded.sub,
            });
            identifyUser(decoded.sub, { role: role || 'admin' });
            setTwoFactorEnabledState(savedTwoFactor);

        } catch {
            clearSession();
        } finally {
            setLoading(false);
        }
    }, [clearSession]);

    useEffect(() => {
        const initial = window.setTimeout(() => { restoreSession(); }, 0);
        return () => window.clearTimeout(initial);
    }, [restoreSession]);





    const login = (token, fullName, username, role, is2FaEnabled = false) => {
        sessionStorage.setItem('adminToken', token);
        sessionStorage.setItem('adminName', fullName);
        sessionStorage.setItem('adminUsername', username);
        sessionStorage.setItem('adminRole', role);
        sessionStorage.setItem('admin2FaEnabled', String(Boolean(is2FaEnabled)));

        try {
            const decoded = jwtDecode(token);
            setAdmin({ token, fullName, username, role, id: decoded.sub });
            identifyUser(decoded.sub, { role: role || 'admin' });
            setTwoFactorEnabledState(Boolean(is2FaEnabled));
        } catch (err) {
            clearSession();
            throw err;
        }
    };

    const logout = useCallback(() => {
        resetAnalytics();
        clearSession();
        window.location.href = '/admin/login';
    }, [clearSession]);

    const isSuperAdmin = () =>
        admin?.role === 'SUPER_ADMIN' ||
        sessionStorage.getItem('adminRole') === 'SUPER_ADMIN';

    const isAdmin = () => {
        const role = admin?.role || sessionStorage.getItem('adminRole');
        return ['ADMIN', 'SUPER_ADMIN'].includes(role);
    };

    const setTwoFactorEnabled = useCallback((enabled) => {
        const nextValue = Boolean(enabled);
        sessionStorage.setItem('admin2FaEnabled', String(nextValue));
        setTwoFactorEnabledState(nextValue);
    }, []);

    return (
        <AdminAuthContext.Provider value={{
            admin,
            loading,
            login,
            logout,
            isSuperAdmin,
            isAdmin,
            twoFactorEnabled,
            setTwoFactorEnabled,
        }}>
            {children}
        </AdminAuthContext.Provider>
    );
};


