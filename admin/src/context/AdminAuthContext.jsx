// AdminAuthContext.jsx
// FIX for Vite HMR warning:
// "useAdminAuth export is incompatible with Fast Refresh"
//
// Vite Fast Refresh requires that a file either:
//   (a) exports only React components, OR
//   (b) exports only non-component values (hooks, context, etc.)
//
// The old file exported both AdminAuthProvider (component) AND
// useAdminAuth (hook) from the same file — that mix breaks Fast Refresh.
//
// SOLUTION: Keep everything in one file but export useAdminAuth
// from a SEPARATE file (useAdminAuth.js) that imports from here.
// This file only exports the Provider component + context.

import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import adminAPI from '../api/adminAxios';

export const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        restoreSession();
    }, []);

    const restoreSession = () => {
        try {
            const token    = localStorage.getItem('adminToken');
            const fullName = localStorage.getItem('adminName');
            const username = localStorage.getItem('adminUsername');
            const role     = localStorage.getItem('adminRole');

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
        delete adminAPI.defaults.headers.common['Authorization'];
        setAdmin(null);
    };

    const login = (token, fullName, username, role) => {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminName', fullName);
        localStorage.setItem('adminUsername', username);
        localStorage.setItem('adminRole', role);

        try {
            const decoded = jwtDecode(token);
            setAdmin({ token, fullName, username, role, id: decoded.sub });
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

    return (
        <AdminAuthContext.Provider value={{
            admin,
            loading,
            login,
            logout,
            isSuperAdmin,
            isAdmin,
        }}>
            {children}
        </AdminAuthContext.Provider>
    );
};


export const useAdminAuth = () => useContext(AdminAuthContext);