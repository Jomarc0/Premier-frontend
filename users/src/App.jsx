import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation }
    from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth }
    from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import TotpSetupPage from './pages/TotpSetupPage';
import TotpVerifyPage from './pages/TotpVerifyPage';
import DashboardPage from './pages/DashboardPage';
import FloatingChatbot from './components/FloatingChatbot';
import { captureEvent } from './lib/posthog';

const PrivateRoute = ({ children }) => {
    const { passenger, loading } = useAuth();
    if (loading) return (
        <div className="min-h-screen flex items-center
            justify-center text-indigo-900 font-bold">
            Loading...
        </div>
    );
    return passenger
        ? children
        : <Navigate to="/login" replace />;
};

function RouteAnalytics() {
    const location = useLocation();

    useEffect(() => {
        captureEvent('passenger_web_page_viewed', {
            path: location.pathname,
        });
    }, [location.pathname]);

    return null;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <RouteAnalytics />
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login"
                        element={<LoginPage />} />
                    <Route path="/totp-setup"
                        element={<TotpSetupPage />} />
                    <Route path="/verify-totp"
                        element={<TotpVerifyPage />} />

                    {/* Protected Routes */}
                    <Route path="/dashboard" element={
                        <PrivateRoute>
                            <DashboardPage />
                        </PrivateRoute>
                    } />

                    {/* Default */}
                    <Route path="*"
                        element={
                            <Navigate to="/login" replace />
                        } />
                </Routes>
                <ToastContainer
                    position="top-right"
                    autoClose={3000}
                />
                <FloatingChatbot />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
