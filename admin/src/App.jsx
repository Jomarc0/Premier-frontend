import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLoginPage    from './pages/AdminLoginPage';
import TransactionsPage  from './pages/TransactionsPage';
import ReportsPage       from './pages/ReportsPage';
import AllUsersPage      from './pages/AllUsersPage';
import CreateUserPage    from './pages/CreateUserPage';
import VehicleMonitoringPage from './pages/VehicleMonitoringPage';
import ManageAdminsPage  from './pages/ManageAdminsPage';
import ActivityLogsPage  from './pages/ActivityLogsPage';
import DriversPage       from './pages/DriverPage';
import VehiclesPage      from './pages/VehiclesPage';
import AdminSecurityPage from './pages/AdminSecurityPage';
import CardFreezeRequestsPage from './pages/CardFreezeRequestsPage';

const AdminRoute = ({ children }) => {
    const { admin, loading } = useAdminAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex', justifyContent: 'center',
                alignItems: 'center', height: '100vh',
                background: '#1e2a45', color: 'white',
                fontSize: 18, fontFamily: 'Segoe UI, sans-serif',
            }}>
                Loading...
            </div>
        );
    }

    const token = localStorage.getItem('adminToken');
    if (!admin && !token) {
        return <Navigate to="/admin/login" replace />;
    }

    return children;
};

const SuperAdminRoute = ({ children }) => {
    const { admin, loading } = useAdminAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex', justifyContent: 'center',
                alignItems: 'center', height: '100vh',
                background: '#1e2a45', color: 'white',
                fontSize: 18, fontFamily: 'Segoe UI, sans-serif',
            }}>
                Loading...
            </div>
        );
    }

    const token = localStorage.getItem('adminToken');
    const role  = localStorage.getItem('adminRole');

    if (!admin && !token) {
        return <Navigate to="/admin/login" replace />;
    }

    const isSuperAdmin = admin?.role === 'SUPER_ADMIN' || role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
        return (
            <div style={{
                display: 'flex', justifyContent: 'center',
                alignItems: 'center', height: '100vh',
                background: '#f0f2f5', flexDirection: 'column',
                gap: 16, fontFamily: 'Segoe UI, sans-serif',
            }}>
                <div style={{ fontSize: 48 }}>!</div>
                <h2 style={{ color: '#dc2626', margin: 0, fontSize: 20 }}>
                    Access Denied
                </h2>
                <p style={{ color: '#6b7280' }}>Super Admin only.</p>
                <button
                    onClick={() => window.history.back()}
                    style={{
                        padding: '10px 24px', background: '#1a237e',
                        border: 'none', borderRadius: 8,
                        color: 'white', fontWeight: 700, cursor: 'pointer',
                    }}
                >
                    &larr; Go Back
                </button>
            </div>
        );
    }

    return children;
};

function App() {
    return (
        <AdminAuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route path="/admin" element={
                        <AdminRoute><ReportsPage /></AdminRoute>
                    } />

                    <Route path="/admin/reports" element={
                        <AdminRoute><ReportsPage /></AdminRoute>
                    } />
                    <Route path="/admin/transactions" element={
                        <AdminRoute><TransactionsPage /></AdminRoute>
                    } />
                    <Route path="/admin/users" element={
                        <AdminRoute><AllUsersPage /></AdminRoute>
                    } />
                    <Route path="/admin/create-user" element={
                        <AdminRoute><CreateUserPage /></AdminRoute>
                    } />
                    <Route path="/admin/vehicle-monitoring" element={
                        <AdminRoute><VehicleMonitoringPage /></AdminRoute>
                    } />
                    <Route path="/admin/drivers" element={
                        <AdminRoute><DriversPage /></AdminRoute>
                    } />
                    <Route path="/admin/vehicles" element={
                        <AdminRoute><VehiclesPage /></AdminRoute>
                    } />
                    <Route path="/admin/security" element={
                        <AdminRoute><AdminSecurityPage /></AdminRoute>
                    } />
                    <Route path="/admin/card-freeze-requests" element={
                        <AdminRoute><CardFreezeRequestsPage /></AdminRoute>
                    } />

                    <Route path="/admin/logs" element={
                        <SuperAdminRoute><ActivityLogsPage /></SuperAdminRoute>
                    } />
                    <Route path="/admin/manage-admins" element={
                        <SuperAdminRoute><ManageAdminsPage /></SuperAdminRoute>
                    } />

                    <Route path="*" element={<Navigate to="/admin/reports" replace />} />
                </Routes>
                <ToastContainer position="top-right" autoClose={3000} />
            </BrowserRouter>
        </AdminAuthProvider>
    );
}

export default App;

