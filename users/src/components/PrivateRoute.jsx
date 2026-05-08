import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { passenger, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--page-bg)' }}>
        <div className="flex flex-col items-center space-y-4 p-8">
          <div className="w-12 h-12 border-4 rounded-full animate-spin"
            style={{
              borderColor: '#fae7e9',
              borderTopColor: 'var(--brand-maroon)'
            }} />
          <div className="text-xl font-semibold" style={{ color: 'var(--text-main)' }}>
            Loading your account...
          </div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Please wait while we verify your session
          </div>
        </div>
      </div>
    );
  }

  return passenger ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
