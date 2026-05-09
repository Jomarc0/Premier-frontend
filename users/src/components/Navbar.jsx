import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { FiLogOut, FiUser } from 'react-icons/fi';
import NotificationBell from './NotificationBell';
import logo from '../assets/image/premier-logo.png';
const Navbar = () => {
  const { logout, passenger } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const passengerName = passenger?.name || 'Maria';

  return (
    <nav className="fixed top-0 inset-x-0 bg-[#7B181E] h-16 flex items-center justify-between px-4 md:px-8 z-50 shadow-lg">
      <Link 
        to="/dashboard" 
        className="flex items-center gap-2 md:gap-3 no-underline text-white group"
      >
        <div className="bg-white w-10 h-10 md:w-11 md:h-11 rounded-full shadow-inner flex items-center justify-center overflow-hidden border border-white/20 transition-transform group-hover:scale-105">
          <img 
            src={logo}
            alt="Premier Logo" 
            className="w-8 h-8 object-contain" 
          />
        </div>
        
        <span className="text-white font-black tracking-tighter text-base md:text-xl italic uppercase block overflow-hidden truncate">
          Premier Transport Corporation
        </span>
      </Link>

      <div className="flex items-center gap-3 md:gap-5">
        <NotificationBell />

        <div className="flex items-center gap-2 md:gap-3 pl-3 md:pl-4 border-l border-white/20">
          <div className="text-right hidden sm:block">
            <p className="text-[9px] text-white/60 font-bold uppercase tracking-widest leading-none">Passenger</p>
          </div>
          
          <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-yellow-400 text-[#7B181E] flex items-center justify-center border-2 border-white/20 shrink-0 shadow-sm" title="Passenger Profile">
            <FiUser className="text-sm md:text-base font-bold" />
          </div>

          <button
            onClick={handleLogout}
            title="Log out of system"
            className="inline-flex items-center justify-center h-8 w-8 md:h-10 md:w-10 rounded-xl bg-black/15 hover:bg-black/30 text-white/90 hover:text-white transition-all border border-white/10 cursor-pointer ml-1 shrink-0"
          >
            <FiLogOut className="text-sm md:text-base" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
