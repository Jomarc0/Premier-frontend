import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { FiLogOut, FiShield, FiUser } from 'react-icons/fi';
import NotificationBell from './NotificationBell';
import PrivacyNoticeModal from './PrivacyNoticeModal';
import logo from '../assets/image/logo-premier.webp';
const Navbar = () => {
  const { logout, passenger } = useAuth();
  const navigate = useNavigate();
  const [privacyNoticeOpen, setPrivacyNoticeOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const passengerName = passenger?.name || 'Maria';

  return (
    <nav className="fixed top-0 inset-x-0 z-50 flex h-16 items-center justify-between border-b border-[#651F2D] bg-[#7A2635] px-3 md:px-8">
      <Link 
        to="/dashboard" 
        className="flex items-center gap-2 md:gap-3 no-underline text-white group"
      >
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white md:h-11 md:w-11">
          <img 
            src={logo}
            alt="Premier" 
            className="w-8 h-8 object-contain" 
          />
        </div>
        
        <span className="block max-w-28 overflow-hidden truncate text-sm font-black tracking-tight text-white min-[391px]:max-w-40 md:max-w-none md:text-lg">
          Premier Transport Corporation
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-2 md:gap-5">
        <NotificationBell />

        <div className="flex items-center gap-2 border-l border-white/20 pl-2 md:gap-3 md:pl-4">
          <div className="text-right hidden sm:block">
            <p className="text-[9px] font-bold uppercase tracking-widest leading-none text-white/65">Passenger</p>
          </div>
          
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[#651F2D] md:h-9 md:w-9" title="Passenger Profile">
            <FiUser className="text-sm md:text-base font-bold" />
          </div>

          <button
            type="button"
            onClick={() => setPrivacyNoticeOpen(true)}
            title="Open Privacy Notice"
            aria-label="Open Privacy Notice"
            className="hidden h-8 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/8 px-3 text-white/90 transition hover:bg-white/15 hover:text-white min-[391px]:inline-flex md:h-9"
          >
            <FiShield className="text-sm md:text-base" />
            <span className="hidden lg:inline text-[11px] font-black uppercase tracking-wider">
              Privacy
            </span>
          </button>

          <button
            onClick={handleLogout}
            title="Log out of system"
            className="ml-0 inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg bg-white/10 px-2 text-white transition hover:bg-white/18 cursor-pointer border border-white/15 md:ml-1 md:h-9 md:px-3"
          >
            <FiLogOut className="text-sm md:text-base" />
            <span className="hidden md:inline text-[11px] font-black uppercase tracking-wider">
              Logout
            </span>
          </button>
        </div>
      </div>

      <PrivacyNoticeModal
        open={privacyNoticeOpen}
        onClose={() => setPrivacyNoticeOpen(false)}
      />
    </nav>
  );
};

export default Navbar;
