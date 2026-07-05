import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { processQrFare, tapRfidCard } from './rfidService';
import { createSerialRfidReader, isSerialReaderSupported, normalizeRfidUid } from './hardwareReader';
import {
    FiRadio, FiCheckCircle, FiXCircle,
    FiCreditCard, FiTruck, FiLock, FiCamera, FiCpu,
} from 'react-icons/fi';
import api from '../../api/axios';

const peso = (n) =>
    `\u20B1${parseFloat(n ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const fmtDate = (ts) => {
    if (!ts) return '\u2014';
    return new Date(ts).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
};

// ScannerIcon 
function ScannerIcon({ loading }) {
    return (
        <div className="relative w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-300 ${
                loading ? 'border-yellow-500 animate-ping' : 'border-[#7A2F3D]/20'
            }`} />
            <div className="w-14 h-14 rounded-full bg-[#7A2F3D] text-white flex items-center justify-center text-2xl shadow-md z-10">
                <FiRadio className={loading ? 'animate-pulse text-yellow-400' : ''} />
            </div>
            {loading && (
                <div className="absolute -inset-1 rounded-full border-2 border-transparent border-t-[#7A2F3D] animate-spin" />
            )}
        </div>
    );
}

// DataRow 
function DataRow({ label, value, valueClass = '', last = false }) {
    return (
        <div className={`flex justify-between items-center py-2.5 ${last ? '' : 'border-b border-slate-100'}`}>
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">{label}</span>
            <span className={`text-sm font-mono font-bold text-slate-900 ${valueClass}`}>{value}</span>
        </div>
    );
}

