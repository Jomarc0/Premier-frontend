import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FiBell, FiLogOut } from 'react-icons/fi';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 grid grid-cols-[1fr_auto] items-center gap-4 min-h-[4.2rem] px-5 py-2.5 bg-[#8f151d] text-white shadow-[0_6px_18px_rgba(80,12,17,0.22)]">

      {/* Brand */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-3 min-w-0 no-underline text-white"
      >
        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden">
          <span className="text-[#8f151d] font-black text-sm">PT</span>
        </div>
        <span className="font-black text-[1.1rem] overflow-hidden text-ellipsis whitespace-nowrap">
          PREMIER TRANSIT
        </span>
      </Link>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2.5">
        {/* NotificationBell handles its own bell + dropdown */}
        <NotificationBell />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-lg border-2 border-white/80 bg-transparent text-white font-extrabold text-sm hover:bg-white/10 transition-colors"
        >
          <FiLogOut className="text-base shrink-0" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;