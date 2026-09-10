import { DriverContext } from './DriverAuthState';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';



export const DriverProvider = ({ children }) => {
    const navigate = useNavigate();

    // Hydrate from localStorage so state survives a page refresh
    const [driverInfo, setDriverInfo] = useState(() => {
        try {
            const raw = sessionStorage.getItem('driverInfo');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });


    const loginDriver = (data) => {

        sessionStorage.setItem('driverToken', data.token);
        // Persist the rest of the login payload
        sessionStorage.setItem('driverInfo', JSON.stringify(data));
        setDriverInfo(data);
    };

    const logoutDriver = () => {
        sessionStorage.removeItem('driverToken');
        sessionStorage.removeItem('driverInfo');
        setDriverInfo(null);
        navigate('/login');
    };

    return (
        <DriverContext.Provider value={{ driverInfo, loginDriver, logoutDriver }}>
            {children}
        </DriverContext.Provider>
    );
};