//ResultPanel
function ResultPanel({ status, result, errorMsg }) {
    const ok = status === 'SUCCESS';
    return (
        <div className={`mt-6 rounded-2xl overflow-hidden border transition-all ${
            ok ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'
        }`}>
            <div className={`px-4 py-2.5 flex items-center gap-2 ${
                ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}>
                {ok
                    ? <FiCheckCircle className="shrink-0" size={16} />
                    : <FiXCircle className="shrink-0" size={16} />}
                <span className="text-xs font-black uppercase tracking-widest">
                    {ok ? 'Transaction Complete' : 'Transaction Failed'}
                </span>
            </div>
            <div className="p-4 bg-white/80">
                {ok && result ? (
                    <>
                        <DataRow label="Card No."         value={result.cardNumber} />
                        {result.rfidUid && (
                            <DataRow label="RFID UID" value={result.rfidUid}
                                valueClass="tracking-widest text-[#7A2F3D]" />
                        )}
                        {result.source && (
                            <DataRow label="Source" value={result.source}
                                valueClass="tracking-widest text-[#7A2F3D]" />
                        )}
                        <DataRow label="Fare Deducted"    value={`− ${peso(result.deductedFare)}`}
                            valueClass="text-red-600 font-black text-base" />
                        <DataRow label="Remaining Bal."   value={peso(result.remainingBalance)}
                            valueClass="text-[#234B20] font-black text-base bg-emerald-50 px-2 py-0.5 rounded" />
                        <DataRow label="Ref No."          value={result.referenceNumber}
                            valueClass="text-xs text-slate-500" />
                        <DataRow label="Time"             value={fmtDate(result.timestamp)}
                            valueClass="text-xs text-slate-500" last />
                    </>
                ) : (
                    <p className="text-xs font-bold text-red-700 leading-relaxed py-2 m-0 text-center">
                        {errorMsg}
                    </p>
                )}
            </div>
        </div>
    );
}

// VehicleSelector 
function VehicleSelector({ onSelect }) {
    const [vehicles,  setVehicles]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [selected,  setSelected]  = useState('');

    useEffect(() => {
        api.get('/rfid/vehicles')
            .then(res => setVehicles(res.data?.data || []))
            .catch(() => toast.error('Failed to load vehicles'))
            .finally(() => setLoading(false));
    }, []);

    const handleConfirm = () => {
        if (!selected) {
            toast.warn('Please select a vehicle first.');
            return;
        }
        const vehicle = vehicles.find(v => v.plateNumber === selected);
        onSelect(vehicle);
    };

    return (
        <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-4xl shadow-2xl overflow-hidden">
                <div className="h-2 bg-[#7A2F3D]" />
                <div className="p-8 text-center border-b border-slate-100">
                    <div className="w-14 h-14 rounded-full bg-[#7A2F3D] text-white flex items-center justify-center text-2xl shadow-md mx-auto mb-4">
                        <FiTruck />
                    </div>
                    <h1 className="text-xl font-black text-[#7A2F3D] uppercase tracking-tight">
                        Premier Transit
                    </h1>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1">
                        RFID Fare Collection Terminal
                    </p>
                </div>

                <div className="p-8 space-y-5">
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                            Select Vehicle / Bus
                        </label>

                        {loading ? (
                            <div className="text-center py-6 text-slate-400 text-sm">
                                Loading vehicles...
                            </div>
                        ) : vehicles.length === 0 ? (
                            <div className="text-center py-6 text-red-500 text-sm font-bold">
                                No active vehicles found.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {vehicles.map(v => (
                                    <button
                                        key={v.plateNumber}
                                        onClick={() => setSelected(v.plateNumber)}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                            selected === v.plateNumber
                                                ? 'border-[#7A2F3D] bg-[#7A2F3D]/5'
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div className="font-black text-slate-800 text-sm tracking-wider">
                                                    <FiTruck className="inline mr-1 align-[-2px] text-[#7A2F3D]" /> {v.plateNumber}
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    {v.route || 'SM Lipa to SM Batangas'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                    v.status === 'ACTIVE'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {v.status}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    Cap: {v.totalCapacity} pax
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleConfirm}
                        disabled={!selected || loading}
                        className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-none ${
                            selected && !loading
                                ? 'bg-[#7A2F3D] hover:bg-[#642633] text-white cursor-pointer shadow-lg active:scale-95'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <FiLock size={14} />
                        Assign Terminal to This Vehicle
                    </button>
                </div>
            </div>

            <footer className="mt-6 text-center text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                Premier Transit Turnstile Grid {'\u00A9'} {new Date().getFullYear()}
            </footer>
        </div>
    );
}

// 
export default function RfidTapPage() {
    // Vehicle assignment state 
    const [vehicle,  setVehicle]  = useState(() => {
        try {
            const raw = sessionStorage.getItem('rfidTerminalVehicle');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });

    const handleVehicleSelect = (v) => {
        sessionStorage.setItem('rfidTerminalVehicle', JSON.stringify(v));
        setVehicle(v);
        toast.success(`Terminal locked to ${v.plateNumber}`);
    };

    const handleChangeVehicle = () => {
        sessionStorage.removeItem('rfidTerminalVehicle');
        setVehicle(null);
    };

    // Show vehicle selector if not yet assigned 
    if (!vehicle) {
        return <VehicleSelector onSelect={handleVehicleSelect} />;
    }

    // RFID tap
    return (
        <RfidTapForm
            vehicle={vehicle}
            onChangeVehicle={handleChangeVehicle}
        />
    );
}

//RfidTapForm
function RfidTapForm({ vehicle, onChangeVehicle }) {
    const [rfidUid,  setRfidUid]  = useState('');
    const [qrPayload, setQrPayload] = useState('');
    const [status,   setStatus]   = useState('IDLE');
    const [result,   setResult]   = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [focused,  setFocused]  = useState(false);
    const [readerStatus, setReaderStatus] = useState('DISCONNECTED');
    const [readerMessage, setReaderMessage] = useState('Connect the PN532 terminal over USB serial.');
    const inputRef = useRef(null);
    const serialReaderRef = useRef(null);
    const abortReaderRef = useRef(null);
    const busyRef = useRef(false);

    useEffect(() => { inputRef.current?.focus(); }, []);

    useEffect(() => () => {
        abortReaderRef.current?.abort();
        serialReaderRef.current?.close?.();
    }, []);

    const processUid = useCallback(async (rawUid, source = 'manual') => {
        const uid = normalizeRfidUid(rawUid);
        if (!uid) {
            toast.warn(source === 'serial' ? 'Reader sent an invalid RFID UID.' : 'Enter an RFID UID first.');
            inputRef.current?.focus();
            return;
        }
        if (busyRef.current) return;
        busyRef.current = true;

        setStatus('LOADING');
        setResult(null);
        setErrorMsg('');

        try {
            // Pass plateNumber so backend links tap to correct shift
            const { data: res } = await tapRfidCard(uid, vehicle.plateNumber);

            if (res.success) {
                setResult(res.data);
                setStatus('SUCCESS');
                toast.success(source === 'serial' ? `PN532 card ${uid} processed.` : 'Fare deducted successfully!');
            } else {
                setErrorMsg(res.message || 'Transaction failed.');
                setStatus('ERROR');
                toast.error(res.message || 'Transaction failed.');
            }
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                'Server error. Please try again.';
            setErrorMsg(msg);
            setStatus('ERROR');
            toast.error(msg);
        } finally {
            busyRef.current = false;
            setRfidUid('');
            setTimeout(() => inputRef.current?.focus(), 120);
        }
    }, [vehicle.plateNumber]);

    const handleTap = useCallback(() => processUid(rfidUid, 'manual'), [processUid, rfidUid]);

    const handleConnectReader = useCallback(async () => {
        if (readerStatus === 'CONNECTED') {
            abortReaderRef.current?.abort();
            await serialReaderRef.current?.close?.();
            serialReaderRef.current = null;
            abortReaderRef.current = null;
            setReaderStatus('DISCONNECTED');
            setReaderMessage('PN532 reader disconnected.');
            return;
        }

        if (!isSerialReaderSupported()) {
            toast.error('Use Chrome or Edge to connect the PN532 USB serial reader.');
            setReaderStatus('UNSUPPORTED');
            setReaderMessage('Web Serial is unavailable in this browser.');
            return;
        }

        try {
            const controller = new AbortController();
            abortReaderRef.current = controller;
            setReaderStatus('CONNECTING');
            setReaderMessage('Select the Arduino / ESP32 PN532 terminal.');

            serialReaderRef.current = await createSerialRfidReader({
                signal: controller.signal,
                onStatus: (nextStatus) => {
                    setReaderStatus(nextStatus);
                    setReaderMessage(nextStatus === 'CONNECTED'
                        ? 'PN532 reader connected at 115200 baud. Tap a card.'
                        : 'PN532 reader disconnected.');
                },
                onUid: async (uid) => {
                    setRfidUid(uid);
                    setReaderMessage(`PN532 scanned ${uid}. Processing fare...`);
                    await processUid(uid, 'serial');
                },
            });
        } catch (err) {
            const msg = err?.message || 'Unable to connect RFID reader.';
            setReaderStatus('DISCONNECTED');
            setReaderMessage(msg);
            toast.error(msg);
        }
    }, [processUid, readerStatus]);

    const handleQrPayment = useCallback(async () => {
        const payload = qrPayload.trim();
        if (!payload) {
            toast.warn('Paste or scan a passenger fare QR first.');
            return;
        }
        if (busyRef.current) return;
        busyRef.current = true;

        setStatus('LOADING');
        setResult(null);
        setErrorMsg('');

        try {
            const { data: res } = await processQrFare(payload, vehicle.plateNumber);

            if (res.success) {
                setResult(res.data);
                setStatus('SUCCESS');
                toast.success('QR fare deducted successfully!');
            } else {
                setErrorMsg(res.message || 'QR transaction failed.');
                setStatus('ERROR');
                toast.error(res.message || 'QR transaction failed.');
            }
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                'Server error. Please try again.';
            setErrorMsg(msg);
            setStatus('ERROR');
            toast.error(msg);
        } finally {
            busyRef.current = false;
            setQrPayload('');
            setTimeout(() => inputRef.current?.focus(), 120);
        }
    }, [qrPayload, vehicle.plateNumber]);

    const handleKeyDown  = (e) => { if (e.key === 'Enter') handleTap(); };
    const handleChange   = (e) => {
        setRfidUid(e.target.value.toUpperCase());
        if (status !== 'IDLE') { setStatus('IDLE'); setResult(null); setErrorMsg(''); }
    };

    const isLoading = status === 'LOADING';
    const hasResult = status === 'SUCCESS' || status === 'ERROR';
    const isReaderConnected = readerStatus === 'CONNECTED';
    const canTap    = !isLoading && rfidUid.trim().length > 0;

    return (
        <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-800 p-4 md:p-8 flex flex-col items-center justify-center selection:bg-[#7A2F3D] selection:text-white">

            {/* Top bar */}
            <div className="w-full max-w-md mb-4 flex items-center justify-between">
                <span className="text-[10px] bg-yellow-400 text-slate-950 font-black px-2 py-0.5 rounded uppercase tracking-widest">
                    Turnstile Terminal Kiosk
                </span>
            </div>

            {/* Vehicle badge */}
            <div className="w-full max-w-md mb-3 flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                    <FiTruck className="text-[#7A2F3D] shrink-0" size={15} />
                    <div>
                        <div className="text-xs font-black text-slate-700 tracking-wider">
                            {vehicle.plateNumber}
                        </div>
                        <div className="text-[10px] text-slate-400">
                            {vehicle.route || 'SM Lipa to SM Batangas'}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onChangeVehicle}
                    className="text-[10px] text-[#7A2F3D] font-black uppercase tracking-wider hover:underline bg-transparent border-0 cursor-pointer"
                >
                    Change
                </button>
            </div>

            <div className="w-full max-w-md bg-white rounded-3xl md:rounded-4xl shadow-2xl border border-white overflow-hidden">
                <div className="h-2 bg-[#7A2F3D]" />

                {/* Header */}
                <div className="p-6 md:p-8 text-center bg-linear-to-b from-slate-50 to-white border-b border-slate-100">
                    <ScannerIcon loading={isLoading} />
                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#7A2F3D] uppercase m-0 leading-tight">
                        Premier Transit
                    </h1>
                    <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5 m-0">
                        RFID Fare Collection Terminal Gate
                    </p>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 space-y-4 bg-white">

                    {/* Fixed Fare */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#7A2F3D]/5 border border-[#7A2F3D]/10">
                        <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                            Fixed Boarding Fare
                        </span>
                        <span className="text-xl font-black font-mono text-[#7A2F3D]">
                            ₱60.00
                        </span>
                    </div>

                    <div className={`rounded-xl border p-3.5 ${
                        isReaderConnected
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-slate-50'
                    }`}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <FiCpu className={isReaderConnected ? 'text-emerald-700' : 'text-slate-400'} size={18} />
                                <div className="min-w-0">
                                    <div className="text-xs font-black text-slate-700 uppercase tracking-wider">PN532 USB Reader</div>
                                    <div className="text-[10px] text-slate-500 font-semibold truncate">{readerMessage}</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleConnectReader}
                                disabled={isLoading || readerStatus === 'CONNECTING'}
                                className={`shrink-0 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border-none transition-all ${
                                    isReaderConnected
                                        ? 'bg-slate-900 text-white hover:bg-slate-700 cursor-pointer'
                                        : 'bg-[#7A2F3D] text-white hover:bg-[#642633] cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed'
                                }`}
                            >
                                {readerStatus === 'CONNECTING' ? 'Connecting' : isReaderConnected ? 'Disconnect' : 'Connect'}
                            </button>
                        </div>
                    </div>
                    {/* RFID Input */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                            Authorized RFID Card UID
                        </label>
                        <div className={`flex items-center gap-2 px-3.5 py-3.5 rounded-xl bg-slate-50 border transition-all ${
                            focused
                                ? 'border-[#7A2F3D] ring-2 ring-[#7A2F3D]/20 bg-white'
                                : 'border-slate-300'
                        }`}>
                            <FiCreditCard className="text-slate-400 shrink-0" size={18} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={rfidUid}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                                placeholder="e.g. A1B2C3D4"
                                maxLength={20}
                                disabled={isLoading}
                                autoComplete="off"
                                spellCheck={false}
                                className="w-full bg-transparent border-0 outline-none text-slate-900 font-mono font-black text-base placeholder-slate-400 tracking-widest uppercase disabled:opacity-50"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium text-center mt-2 italic">
                            Connect the PN532 reader, or type the UID manually then press{' '}
                            <strong className="text-slate-600 font-bold">Enter</strong>.
                        </p>
                    </div>

                    {/* Tap Button */}
                    <button
                        type="button"
                        onClick={handleTap}
                        disabled={!canTap}
                        className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 border-none mt-2 ${
                            canTap
                                ? 'bg-[#7A2F3D] hover:bg-[#642633] text-white cursor-pointer active:scale-95'
                                : 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed'
                        }`}
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin shrink-0" />
                                <span>Processing Sensor...</span>
                            </>
                        ) : (
                            <>
                                <FiRadio size={16} className="text-yellow-400" />
                                <span>Confirm RFID Card Tap</span>
                            </>
                        )}
                    </button>

                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                            Passenger QR Fare Token
                        </label>
                        <div className="flex items-center gap-2 px-3.5 py-3.5 rounded-xl bg-slate-50 border border-slate-300">
                            <FiCamera className="text-slate-400 shrink-0" size={18} />
                            <input
                                type="text"
                                value={qrPayload}
                                onChange={(e) => {
                                    setQrPayload(e.target.value);
                                    if (status !== 'IDLE') { setStatus('IDLE'); setResult(null); setErrorMsg(''); }
                                }}
                                placeholder="Paste scanned Premier QR payload"
                                disabled={isLoading}
                                autoComplete="off"
                                spellCheck={false}
                                className="w-full bg-transparent border-0 outline-none text-slate-900 font-mono font-bold text-xs placeholder-slate-400 disabled:opacity-50"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleQrPayment}
                            disabled={isLoading || !qrPayload.trim()}
                            className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 border-none mt-3 ${
                                !isLoading && qrPayload.trim()
                                    ? 'bg-[#234B20] hover:bg-[#1a3818] text-white cursor-pointer active:scale-95'
                                    : 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed'
                            }`}
                        >
                            <FiCamera size={16} className="text-yellow-400" />
                            <span>Process QR Fare</span>
                        </button>
                        <p className="text-[10px] text-slate-400 font-medium text-center mt-2 italic">
                            Camera scanner hardware can paste decoded QR text here.
                        </p>
                    </div>

                    {hasResult && (
                        <ResultPanel
                            status={status}
                            result={result}
                            errorMsg={errorMsg}
                        />
                    )}
                </div>
            </div>

            <footer className="mt-8 text-center text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                Premier Transit Turnstile Grid {'\u00A9'} {new Date().getFullYear()} | Secure Handshake
            </footer>
        </div>
    );
}





