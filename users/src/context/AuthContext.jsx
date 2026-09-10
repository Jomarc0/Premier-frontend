import { AuthContext } from './AuthState';
import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { clearAuthStorage } from '../lib/authStorage';
import { identifyUser, resetAnalytics } from '../lib/posthog';




export const AuthProvider = ({ children }) => {
    const [passenger, setPassenger] = useState(null);
    const [loading, setLoading] = useState(true); 

    useEffect(() => {
        const initAuth = async () => {
            const token = sessionStorage.getItem('token');
            //console.log('AuthContext init - token:', token ? 'EXISTS' : 'MISSING');
            
            if (token) {
                try {
                    const decoded = jwtDecode(token);
                    
                    if (decoded.exp * 1000 > Date.now()) {
                        setPassenger({
                            id: decoded.sub,
                            name: sessionStorage.getItem('passengerName'),
                            token: token
                        });
                        identifyUser(decoded.sub, { role: 'passenger' });
                        //console.log('Passenger set from token');
                    } else {
                        clearAuthStorage();
                    }
                } catch {
                    clearAuthStorage();
                }
            }
            
            setLoading(false);
            //console.log('AuthContext loading complete');
        };

        initAuth();
    }, []);

    const login = (token, name) => {
        //console.log('login called:', { token: !!token, name });
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('passengerName', name);
        
        try {
            const decoded = jwtDecode(token);
            setPassenger({
                id: decoded.sub,
                name: name,
                token: token
            });
            identifyUser(decoded.sub, { role: 'passenger' });
           // console.log('login set passenger:', decoded.sub);
        } catch {
            //console.error('login JWT error:', error);
            clearAuthStorage();
            setPassenger(null);
        }
    };

    const logout = () => {
        resetAnalytics();
        clearAuthStorage();
        setPassenger(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ passenger, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

