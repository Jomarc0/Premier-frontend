import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { PRIVACY_NOTICE_ACCEPTED_KEY } from '../constants/privacy';

const AuthContext = createContext();

const clearAuthStorage = () => {
    const privacyAccepted = localStorage.getItem(PRIVACY_NOTICE_ACCEPTED_KEY);
    localStorage.clear();
    if (privacyAccepted === 'true') {
        localStorage.setItem(PRIVACY_NOTICE_ACCEPTED_KEY, 'true');
    }
};

export const AuthProvider = ({ children }) => {
    const [passenger, setPassenger] = useState(null);
    const [loading, setLoading] = useState(true); 

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            //console.log('AuthContext init - token:', token ? 'EXISTS' : 'MISSING');
            
            if (token) {
                try {
                    const decoded = jwtDecode(token);
                    
                    if (decoded.exp * 1000 > Date.now()) {
                        setPassenger({
                            id: decoded.sub,
                            name: localStorage.getItem('passengerName'),
                            token: token
                        });
                        //console.log('Passenger set from token');
                    } else {
                        clearAuthStorage();
                    }
                } catch (error) {
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
        localStorage.setItem('token', token);
        localStorage.setItem('passengerName', name);
        
        try {
            const decoded = jwtDecode(token);
            setPassenger({
                id: decoded.sub,
                name: name,
                token: token
            });
           // console.log('login set passenger:', decoded.sub);
        } catch (error) {
            //console.error('login JWT error:', error);
            clearAuthStorage();
            setPassenger(null);
        }
    };

    const logout = () => {
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

export const useAuth = () => useContext(AuthContext);
