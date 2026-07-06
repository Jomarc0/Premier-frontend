import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import driverAPI from '../api/driverAxios';
import { useDriver } from '../context/DriverContext';
import { toast } from 'react-toastify';
import { Lock, Info } from 'lucide-react';
import logo from '../assets/image/logo-premier.webp';
import { BRAND_NAME, FOOTER_TEXT } from '../constants/brand';

const LoginPage = () => {
    const navigate = useNavigate();
    const { loginDriver } = useDriver();
    const [plateNumber, setPlateNumber] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!plateNumber.trim()) {
            toast.warning('Please enter your vehicle plate number');
            return;
        }
        setLoading(true);
        try {
            const res = await driverAPI.post('/login', {
                plateNumber: plateNumber.toUpperCase(),
            });
            loginDriver(res.data.data);
            toast.success('Shift started! Drive safely.');
            navigate('/dashboard');
        } catch (err) {
            toast.error(
                err.response?.data?.message ||
                'Login failed. Check plate number.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-[Poppins]">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white relative">
                    <div className="h-2 bg-brand-primary w-full" />

                    <div className="p-8 md:p-10">
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-28 h-28 md:w-32 md:h-32 mb-4 rounded-full overflow-hidden shadow-2xl border-2 border-brand-primary">
                                <img
                                    src={logo}
                                    alt="Premier"
                                    className="w-full h-full object-contain"
                                />
                            </div>

                            <h1 className="text-brand-primary text-2xl font-black uppercase text-center leading-tight">
                                {BRAND_NAME}
                                <span className="block text-sm font-bold normal-case text-text-body">Driver Portal</span>
                            </h1>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-slate-800 font-black text-lg">Enter Your Vehicle Number</h2>
                                <p className="text-slate-400 text-xs font-medium">
                                    Please provide your assigned plate number to start shift.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="ml-1 text-sm font-semibold text-text-body">
                                    Vehicle plate number
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="DAR-8764"
                                        value={plateNumber}
                                        onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                                        required
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-5 px-6 text-center text-2xl font-black tracking-widest text-brand-primary focus:border-brand-accent focus:ring-0 outline-none transition-all placeholder:text-text-placeholder"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 text-center font-bold italic">
                                    Type the plate number from your vehicle
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-5 rounded-2xl font-black text-sm shadow-xl shadow-brand-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase text-white
                                    ${loading
                                        ? 'bg-brand-primary/60 cursor-not-allowed'
                                        : 'bg-brand-primary hover:bg-brand-primary-dark cursor-pointer'
                                    }`}
                            >
                                <Lock size={18} />
                                {loading ? 'Logging In...' : 'Log In'}
                            </button>
                        </form>

                        <div className="mt-8 bg-green-50 border border-green-100 rounded-2xl p-4 flex gap-4">
                            <div className="bg-green-500/10 p-2 rounded-lg h-fit">
                                <Info size={16} className="text-green-600" />
                            </div>
                            <div>
                                <h4 className="text-green-800 text-xs font-black uppercase">
                                    Automatic Shift Tracking
                                </h4>
                                <p className="text-green-700/70 text-[11px] font-medium leading-relaxed mt-1">
                                    Your shift will start automatically when you log in.
                                    Make sure to log out when your shift ends.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-center mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    {FOOTER_TEXT}
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
