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
        <aside
            aria-label="Admin navigation"
            className="sticky top-0 grid grid-rows-[auto_auto_1fr_auto] h-screen px-[0.9rem] pt-[1.35rem] pb-4 bg-maroon text-white max-[1060px]:static max-[1060px]:h-auto"
        >
            {/* Logo */}
            <div className="grid justify-items-center pb-[1.1rem] border-b border-white/10 text-center max-[1060px]:justify-items-start max-[1060px]:grid-cols-[auto_1fr] max-[1060px]:gap-x-[0.85rem] max-[1060px]:text-left">
                <img
                    src={logo}
                    alt="Premier Transit Logo"
                    className="w-13 h-13 rounded-full object-cover mb-2.5 max-[1060px]:row-span-2 max-[1060px]:w-[3.2rem] max-[1060px]:h-[3.2rem] max-[1060px]:m-0"
                />
                <strong className="text-[1.05rem] font-black tracking-[0.04em]">PREMIER TRANSIT</strong>
                <span className="mt-[0.2rem] text-white/75 text-[0.78rem]">Admin Panel</span>
            </div>

            {/* Admin Info */}
            <div className="px-[0.4rem] py-[0.9rem] border-b border-white/10">
                <span className="block text-white text-[0.88rem] font-extrabold overflow-hidden text-ellipsis whitespace-nowrap">
                    {admin?.fullName || 'Admin'}
                </span>
                <span className="block mt-[0.2rem] text-white/70 text-[0.75rem] overflow-hidden text-ellipsis whitespace-nowrap">
                    @{admin?.username || ''}
                </span>
                <span
                    className={[
                        'inline-flex items-center gap-[0.3rem] mt-[0.55rem] px-[0.6rem] py-[0.22rem] rounded-full text-[0.7rem] font-black tracking-[0.02em]',
                        isSuperAdmin()
                            ? 'bg-gold text-maroon'
                            : 'bg-white/20 text-white',
                    ].join(' ')}
                >
                    {isSuperAdmin() ? (
                        <><FiShield /> Super Admin</>
                    ) : (
                        <><FiUser /> Admin</>
                    )}
                </span>
            </div>

            {/* Menu */}
            <nav className="grid content-start gap-[0.3rem] pt-[0.85rem] overflow-y-auto max-[1060px]:grid-cols-3 max-[1060px]:overflow-y-visible max-[560px]:grid-cols-1">
                {visibleMenu.map((item) => {
                    const Icon   = item.icon;
                    const active = location.pathname === item.path;

                    return (
                        <button
                            key={item.path}
                            type="button"
                            onClick={() => navigate(item.path)}
                            className={[
                                'grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-[0.6rem] w-full min-h-[2.55rem] px-[0.7rem] rounded-lg text-[0.86rem] font-extrabold text-left cursor-pointer transition-colors',
                                active
                                    ? 'bg-white text-maroon'
                                    : 'bg-transparent text-white/85 hover:bg-white/10 hover:text-white',
                            ].join(' ')}
                        >
                            <Icon />
                            <span>{item.label}</span>
                            {item.superOnly && (
                                <span
                                    className={[
                                        'text-[0.78rem]',
                                        active ? 'text-maroon' : 'text-gold',
                                    ].join(' ')}
                                >
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom */}
            <div className="grid gap-[0.7rem] pt-[0.9rem] border-t border-white/10">
                <div className="px-[0.8rem] py-[0.7rem] rounded-lg bg-white/10">
                    <span className="block text-white/60 text-[0.7rem] mb-[0.15rem]">Logged in as</span>
                    <span className="block text-white text-[0.85rem] font-extrabold overflow-hidden text-ellipsis whitespace-nowrap">
                        {admin?.fullName || 'Admin'}
                    </span>
                    <span
                        className={[
                            'block mt-1 text-[0.72rem] font-black',
                            isSuperAdmin() ? 'text-gold' : 'text-white/85',
                        ].join(' ')}
                    >
                        {isSuperAdmin() ? 'Super Admin' : 'Admin'}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center justify-center gap-[0.45rem] w-full min-h-[2.55rem] px-[0.7rem] rounded-lg bg-white text-maroon font-black text-[0.88rem] cursor-pointer transition-colors hover:bg-gold"
                >
                    <FiLogOut />
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
