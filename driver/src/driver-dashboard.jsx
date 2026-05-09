import React from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, LogOut, AlertTriangle, 
  Navigation, Radio, User 
} from 'lucide-react';
import L from 'leaflet';
import logoPng from './assets/premier-logo.png';

// Leaflet Icon Fix
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: markerIcon, shadowUrl: markerShadow,
    iconSize: [25, 41], iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const DriverDashboard = () => {
  const position = [13.9413, 121.1620]; 

  return (
    <div 
      className="flex h-screen bg-[#F1F5F9] overflow-hidden p-3 gap-3"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        `}
      </style>

      {/* LEFT SECTION: MAP */}
      <div className="flex-[2.5] relative rounded-[2rem] overflow-hidden shadow-lg border border-white bg-white">
        
        {/* UPPER MIDDLE: TRAFFIC FLOW */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-max">
          <button className="bg-white/95 backdrop-blur-sm border border-slate-200 py-2 px-5 rounded-xl shadow-lg flex items-center gap-2">
            <Radio size={16} className="text-[#991B1B]" />
            <span className="text-[10px] font-[900] uppercase tracking-wider text-slate-600">Traffic Flow</span>
          </button>
        </div>

        {/* BOTTOM MIDDLE: NAVIGATE (GREEN) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-max">
          <button className="bg-[#2D5A27] py-2.5 px-6 rounded-xl shadow-2xl flex items-center gap-3 border border-white/20 hover:bg-[#23471e] transition-all">
            <Navigation size={16} className="text-white" />
            <span className="text-[10px] font-[900] uppercase tracking-wider text-white">Navigate to Drop-offs</span>
          </button>
        </div>

        <MapContainer center={position} zoom={15} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={position} />
        </MapContainer>
      </div>

      {/* RIGHT PANEL: RED COLOR PALETTE */}
      <aside className="w-[380px] bg-[#F5F5F5] rounded-[2rem] border border-[#E5E5E5] p-5 flex flex-col shadow-xl overflow-hidden h-full">
        
        {/* HEADER SECTION */}
        <div className="shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-full bg-[#991B1B] border-2 border-red-700 flex items-center justify-center shadow-lg shadow-[#991B1B]/20 flex-shrink-0">
              <img src={logoPng} alt="logo" className="w-full h-full rounded-full object-cover" />
            </div>
            <h1 className="text-lg font-[900] uppercase text-[#7F1D1D] leading-tight tracking-tight">
              Roaming Bus <br/> Dashboard
            </h1>
          </div>

          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="uppercase tracking-[0.15em] text-[8px] font-[900] text-[#DC2626] mb-0.5">Driver Profile</p>
              <h2 className="text-xl font-[900] uppercase text-slate-800 leading-none">Juan Dela Cruz</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-[#FEE2E2] text-[#991B1B] text-[9px] font-black px-2 py-0.5 rounded uppercase border border-[#FCA5A5]/30">Unit: DAR-8764</span>
                <span className="text-[#2D6B2D] text-[8px] font-[900] uppercase tracking-widest flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2D6B2D] animate-pulse"></div> GPS Active
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="bg-red-600 text-white rounded-xl w-[60px] h-[60px] flex flex-col items-center justify-center font-black uppercase text-[7px] gap-1 shadow-md hover:bg-red-700 transition-all">
                <AlertTriangle size={20} /> Emergency Alert
              </button>
              <button className="bg-[#E9EDF3] text-slate-500 rounded-xl w-[60px] h-[60px] flex flex-col items-center justify-center font-black uppercase text-[7px] gap-1 shadow-sm hover:bg-slate-200 transition-all">
                <LogOut size={20} /> Exit
              </button>
            </div>
          </div>
          <hr className="border-slate-200 mb-4" />
        </div>

        {/* VEHICLE INFO - DEEP RED CARD */}
        <div className="bg-[#991B1B] rounded-[1.5rem] p-5 text-white shadow-xl mb-4 shrink-0 relative overflow-hidden">
          <p className="uppercase tracking-[0.15em] text-white/70 font-[900] text-[8px] mb-3 text-center\">Vehicle & Route Info</p>
          <div className="grid grid-cols-2 gap-y-3">
            <div>
              <p className="uppercase text-[8px] text-white/50 font-bold">Plate</p>
              <p className="text-sm font-[900]">DAR-8764</p>
            </div>
            <div>
              <p className="uppercase text-[8px] text-white/50 font-bold">Capacity</p>
              <p className="text-sm font-[900]">20 Pax</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
             <span className="text-[10px] font-bold italic">SM Lipa ↔ Mataas</span>
             <span className="text-[9px] font-black text-[#FFD54F]">● ACTIVE</span>
          </div>
        </div>

        {/* OCCUPANCY */}
        <div className="bg-white rounded-[1.5rem] border border-slate-200 p-4 shadow-sm mb-4 shrink-0">
          <p className="uppercase tracking-[0.15em] text-[#991B1B] font-[900] text-[8px] mb-3 text-center\">Live Occupancy</p>
          <div className="flex items-center justify-around mb-3">
            <div className="text-center">
              <p className="text-3xl font-[900] text-slate-800">12</p>
              <p className="uppercase text-slate-400 text-[8px] font-black tracking-widest mt-1">Onboard</p>
            </div>
            <div className="w-px h-8 bg-slate-100"></div>
            <div className="text-center">
              <p className="text-3xl font-[900] text-[#285F1F]">08</p>
              <p className="uppercase text-slate-400 text-[8px] font-black tracking-widest mt-1">Available</p>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="w-[60%] h-full bg-[#991B1B] rounded-full transition-all duration-700"></div>
          </div>
        </div>

        {/* PASSENGER LIST */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="uppercase tracking-[0.15em] text-[#991B1B] font-[900] text-[9px]">Onboard Passengers</h3>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Live Update</span>
          </div>
          
          <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar pb-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between shadow-sm hover:border-[#991B1B]/20 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-[#991B1B]/5 group-hover:text-[#991B1B] transition-colors">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase leading-none">User #452{i}</p>
                    <p className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-1 uppercase">
                      <MapPin size={10} className="text-[#991B1B]" /> SM City Lipa
                    </p>
                  </div>
                </div>
                <div className="bg-green-50 text-green-600 text-[8px] font-black px-2 py-1 rounded-lg border border-green-100 uppercase">
                  Onboard
                </div>
              </div>
            ))}
          </div>
        </div>

      </aside>
    </div>
  );
};

export default DriverDashboard;