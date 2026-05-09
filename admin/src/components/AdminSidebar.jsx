import { useNavigate, useLocation } from 'react-router-dom';
import {
    FiFileText,
    FiUsers,
    FiUserPlus,
    FiTruck,
    FiActivity,
    FiAlertTriangle,
    FiClock,
    FiShield,
    FiUser,
    FiLogOut,
} from 'react-icons/fi';
import { useAdminAuth } from '../context/AdminAuthContext';
import logo from '../assets/image/premier-logo.png';

const AdminSidebar = () => {
    const navigate     = useNavigate();
    const location     = useLocation();
    const auth         = useAdminAuth();

    const admin        = auth?.admin;
    const logout       = auth?.logout       || (() => {});
    const isSuperAdmin = auth?.isSuperAdmin || (() => false);

    const menu = [
        { label: 'Transactions',  icon: FiFileText,      path: '/admin/transactions',  superOnly: false },
        { label: 'All Users',     icon: FiUsers,         path: '/admin/users',         superOnly: false },
        { label: 'Create User',   icon: FiUserPlus,      path: '/admin/create-user',   superOnly: false },
        { label: 'Drivers',       icon: FiUsers,         path: '/admin/drivers',       superOnly: false },
        { label: 'Vehicles',      icon: FiTruck,         path: '/admin/vehicles',      superOnly: false },
        { label: 'Reports',       icon: FiActivity,      path: '/admin/reports',       superOnly: false },
        { label: 'Emergency Map', icon: FiAlertTriangle, path: '/admin/emergency-map', superOnly: false },
        { label: 'Activity Logs', icon: FiClock,         path: '/admin/logs',          superOnly: true  },
        { label: 'Manage Admins', icon: FiShield,        path: '/admin/manage-admins', superOnly: true  },
    ];

    const visibleMenu = menu.filter(
        item => !item.superOnly || isSuperAdmin()
    );

    return (
        <aside className="admin-sidebar" aria-label="Admin navigation">
            {/* Logo */}
            <div className="admin-sidebar-brand">
                <img
                    src={logo}
                    alt="Premier Transit Logo"
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        marginBottom: 10,
                    }}
                />
                <strong>PREMIER TRANSIT</strong>
                <span>Admin Panel</span>
            </div>

            {/* Admin Info */}
            <div className="admin-sidebar-info">
                <span className="name">
                    {admin?.fullName || 'Admin'}
                </span>
                <span className="username">
                    @{admin?.username || ''}
                </span>
                <span className={`role-pill ${isSuperAdmin() ? 'super' : 'regular'}`}>
                    {isSuperAdmin() ? (
                        <><FiShield /> Super Admin</>
                    ) : (
                        <><FiUser /> Admin</>
                    )}
                </span>
            </div>

            {/* Menu */}
            <nav className="admin-menu">
                {visibleMenu.map((item) => {
                    const Icon   = item.icon;
                    const active = location.pathname === item.path;

                    return (
                        <button
                            key={item.path}
                            type="button"
                            onClick={() => navigate(item.path)}
                            className={active ? 'active' : ''}
                        >
                            <Icon />
                            <span>{item.label}</span>
                            {item.superOnly && (
                                <span className="super-star">★</span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom */}
            <div className="admin-sidebar-footer">
                <div className="logged-in-card">
                    <span className="label">Logged in as</span>
                    <span className="value">{admin?.fullName || 'Admin'}</span>
                    <span className={`role ${isSuperAdmin() ? 'super' : 'regular'}`}>
                        {isSuperAdmin() ? '★ Super Admin' : 'Admin'}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={logout}
                    className="admin-sidebar-logout"
                >
                    <FiLogOut />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;