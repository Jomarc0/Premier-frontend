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

    /**
     * Called after a successful POST /login.
     * @param {object} data - The `data` field from ApiResponse<LoginResponse>
     *   { shiftId, driverName, plateNumber, route, totalCapacity, token }
     */
    const loginDriver = (data) => {
        // Persist the JWT separately so driverAxios can read it easily
        localStorage.setItem('driverToken', data.token);
        // Persist the rest of the login payload
        localStorage.setItem('driverInfo', JSON.stringify(data));
        setDriverInfo(data);
    };

    /** Clear everything and go back to login. */
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