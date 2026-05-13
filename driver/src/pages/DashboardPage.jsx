import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import driverAPI from '../api/driverAxios';
import { useDriver } from '../context/DriverContext';
import { toast } from 'react-toastify';
import useGpsTracking from '../hooks/useGpsTracking';
import GpsStatusBadge from '../components/GpsStatusBadge';
import {
    MapPin, LogOut, AlertTriangle,
    Radio, User, ShieldCheck, RefreshCw,
} from 'lucide-react';

const POLL_INTERVAL = 5000;

const fmtFare = (n) => `₱${parseFloat(n ?? 0).toFixed(2)}`;
const fmtPct  = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function DashboardPage() {
    const navigate = useNavigate();
    const { driverInfo, logoutDriver } = useDriver();

    //  Shift / passenger data 
    const [shiftInfo,  setShiftInfo]  = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showEmergency, setShowEmergency] = useState(false);
    const [showLogout,    setShowLogout]    = useState(false);
    const [emergencySending, setEmergencySending] = useState(false);
    const [logoutSending,    setLogoutSending]    = useState(false);

    //  Derived identifiers 
    const plateNumber = driverInfo?.plateNumber;
    const shiftId     = driverInfo?.shiftId;

    //  GPS 
    const { gpsStatus, coordinates, geofence, eta, deviated, stopTracking } =
        useGpsTracking(plateNumber, shiftId);

    const intervalRef = useRef(null);


    // FETCH SHIFT + ONBOARD PASSENGERS
    const fetchShiftInfo = useCallback(async (opts = {}) => {
        if (!plateNumber) return;
        if (opts.manual) setRefreshing(true);

        try {
            const res = await driverAPI.get(`/shift/${plateNumber}`);
            setShiftInfo(res.data?.data ?? null);
        } catch (err) {
            console.error('[DashboardPage] fetchShiftInfo error:', err);
            if (err.response?.status === 401) {
                toast.error('Session expired. Logging out…');
                logoutDriver();
                navigate('/login', { replace: true });
            }
            if (opts.manual) toast.error('Failed to refresh shift info.');
        } finally {
            setLoading(false);
            if (opts.manual) setRefreshing(false);
        }
    }, [plateNumber, logoutDriver, navigate]);

    const startPolling = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => fetchShiftInfo(), POLL_INTERVAL);
    }, [fetchShiftInfo]);

    useEffect(() => {
        if (!driverInfo) { navigate('/login', { replace: true }); return; }
        fetchShiftInfo();
        startPolling();
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [driverInfo, fetchShiftInfo, startPolling, navigate]);

    // HANDLERS

    // Drop-off 
    const handleDropOff = async (onboardId, dropOff) => {
        try {
            await driverAPI.post(`/drop-off/${onboardId}`);
            toast.success(`Dropped off at ${dropOff}`);
            fetchShiftInfo({ manual: true });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Drop-off failed.');
        }
    };

    // Emergency 
    const handleEmergency = async () => {
        if (emergencySending) return;
        setEmergencySending(true);
        try {
            const payload = {
                plateNumber,
                shiftId: shiftId || null,
                message:   'Driver triggered emergency alert!',
                timestamp: new Date().toISOString(),
                ...(coordinates && {
                    coordinates: {
                        latitude:  coordinates.latitude,
                        longitude: coordinates.longitude,
                        speed:     coordinates.speed,
                        accuracy:  coordinates.accuracy,
                    },
                }),
            };
            await driverAPI.post('/emergency', payload);
            setShowEmergency(true);
            toast.success('Emergency alert sent successfully!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send emergency alert.');
        } finally {
            setEmergencySending(false);
        }
    };

    //End shift 
    const handleEndShift = async () => {
        if (logoutSending) return;
        setLogoutSending(true);
        try {
            await driverAPI.post(`/end-shift/${plateNumber}`);
            toast.success('Shift ended successfully!');
            stopTracking();
            logoutDriver();
            navigate('/login', { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to end shift.');
        } finally {
            setLogoutSending(false);
            setShowLogout(false);
        }
    };

    // DERIVED DATA
    const onboard           = shiftInfo?.onboardPassengers  ?? [];
    const nextDropOff       = onboard[0]                    ?? null;
    const passengersOnboard = shiftInfo?.passengersOnboard  ?? 0;
    const availableSeats    = shiftInfo?.availableSeats     ?? 0;
    const totalCapacity     = shiftInfo?.totalCapacity      ?? 25;
    const capacityPct       = fmtPct(passengersOnboard, totalCapacity);

    // LOADING SCREEN
    if (loading) {
        return (
            <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center font-[Poppins]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-[#991B1B]/20 border-t-[#991B1B] rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Loading shift info…
                    </span>
                </div>
            </div>
        );
    }

    // RENDER
    return (
        <div className="flex h-screen bg-[#F1F5F9] overflow-hidden p-3 gap-3 font-[Poppins]">

            <div className="flex-[2.5] flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">

                {/* Traffic flow badge + manual refresh */}
                <div className="shrink-0 flex justify-between items-center">
                    <button className="bg-white/95 backdrop-blur-sm border border-slate-200 py-2 px-5 rounded-xl shadow-lg flex items-center gap-2">
                        <Radio size={16} className="text-[#991B1B]" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                            Traffic Flow
                        </span>
                    </button>
                    <button
                        onClick={() => fetchShiftInfo({ manual: true })}
                        disabled={refreshing}
                        className="bg-white border border-slate-200 py-2 px-4 rounded-xl shadow-sm flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[#991B1B] transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Next drop-off card */}
                <div className={`rounded-4xl px-9 py-10 text-center flex flex-col items-center justify-center transition-all duration-500 border
                    ${nextDropOff
                        ? 'bg-[#991B1B] border-[#7F1D1D] shadow-xl shadow-[#991B1B]/20'
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                    <div className={`text-[11px] tracking-[3px] uppercase mb-3 font-black
                        ${nextDropOff ? 'text-white/70' : 'text-slate-400'}`}>
                        Next Drop-Off
                    </div>

                    {nextDropOff ? (
                        <>
                            <div className="text-5xl md:text-[68px] font-black text-white leading-[1.1] mb-4 drop-shadow-lg">
                                {nextDropOff.dropOff}
                            </div>
                            <div className="bg-white/20 rounded-xl px-6 py-2.5 text-sm font-semibold mb-5 text-white">
                                {nextDropOff.userId} · {fmtFare(nextDropOff.fare)} · {nextDropOff.passengerCount} pax
                            </div>
                            <button
                                onClick={() => handleDropOff(nextDropOff.onboardId, nextDropOff.dropOff)}
                                className="py-3.5 px-11 bg-white text-[#991B1B] rounded-xl text-sm font-black tracking-wide shadow-lg hover:opacity-90 transition-opacity cursor-pointer border-0 uppercase"
                            >
                                Confirm Drop-Off
                            </button>
                        </>
                    ) : (
                        <div>
                            <div className="text-[52px] mb-3 opacity-40">🚌</div>
                            <div className="text-xl font-bold text-slate-400">No passengers onboard</div>
                            <div className="text-[13px] text-slate-300 mt-2">Waiting for passengers to tap in</div>
                        </div>
                    )}
                </div>

                {/* All destinations */}
                {onboard.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 px-6 py-5 shadow-sm">
                        <div className="uppercase tracking-[0.15em] text-[#991B1B] font-black text-[9px] mb-4">
                            All Drop-off Destinations
                        </div>
                        <div className="flex gap-2.5 flex-wrap">
                            {onboard.map((p, i) => (
                                <div key={p.onboardId ?? i} className="bg-[#991B1B] rounded-2xl px-5 py-3 text-center min-w-30">
                                    <div className="text-base font-black text-white mb-1">{p.dropOff}</div>
                                    <div className="text-[10px] text-white/70 font-bold">{p.userId}</div>
                                    <div className="text-xs font-black text-white/90 mt-0.5">{fmtFare(p.fare)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Route deviation warning */}
                {deviated && (
                    <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl px-4 py-3 text-sm font-semibold text-[#991B1B] flex items-center gap-2">
                        <AlertTriangle size={16} />
                        Route deviation! Return to SM Lipa ↔ SM Batangas route.
                    </div>
                )}

                {/* ETA / route status */}
                {eta && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
                        <p className="uppercase tracking-[0.15em] text-[#991B1B] font-black text-[8px] mb-3 text-center">
                            Route Status
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                                <p className="uppercase text-[8px] text-slate-400 font-bold mb-1">To SM Lipa</p>
                                <p className="text-sm font-black text-slate-800">{eta.distToSmLipaKm} km</p>
                                <p className="text-slate-400 text-[10px]">~{eta.etaToSmLipaMin} min</p>
                            </div>
                            <div>
                                <p className="uppercase text-[8px] text-slate-400 font-bold mb-1">To SM Batangas</p>
                                <p className="text-sm font-black text-slate-800">{eta.distToSmBatangasKm} km</p>
                                <p className="text-slate-400 text-[10px]">~{eta.etaToSmBatangasMin} min</p>
                            </div>
                            <div>
                                <p className="uppercase text-[8px] text-slate-400 font-bold mb-1">Zone</p>
                                <p className="text-sm font-black text-green-700">
                                    {geofence === 'AT_SM_LIPA'     ? 'SM Lipa'
                                    : geofence === 'AT_SM_BATANGAS' ? 'SM Batangas'
                                    : 'En Route'}
                                </p>
                            </div>
                            <div>
                                <p className="uppercase text-[8px] text-slate-400 font-bold mb-1">Deviation</p>
                                <p className={`text-sm font-black ${deviated ? 'text-red-600' : 'text-green-700'}`}>
                                    {deviated ? 'Off Route' : 'On Route'}
                                </p>
                            </div>
                        </div>
                        {coordinates && (
                            <p className="text-[9px] text-slate-300 mt-3 text-center">
                                {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                                {coordinates.speed > 0 && ` · ${Math.round(coordinates.speed)} km/h`}
                            </p>
                        )}
                    </div>
                )}

            </div>

            {/*RIGHT SIDEBAr */}
            <aside className="w-95 bg-[#F5F5F5] rounded-4xl border border-[#E5E5E5] p-5 flex flex-col shadow-xl overflow-hidden h-full shrink-0">

                {/* Driver header */}
                <div className="shrink-0">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-16 h-16 rounded-full bg-[#991B1B] border-2 border-red-700 flex items-center justify-center shadow-lg shadow-[#991B1B]/20 shrink-0">
                            <ShieldCheck size={28} className="text-white" />
                        </div>
                        <h1 className="text-lg font-black uppercase text-[#7F1D1D] leading-tight tracking-tight">
                            Roaming Bus <br /> Dashboard
                        </h1>
                    </div>

                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="uppercase tracking-[0.15em] text-[8px] font-black text-red-600 mb-0.5">
                                Driver Profile
                            </p>
                            <h2 className="text-xl font-black uppercase text-slate-800 leading-none">
                                {shiftInfo?.driverName || driverInfo?.driverName || '—'}
                            </h2>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="bg-red-100 text-[#991B1B] text-[9px] font-black px-2 py-0.5 rounded uppercase border border-red-200/30">
                                    Unit: {plateNumber}
                                </span>
                                <GpsStatusBadge status={gpsStatus} />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleEmergency}
                                disabled={emergencySending}
                                className={`bg-red-600 text-white rounded-xl w-15 h-15 flex flex-col items-center justify-center font-black uppercase text-[7px] gap-1 shadow-md hover:bg-red-700 transition-all
                                    ${emergencySending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <AlertTriangle size={20} />
                                {emergencySending ? 'Sending…' : 'Emergency'}
                            </button>
                            <button
                                onClick={() => setShowLogout(true)}
                                disabled={logoutSending}
                                className={`bg-[#E9EDF3] text-slate-500 rounded-xl w-15 h-15 flex flex-col items-center justify-center font-black uppercase text-[7px] gap-1 shadow-sm hover:bg-slate-200 transition-all
                                    ${logoutSending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <LogOut size={20} />
                                Exit
                            </button>
                        </div>
                    </div>

                    <hr className="border-slate-200 mb-4" />
                </div>

                {/* Vehicle info */}
                <div className="bg-[#991B1B] rounded-3xl p-5 text-white shadow-xl mb-4 shrink-0 relative overflow-hidden">
                    <p className="uppercase tracking-[0.15em] text-white/70 font-black text-[8px] mb-3 text-center">
                        Vehicle & Route Info
                    </p>
                    <div className="grid grid-cols-2 gap-y-3">
                        <div>
                            <p className="uppercase text-[8px] text-white/50 font-bold">Plate</p>
                            <p className="text-sm font-black">{plateNumber}</p>
                        </div>
                        <div>
                            <p className="uppercase text-[8px] text-white/50 font-bold">Capacity</p>
                            <p className="text-sm font-black">{totalCapacity} Pax</p>
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                        <span className="text-[10px] font-bold italic">
                            {shiftInfo?.route || driverInfo?.route || 'SM Lipa ↔ SM Batangas'}
                        </span>
                        <span className="text-[9px] font-black text-yellow-300">● ACTIVE</span>
                    </div>
                </div>

                {/* Live occupancy */}
                <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm mb-4 shrink-0">
                    <p className="uppercase tracking-[0.15em] text-[#991B1B] font-black text-[8px] mb-3 text-center">
                        Live Occupancy
                    </p>
                    <div className="flex items-center justify-around mb-3">
                        <div className="text-center">
                            <p className="text-3xl font-black text-slate-800">{passengersOnboard}</p>
                            <p className="uppercase text-slate-400 text-[8px] font-black tracking-widest mt-1">Onboard</p>
                        </div>
                        <div className="w-px h-8 bg-slate-100" />
                        <div className="text-center">
                            <p className="text-3xl font-black text-green-800">{availableSeats}</p>
                            <p className="uppercase text-slate-400 text-[8px] font-black tracking-widest mt-1">Available</p>
                        </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${
                                passengersOnboard > 20 ? 'bg-[#991B1B]' : 'bg-[#991B1B]/70'
                            }`}
                            style={{ width: `${capacityPct}%` }}
                        />
                    </div>
                    <p className="text-[9px] text-slate-300 mt-1.5 text-right font-bold">
                        {passengersOnboard}/{totalCapacity}
                    </p>
                </div>

                {/* Onboard passengers list */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h3 className="uppercase tracking-[0.15em] text-[#991B1B] font-black text-[9px]">
                            Onboard Passengers
                        </h3>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                            {onboard.length} passenger{onboard.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar pb-2">
                        {onboard.length === 0 ? (
                            <div className="text-center text-slate-300 text-[12px] py-8 font-bold">
                                No passengers onboard
                            </div>
                        ) : (
                            onboard.map((p, i) => (
                                <div
                                    key={p.onboardId ?? i}
                                    className="bg-white border border-slate-100 rounded-2xl p-3 flex items-center justify-between shadow-sm hover:border-[#991B1B]/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-[#991B1B]/5 group-hover:text-[#991B1B] transition-colors">
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 uppercase leading-none">
                                                {p.userId}
                                            </p>
                                            <p className="flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-1 uppercase">
                                                <MapPin size={10} className="text-[#991B1B]" />
                                                {p.dropOff}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="bg-green-50 text-green-600 text-[8px] font-black px-2 py-1 rounded-lg border border-green-100 uppercase">
                                            Onboard
                                        </div>
                                        <span className="text-[8px] font-bold text-slate-400">
                                            {fmtFare(p.fare)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </aside>

            {/* Emergency sent */}
            {showEmergency && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-4xl p-8 max-w-md w-[90%] text-center shadow-2xl border border-slate-200">
                        <div className="text-5xl mb-4">🚨</div>
                        <h2 className="text-xl font-black text-slate-800 mb-2 uppercase">Emergency Alert Sent!</h2>
                        <p className="text-sm text-slate-500 mb-2">
                            Your emergency alert has been transmitted to the dispatch center.
                        </p>
                        {coordinates && (
                            <p className="text-[11px] text-slate-400 mb-4">
                                Location: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                            </p>
                        )}
                        <p className="text-xs text-[#991B1B] font-semibold mb-6">Stay calm. Help is on the way.</p>
                        <button
                            onClick={() => setShowEmergency(false)}
                            className="py-3 px-8 bg-[#991B1B] text-white rounded-2xl text-sm font-bold cursor-pointer border-0 hover:bg-[#7F1D1D] transition-all uppercase"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* End shift confirm */}
            {showLogout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-4xl p-8 max-w-md w-[90%] text-center shadow-2xl border border-slate-200">
                        <div className="text-5xl mb-4">🚪</div>
                        <h2 className="text-xl font-black text-slate-800 mb-2 uppercase">End Shift & Logout?</h2>
                        <p className="text-sm text-slate-500 mb-6">
                            This will end your current shift, stop GPS tracking, and log you out.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setShowLogout(false)}
                                disabled={logoutSending}
                                className="py-3 px-6 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold cursor-pointer border-0 hover:bg-slate-200 transition-all disabled:opacity-50 uppercase"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEndShift}
                                disabled={logoutSending}
                                className={`py-3 px-6 bg-[#991B1B] text-white rounded-2xl text-sm font-bold cursor-pointer border-0 transition-all uppercase
                                    ${logoutSending ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#7F1D1D]'}`}
                            >
                                {logoutSending ? 'Ending Shift…' : 'End Shift'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}