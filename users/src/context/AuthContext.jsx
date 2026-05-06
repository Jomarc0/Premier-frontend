import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

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
                        localStorage.clear();
                    }
                } catch (error) {
                    localStorage.clear();
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
            localStorage.clear();
            setPassenger(null);
        }
    };

    const logout = () => {
        localStorage.clear();
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