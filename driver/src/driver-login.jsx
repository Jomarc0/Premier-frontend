import React, { useState } from 'react';
import { ShieldCheck, Lock, Info } from 'lucide-react';
import logoPng from './assets/premier-logo.png';

const DriverLogin = () => {
  const [plateNumber, setPlateNumber] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    console.log("Logging in vehicle:", plateNumber);
    // Authentication logic goes here
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full">
        {/* CARD CONTAINER */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white relative">
          {/* TOP DECORATIVE BAR */}
          <div className="h-2 bg-[#991B1B] w-full" />
          
          <div className="p-8 md:p-10">
            {/* LOGO SECTION */}
            <div className="flex flex-col items-center mb-8">
              {/* LARGER CIRCULAR CONTAINER WITH THICK MAROON BORDER */}
              <div className="w-28 h-28 md:w-32 md:h-32 mb-4 flex items-center justify-center p-4 rounded-full bg-white border-2 border-[#991B1B] shadow-2xl overflow-hidden">
                <img 
                  src={logoPng} 
                  alt="Premier Logo" 
                  className="w-full h-full object-contain" 
                />
              </div>
              
              <h1 className="text-[#991B1B] text-2xl font-black uppercase text-center leading-tight">
                Premier Class 3 <br/>
                <span className="text-slate-400 text-sm font-bold">Transport Corporation</span>
              </h1>
            </div>

            {/* FORM SECTION */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="text-center">
                <h2 className="text-slate-800 font-black text-lg">Enter Your Vehicle Number</h2>
                <p className="text-slate-400 text-xs font-medium">Please provide your assigned plate number to start shift.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Vehicle Plate Number</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={plateNumber}
                    // Automatically convert input to uppercase (e.g., dar-8764 -> DAR-8764)
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    placeholder="DAR-8764"
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-5 px-6 text-center text-2xl font-black tracking-widest text-[#991B1B] focus:border-yellow-400 focus:ring-0 outline-none transition-all placeholder:text-slate-300"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-400 text-center font-bold italic">Type the plate number from your vehicle</p>
              </div>

              <button 
                type="submit"
                className="w-full bg-[#991B1B] hover:bg-[#7F1D1D] text-white py-5 rounded-2xl font-black text-sm shadow-xl shadow-[#991B1B]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase"
              >
                <Lock size={18} />
                Confirm & Login
              </button>
            </form>

            {/* INFO BOX */}
            <div className="mt-8 bg-green-50 border border-green-100 rounded-2xl p-4 flex gap-4">
              <div className="bg-green-500/10 p-2 rounded-lg h-fit">
                <Info size={16} className="text-green-600" />
              </div>
              <div>
                <h4 className="text-green-800 text-xs font-black uppercase">Automatic Shift Tracking</h4>
                <p className="text-green-700/70 text-[11px] font-medium leading-relaxed mt-1">
                  Your shift will start automatically when you log in. Make sure to log out when your shift ends.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <p className="text-center mt-8 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          © 2026 Premier Class 3 Transport Corp. | <span className="text-[#991B1B]">Secure Access</span>
        </p>
      </div>
    </div>
  );
};

export default DriverLogin;