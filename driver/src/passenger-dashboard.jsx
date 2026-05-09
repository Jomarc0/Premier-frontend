import React, { useState } from 'react';
import './index.css'
import { 
  Bell, History, MapPin, Zap, MessageSquare, 
  ShieldCheck, Bus, Smartphone, Wallet, 
  ChevronRight, CreditCard, Bot
} from 'lucide-react';
import logoPng from './assets/premier-logo.png';

const PassengerDashboard = () => {
  const [balance] = useState(2875.50);

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-800 pb-10">
     {/* NAVIGATION */}
    <nav className="fixed top-0 inset-x-0 bg-[#7B181E] h-16 flex items-center justify-between px-4 md:px-8 z-50 shadow-lg">
      <div className="flex items-center gap-2 md:gap-3">
    
    {/* CIRCULAR LOGO CONTAINER */}
    <div className="bg-white w-10 h-10 md:w-11 md:h-11 rounded-full shadow-inner flex items-center justify-center overflow-hidden border border-white/20">
      <img 
        src={logoPng} 
        alt="Premier Logo" 
        className="w-8 h-8 object-contain" 
      />
    </div>
    
    <span className="text-white font-black tracking-tighter text-lg md:text-xl italic uppercase">
      Premier Transport Corporation
    </span>
  </div>
        <div className="flex items-center gap-3 md:gap-5">
          <button className="text-white/80 hover:text-white p-2 relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full border-2 border-[#7B181E]"></span>
          </button>
          <div className="flex items-center gap-2 md:gap-3 pl-3 md:pl-4 border-l border-white/20">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] text-white/60 font-bold uppercase">RFID Passenger</p>
              <p className="text-xs md:text-sm text-white font-bold leading-tight">Maria</p>
            </div>
            <img 
              src="https://ui-avatars.com/api/?name=Maria&background=FFD54F&color=7B181E&bold=true" 
              className="h-8 w-8 md:h-10 md:w-10 rounded-xl border-2 border-white/20" 
              alt="profile" 
            />
          </div>
        </div>
      </nav>

      {/* HEADER */}
      <header className="pt-24 pb-32 md:pb-40 bg-[#7B181E] relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="w-full md:w-auto">
            <div className="inline-flex items-center gap-2 bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase mb-3 border border-yellow-400/30">
              <ShieldCheck size={12} /> Secure RFID Connection Active
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Welcome, Passenger!</h2>
            <p className="text-white/60 text-sm md:text-base font-medium mt-1">Manage your transit account and trip history.</p>
          </div>
          <div className="bg-black/20 backdrop-blur-xl p-3 rounded-2xl border border-white/10 w-full md:w-auto">
             <div className="font-mono text-white/80 text-[10px] md:text-xs">
                CARD_UID: <span className="text-yellow-400 font-bold">88:04:AB:22</span>
             </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 -mt-20 md:mt-[-5rem] relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-6 md:space-y-8">
            {/* BALANCE CARD */}
            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-2xl overflow-hidden border border-white">
              <div className="p-6 md:p-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                  <p className="text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest mb-1">Current Load Balance</p>
                  <h3 className="text-4xl md:text-6xl font-black text-slate-900 flex items-start gap-1">
                     <span className="text-xl md:text-2xl mt-2 md:mt-3 text-slate-400 font-bold">₱</span> 
                     {balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </h3>
                </div>
                <button className="w-full sm:w-auto bg-[#234B20] hover:bg-[#1a3818] text-white px-8 py-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 font-bold text-sm">
                  <Zap size={18} fill="currentColor" /> TOP UP ACCOUNT
                </button>
              </div>
              <div className="bg-slate-50 px-6 md:px-10 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                 <p className="text-slate-500 text-[10px] md:text-[11px] font-medium italic">
                    Distance-based fare deduction active for Bus Route 3.
                 </p>
                 <div className="text-[10px] font-bold text-[#7B181E] bg-[#7B181E]/5 px-3 py-1 rounded-full uppercase">Account: Active</div>
              </div>
            </div>

            {/* MOVED: DIGITAL WALLETS (Now in Left Column) */}
            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 border border-white shadow-xl">
               <h4 className="font-black text-slate-900 mb-6 flex items-center gap-2 text-sm md:text-base uppercase tracking-tighter">
                 <CreditCard size={18} className="text-[#7B181E]" /> Linked Payment Methods
               </h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black text-xs">GC</div>
                        <span className="font-bold text-sm">GCash Wallet</span>
                     </div>
                     <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-500 font-black text-xs">M</div>
                        <span className="font-bold text-sm text-slate-500">Maya</span>
                     </div>
                     <span className="text-[10px] font-black text-[#7B181E] bg-[#7B181E]/5 px-3 py-1 rounded-lg uppercase cursor-pointer hover:bg-[#7B181E] hover:text-white transition-colors">Link Now</span>
                  </div>
               </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="lg:col-span-4 space-y-6">
            {/* MOVED: TRIP ACTIVITY AUDIT (Now in Sidebar) */}
            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] p-6 shadow-xl border border-white">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-base flex items-center gap-2 tracking-tight">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[#7B181E]">
                    <History size={16} />
                  </div>
                  Recent Trips
                </h3>
                <button className="text-[#7B181E] font-bold text-[10px] bg-[#7B181E]/5 px-3 py-1.5 rounded-lg">All</button>
              </div>

              <div className="space-y-3">
                {[
                  { type: 'Fare', amt: '-50.00', loc: 'SM Lipa', date: 'Today' },
                  { type: 'Fare', amt: '-50.00', loc: 'Batangas City', date: 'Yesterday' },
                  { type: 'Load', amt: '+500.00', loc: 'GCash', date: '04 May', isCredit: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-transparent">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.isCredit ? 'bg-green-100 text-green-600' : 'bg-white text-slate-400'}`}>
                        {item.isCredit ? <Smartphone size={14} /> : <MapPin size={14} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{item.loc}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{item.date}</p>
                      </div>
                    </div>
                    <p className={`font-black text-sm ${item.isCredit ? 'text-green-600' : 'text-slate-900'}`}>
                      {item.amt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* CHATBOT */}
      <div className="fixed bottom-6 right-6 z-[60]">
        <button className="bg-[#7B181E] text-white p-4 rounded-2xl shadow-2xl hover:bg-[#5a1216] transition-all active:scale-90 group relative">
          <Bot size={28} className="group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></span>
        </button>
      </div>
    </div>
  );
};

export default PassengerDashboard;