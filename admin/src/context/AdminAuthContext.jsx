import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import adminAPI from '../api/adminAxios';

export const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);
    const [twoFactorEnabled, setTwoFactorEnabledState] = useState(false);

    useEffect(() => {
        restoreSession();
    }, []);

    const restoreSession = () => {
        try {
            const token    = localStorage.getItem('adminToken');
            const fullName = localStorage.getItem('adminName');
            const username = localStorage.getItem('adminUsername');
            const role     = localStorage.getItem('adminRole');
            const savedTwoFactor = localStorage.getItem('admin2FaEnabled') === 'true';

            if (!token) return;

            const decoded   = jwtDecode(token);
            const isExpired = decoded.exp * 1000 < Date.now();

            if (isExpired) {
                clearSession();
                return;
            }

            adminAPI.defaults.headers.common['Authorization'] =
                `Bearer ${token}`;

            setAdmin({
                token,
                fullName,
                username,
                role,
                id: decoded.sub,
            });
            setTwoFactorEnabledState(savedTwoFactor);

        } catch (err) {
            clearSession();
        } finally {
            setLoading(false);
        }
    };

    const clearSession = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminName');
        localStorage.removeItem('adminUsername');
        localStorage.removeItem('adminRole');
        localStorage.removeItem('admin2FaEnabled');
        delete adminAPI.defaults.headers.common['Authorization'];
        setAdmin(null);
        setTwoFactorEnabledState(false);
    };

    const login = (token, fullName, username, role, is2FaEnabled = false) => {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminName', fullName);
        localStorage.setItem('adminUsername', username);
        localStorage.setItem('adminRole', role);
        localStorage.setItem('admin2FaEnabled', String(Boolean(is2FaEnabled)));

        try {
            const decoded = jwtDecode(token);
            setAdmin({ token, fullName, username, role, id: decoded.sub });
            setTwoFactorEnabledState(Boolean(is2FaEnabled));
            adminAPI.defaults.headers.common['Authorization'] =
                `Bearer ${token}`;
        } catch (err) {
            clearSession();
            throw err;
        }
    };

    const logout = () => {
        clearSession();
        window.location.href = '/admin/login';
    };

    const isSuperAdmin = () =>
        admin?.role === 'SUPER_ADMIN' ||
        localStorage.getItem('adminRole') === 'SUPER_ADMIN';

    const isAdmin = () => {
        const role = admin?.role || localStorage.getItem('adminRole');
        return ['ADMIN', 'SUPER_ADMIN'].includes(role);
    };

    const setTwoFactorEnabled = (enabled) => {
        const nextValue = Boolean(enabled);
        localStorage.setItem('admin2FaEnabled', String(nextValue));
        setTwoFactorEnabledState(nextValue);
    };

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


export const useAdminAuth = () => useContext(AdminAuthContext);
