import { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DriverContext = createContext(null);

export const DriverProvider = ({ children }) => {
    const navigate = useNavigate();

    // Hydrate from localStorage so state survives a page refresh
    const [driverInfo, setDriverInfo] = useState(() => {
        try {
            const raw = localStorage.getItem('driverInfo');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });


    const loginDriver = (data) => {

        localStorage.setItem('driverToken', data.token);
        // Persist the rest of the login payload
        localStorage.setItem('driverInfo', JSON.stringify(data));
        setDriverInfo(data);
    };

    const logoutDriver = () => {
        localStorage.removeItem('driverToken');
        localStorage.removeItem('driverInfo');
        setDriverInfo(null);
        navigate('/login');
    };

    return (
        <DriverContext.Provider value={{ driverInfo, loginDriver, logoutDriver }}>
            {children}
        </DriverContext.Provider>
    );
};


export const useDriver = () => {
    const ctx = useContext(DriverContext);
    if (!ctx) throw new Error('useDriver must be used within DriverProvider');
    return ctx;
};

export default DriverContext;