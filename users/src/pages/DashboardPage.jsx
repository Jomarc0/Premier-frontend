import { useCallback, useEffect, useState } from 'react';
import API from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { toast } from 'react-toastify';
import { QRCodeSVG } from 'qrcode.react';
import {
  History, MapPin, ShieldCheck,
  Smartphone, CreditCard, X, QrCode, CheckCircle2, AlertTriangle, Download
} from 'lucide-react';
import gcash from '../assets/image/gcash.png';
import maya from '../assets/image/maya.png';
import { captureEvent } from '../lib/posthog';

const QUICK_AMOUNTS    = [20, 40, 50, 100];
const PAYMENT_METHODS  = ['Gcash', 'Maya'];
const QR_REFRESH_BUFFER_SECONDS = 8;


const csvEscape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
};

const transactionId = (tx) => tx?.referenceNumber || `TX-${tx?.id}`;

const formatCountdown = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};



const DashboardPage = () => {
    const { passenger } = useAuth();
    const [balance, setBalance]               = useState(null);
    const [transactions, setTransactions]     = useState([]);
    const [allTransactions, setAllTransactions] = useState([]);
    const [selectedAmount, setSelectedAmount] = useState(null);
    const [customAmount, setCustomAmount]     = useState('');
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showModal, setShowModal]           = useState(false);
    const [loading, setLoading]               = useState(true);
    const [pendingPayment, setPendingPayment] = useState(null);
    const [verifying, setVerifying]           = useState(false);
    const [qrData, setQrData]                 = useState(null);
    const [qrSeconds, setQrSeconds]           = useState(0);
    const [qrState, setQrState]               = useState('idle');
    const [qrPayment, setQrPayment]           = useState(null);
    const [qrError, setQrError]               = useState('');
    const [showQrModal, setShowQrModal]       = useState(false);
    const [receiptTx, setReceiptTx]           = useState(null);

    const fetchData = useCallback(async () => {
        try {
        const [balRes, txRes] = await Promise.all([
            API.get('/balance'),
            API.get('/transactions?page=0&size=5'),
        ]);
        setBalance(balRes.data.data);
        setTransactions(txRes.data.data?.content || []);
        } catch (err) {
        console.error(err);
        } finally {
        setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const loadQrToken = useCallback(async (refreshing = false) => {
        setQrError('');
        setQrPayment(null);
        setQrState(refreshing ? 'refreshing' : 'loading');

        try {
            const res = await API.post('/fare/qr');
            const data = res.data.data;
            if (!data?.payload) {
                throw new Error('Unable to prepare secure QR code.');
            }
            setQrData(data);
            setQrSeconds(Number(data.expiresInSeconds || 45));
            setQrState('ready');
            if (!showQrModal) setShowQrModal(true);
            captureEvent('passenger_web_qr_generated', {
                refreshed: refreshing,
            });
        } catch (err) {
            setQrData(null);
            setQrSeconds(0);
            setQrError(err.response?.data?.message || err.message || 'Unable to prepare secure QR.');
            setQrState('failed');
            setShowQrModal(true);
        }
    }, [showQrModal]);

    const checkQrStatus = useCallback(async () => {
        if (!qrData?.payload || qrState !== 'ready') return;

        try {
            const res = await API.post('/fare/qr/status', { payload: qrData.payload });
            const status = res.data.data;

            if (status?.status === 'USED' && status.payment) {
                setQrPayment(status.payment);
                setQrState('success');
                captureEvent('passenger_web_qr_completed');
                fetchData();
                return;
            }

            if (status?.status === 'EXPIRED') {
                await loadQrToken(true);
                return;
            }

            if (typeof status?.expiresInSeconds === 'number') {
                setQrSeconds(status.expiresInSeconds);
            }
        } catch (err) {
            setQrError(err.response?.data?.message || 'Reader connection issue. Please try again.');
            setQrState('failed');
        }
    }, [fetchData, loadQrToken, qrData?.payload, qrState]);

    useEffect(() => {
        const refreshWhenVisible = () => {
            if (!document.hidden) fetchData();
        };

        const intervalId = window.setInterval(() => {
            if (!document.hidden) fetchData();
        }, 10000);

        window.addEventListener('focus', refreshWhenVisible);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', refreshWhenVisible);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
    }, [fetchData]);

    useEffect(() => {
        if (qrState !== 'ready') return undefined;

        const timer = window.setInterval(() => {
            setQrSeconds((current) => {
                const next = Math.max(0, current - 1);
                if (next <= QR_REFRESH_BUFFER_SECONDS) {
                    loadQrToken(true);
                }
                return next;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [loadQrToken, qrState]);

    useEffect(() => {
        if (qrState !== 'ready') return undefined;
        const poller = window.setInterval(checkQrStatus, 2500);
        return () => window.clearInterval(poller);
    }, [checkQrStatus, qrState]);

    const fetchAllTransactions = async () => {
        try {
        const res = await API.get('/transactions?page=0&size=50');
        setAllTransactions(res.data.data?.content || []);
        setShowModal(true);
        captureEvent('passenger_web_transactions_opened');
        } catch (err) {
        toast.error('Failed to load transactions');
        }
    };

    const downloadTransactions = async () => {
        try {
        let rows = allTransactions;
        if (!rows.length) {
            const res = await API.get('/transactions?page=0&size=100');
            rows = res.data.data?.content || [];
            setAllTransactions(rows);
        }

        if (!rows.length) {
            toast.info('No transactions available to download.');
            return;
        }

        const header = [
            'transaction_id',
            'reference_number',
            'type',
            'status',
            'amount',
            'balance_before',
            'balance_after',
            'created_at',
            'description',
        ];
        const csv = [
            header.join(','),
            ...rows.map(tx => [
                tx.id,
                tx.referenceNumber,
                tx.type,
                tx.status,
                tx.amount,
                tx.balanceBefore,
                tx.balanceAfter,
                tx.createdAt,
                tx.description,
            ].map(csvEscape).join(',')),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `premier-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Transactions downloaded.');
        captureEvent('passenger_web_transactions_downloaded');
        } catch (err) {
        toast.error('Failed to download transactions.');
        }
    };

    const downloadReceipt = (tx) => {
        if (!tx) return;

        const amountSign = tx.type === 'TOPUP' ? '+' : '-';
        const receiptLines = [
            'PREMIER TRANSPORT',
            'Transaction Receipt',
            '',
            `Type: ${tx.type === 'TOPUP' ? 'Top-Up Load' : 'Fare Payment'}`,
            `Status: ${tx.status === 'SUCCESS' ? 'Completed' : tx.status}`,
            `Reference ID: ${transactionId(tx)}`,
            `Date & Time: ${formatDate(tx.createdAt) || '-'}`,
            `Amount: ${amountSign}PHP ${parseFloat(tx.amount?.toString() || '0').toFixed(2)}`,
            tx.balanceBefore !== undefined && tx.balanceBefore !== null
                ? `Balance Before: PHP ${parseFloat(tx.balanceBefore?.toString() || '0').toFixed(2)}`
                : null,
            tx.balanceAfter !== undefined && tx.balanceAfter !== null
                ? `Balance After: PHP ${parseFloat(tx.balanceAfter?.toString() || '0').toFixed(2)}`
                : null,
            tx.description ? `Description: ${tx.description}` : null,
            '',
            'Thank you for using Premier Transport.',
        ].filter(Boolean);

        const blob = new Blob([receiptLines.join('\n')], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `premier-receipt-${transactionId(tx)}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Receipt downloaded.');
        captureEvent('passenger_web_receipt_downloaded', {
            type: tx.type,
            status: tx.status,
        });
    };

    const handleTopUp = async () => {
        const amount = selectedAmount || parseFloat(customAmount);
        if (!amount || amount < 20) {
        toast.warning('Please select or enter a valid amount (min \u20B120)');
        return;
        }
        if (!selectedPayment) {
        toast.warning('Please select a payment method');
        return;
        }
        if (pendingPayment) {
        toast.warning('You already have a pending payment. Complete it first or cancel it.');
        return;
        }
        try {
        captureEvent('passenger_web_topup_started', {
            payment_method: selectedPayment,
        });
        const res = await API.post('/topup/initiate', { amount });
        const { checkoutUrl, referenceNumber, topUpId } = res.data.data;
        setPendingPayment({ referenceNumber, amount, topUpId });
        window.open(checkoutUrl, '_blank');
        toast.info('Complete your payment in the new tab, then click "Verify My Payment".');
        } catch (err) {
        toast.error(err.response?.data?.message || 'Top-up failed');
        }
    };

    const handleCheckPayment = async () => {
        if (!pendingPayment) return;
        setVerifying(true);
        try {
        let res;
        try {
            res = await API.post(`/topup/verify/${pendingPayment.referenceNumber}`);
        } catch {
            res = await API.post('/topup/check-paid');
        }
        const { newBalance, amount } = res.data.data;
        toast.success(`\u20B1${amount} added! New balance: \u20B1${newBalance}`);
        setPendingPayment(null);
        setSelectedAmount(null);
        setCustomAmount('');
        setSelectedPayment(null);
        fetchData();
        captureEvent('passenger_web_topup_verified');
        } catch (err) {
        toast.error(err.response?.data?.message || 'Payment not yet completed. Please try again.');
        } finally {
        setVerifying(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        });
    };

    const currentBalNum = parseFloat(balance?.balance || 0);

    return (
        <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-800 pb-16 selection:bg-[#7A2F3D] selection:text-white">

        {/* FIXED NAVIGATION */}
        <Navbar />

        {/* HEADER */}
        <header className="pt-24 pb-8 md:pb-10 bg-[#7A2F3D] border-b border-[#642633] shadow-sm">
            <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div className="w-full md:w-auto">
                <div className="inline-flex items-center gap-2 bg-white/12 text-emerald-100 px-3 py-1 rounded-full text-[10px] font-black uppercase mb-3 border border-white/15">
                <ShieldCheck size={12} /> Secure RFID connection active
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Welcome back
                </h2>
                <p className="text-white/75 text-xs md:text-sm font-medium mt-1">
                Top up your fare card and review recent transactions.
                </p>
                <div className="mt-4 inline-flex flex-wrap gap-3 md:gap-6 bg-white/10 px-4 py-2 rounded-xl border border-white/15 text-white/85 text-xs font-mono">
                <span>CARD NO: <strong className="text-yellow-300">{balance?.cardNumber || '—'}</strong></span>
                </div>
            </div>
            </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 md:px-8 mt-6 md:mt-8 relative z-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            <div className="lg:col-span-8 space-y-6 md:space-y-8">

                {/* BALANCE CARD */}
                <div className="bg-white rounded-3xl md:rounded-4xl shadow-2xl overflow-hidden border border-white">
                <div className="p-6 md:p-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-linear-to-br from-white to-slate-50">
                    <div>
                    <p className="text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest mb-1">
                        Available Balance
                    </p>
                    <h3 className="text-4xl md:text-6xl font-black text-slate-900 flex items-start gap-1 tracking-tight font-mono">
                        <span className="text-xl md:text-2xl mt-2 md:mt-3 text-slate-400 font-bold font-sans">&#8369;</span>
                        {currentBalNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    </div>
                    <button
                    onClick={() => {
                        const el = document.getElementById('recharge-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                        else window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className="w-full sm:w-auto bg-[#234B20] hover:bg-[#1a3818] text-white px-8 py-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 font-black text-xs md:text-sm tracking-wider cursor-pointer whitespace-nowrap border-none"
                    >
                    QUICK TOP UP
                    </button>
                </div>
                <div className="bg-slate-50 px-6 md:px-10 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-slate-500 text-[10px] md:text-[11px] font-medium italic">
                    Fixed-fare cashless transportation service is currently active.
                    </p>
                    <div className="text-[10px] font-bold text-[#7A2F3D] bg-[#7A2F3D]/5 px-3 py-1 rounded-full uppercase">
                    Account: Active
                    </div>
                </div>
                </div>

                {/* QR FARE PAYMENT CARD */}
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#7A2F3D]/8 text-[#7A2F3D]">
                        <QrCode size={22} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">QR Fare Payment</h4>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Show a secure QR code to the fare reader.
                        </p>
                    </div>
                    </div>

                    <button
                    type="button"
                    onClick={() => loadQrToken(false)}
                    disabled={qrState === 'loading' || qrState === 'refreshing'}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7A2F3D] px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-md transition hover:bg-[#642633] disabled:cursor-wait disabled:opacity-70 sm:w-auto border-none cursor-pointer"
                    >
                    <QrCode size={16} />
                    {qrState === 'loading' || qrState === 'refreshing' ? 'Preparing...' : 'Show QR'}
                    </button>
                </div>
                </div>

                {/* RECHARGE CARD */}
                <div id="recharge-section" className="bg-white rounded-3xl md:rounded-4xl p-6 md:p-8 border border-white shadow-xl">
                <h4 className="font-black text-slate-900 mb-6 flex items-center gap-2 text-sm md:text-base uppercase tracking-tighter">
                    <CreditCard size={18} className="text-[#7A2F3D]" /> Recharge Your Card
                </h4>

                <div className="rounded-2xl p-4 mb-6 bg-slate-50 border border-slate-100/80 space-y-2">
                    <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-slate-500 font-medium">Assigned Card Number</span>
                    <strong className="text-slate-900 font-mono font-bold">{balance?.cardNumber || 'N/A'}</strong>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-xs md:text-sm">
                    <span className="text-slate-500 font-medium">Current Ledger Reserve</span>
                    <strong className="text-[#234B20] font-black font-mono text-sm bg-emerald-50 px-2 py-0.5 rounded">
                        &#8369;{currentBalNum.toFixed(2)}
                    </strong>
                    </div>
                </div>

                <label className="block mb-2 text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest">
                    Select Preset Load Amount
                </label>
                <div className="grid grid-cols-4 gap-3 mb-4 font-mono">
                    {QUICK_AMOUNTS.map(amt => (
                    <button
                        key={amt}
                        type="button"
                        onClick={() => { setSelectedAmount(amt); setCustomAmount(''); }}
                        className={`py-3 rounded-xl font-black text-xs md:text-sm transition-all border cursor-pointer ${
                        selectedAmount === amt
                            ? 'bg-[#7A2F3D] text-white border-[#7A2F3D] shadow-md scale-105'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                    >
                        &#8369;{amt}
                    </button>
                    ))}
                </div>

                <label className="block mb-2 text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest">
                    Or Custom Recharge Amount (&#8369;)
                </label>
                <input
                    type="number"
                    placeholder="Enter custom amount (min \u20B120.00)"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 outline-none mb-6 focus:ring-2 focus:ring-[#7A2F3D]/30 focus:border-[#7A2F3D] transition-all bg-slate-50 placeholder-slate-400"
                />

                <label className="block mb-3 text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest">
                    Authorized Payment Conductor
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {PAYMENT_METHODS.map(pm => {
                    const isGcash    = pm.toLowerCase() === 'gcash';
                    const isSelected = selectedPayment === pm;
                    return (
                        <div
                        key={pm}
                        onClick={() => setSelectedPayment(pm)}
                        className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                            ? isGcash
                                ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20 shadow-xs'
                                : 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100/60 border-slate-200'
                        }`}
                        >
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 shadow-sm">
                            <img src={isGcash ? gcash : maya} alt={pm} className="w-10 h-10 object-contain" />
                            </div>
                            <div>
                            <span className="font-bold text-[15px] block text-slate-900">{pm} Wallet</span>
                            <span className="text-xs text-slate-400 block mt-0.5">Instant encrypted sync</span>
                            </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full transition-all ${
                            isSelected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-200'
                        }`} />
                        </div>
                    );
                    })}
                </div>

                <button
                    onClick={handleTopUp}
                    className="w-full bg-[#7A2F3D] hover:bg-[#642633] text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-none"
                >
                    <CreditCard size={18} /> Proceed to Secure Payment
                </button>

                {pendingPayment && (
                    <div className="mt-6 p-5 rounded-2xl bg-amber-50 border border-amber-300 shadow-sm animate-in fade-in duration-200 text-center">
                    <p className="font-black text-xs uppercase tracking-wider text-amber-900 mb-2 flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                        Payment Pending
                    </p>
                    <p className="text-xs font-mono text-amber-800 mb-4 bg-white/60 p-2 rounded-lg border border-amber-200 inline-block">
                        Ref: <strong className="text-slate-900">{pendingPayment.referenceNumber}</strong> | Amount: <strong className="text-[#7A2F3D]">&#8369;{pendingPayment.amount}</strong>
                    </p>
                    <button
                        onClick={handleCheckPayment}
                        disabled={verifying}
                        className={`w-full py-3 rounded-xl text-white font-black text-xs uppercase tracking-wider shadow-md mb-3 transition-all cursor-pointer border-none ${
                        verifying ? 'bg-slate-400 cursor-wait animate-pulse' : 'bg-[#234B20] hover:bg-[#1a3818]'
                        }`}
                    >
                        {verifying ? 'Verifying Payment...' : 'Verify My Payment'}
                    </button>
                    <button
                        onClick={() => setPendingPayment(null)}
                        className="text-[10px] text-amber-900 hover:text-red-700 underline tracking-wider font-bold uppercase transition-colors cursor-pointer bg-transparent border-none block mx-auto"
                    >
                        Cancel Top-Up
                    </button>
                    </div>
                )}
                </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="lg:col-span-4 space-y-6">
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-slate-900">
                    <History size={17} className="text-[#7A2F3D]" />
                    Recent Activity
                    </h3>
                    <button
                    onClick={fetchAllTransactions}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#7A2F3D] transition hover:border-[#7A2F3D]/25 hover:bg-[#7A2F3D]/5 cursor-pointer"
                    >
                    See All
                    </button>
                </div>

                <div className="divide-y divide-slate-100">
                    {loading ? (
                    <p className="py-8 text-center text-xs font-medium text-slate-400 animate-pulse">Loading recent activity...</p>
                    ) : transactions.length === 0 ? (
                    <p className="py-8 text-center text-xs italic font-medium text-slate-400">No transactions yet.</p>
                    ) : (
                    transactions.map(tx => {
                        const isCredit = tx.type === 'TOPUP';
                        return (
                        <button
                            key={tx.id}
                            type="button"
                            onClick={() => setReceiptTx(tx)}
                            className="flex w-full items-center justify-between gap-3 bg-transparent py-3 text-left transition hover:bg-slate-50 cursor-pointer border-none"
                        >
                            <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${isCredit ? 'bg-emerald-500' : 'bg-[#7A2F3D]'}`} />
                                <p className="truncate text-xs font-black text-slate-900">
                                {tx.type === 'TOPUP' ? 'Top-Up Load' : 'Fare Payment'}
                                </p>
                            </div>
                            <p className="mt-1 truncate pl-4 text-[10px] font-mono font-bold text-slate-400">
                                {transactionId(tx)}
                            </p>
                            <p className="mt-0.5 pl-4 text-[10px] font-mono text-slate-400">{formatDate(tx.createdAt)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                            <p className={`font-mono text-sm font-black ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {isCredit ? '+' : '-'}&#8369;{parseFloat(tx.amount?.toString() || '0').toFixed(2)}
                            </p>
                            <span
                                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-tight ${
                                tx.status === 'SUCCESS'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                            }`}>
                                {tx.status === 'SUCCESS' ? 'Completed' : tx.status}
                            </span>
                            </div>
                        </button>
                        );
                    })
                    )}
                </div>
                </div>
            </div>

            </div>
        </main>

        {/* TRANSACTION HISTORY MODAL */}
        {showModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-80 px-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7A2F3D]/8 text-[#7A2F3D]">
                    <History size={17} />
                    </div>
                    <div className="min-w-0">
                    <h3 className="truncate text-sm font-black uppercase tracking-tight text-slate-900">Transaction History</h3>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-400">Tap a row to view receipt</p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                    onClick={downloadTransactions}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#7A2F3D]/15 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-[#7A2F3D] transition hover:bg-[#7A2F3D]/5 cursor-pointer"
                    >
                    <Download size={13} />
                    CSV
                    </button>
                    <button
                    onClick={() => setShowModal(false)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 cursor-pointer border-none"
                    >
                    <X size={14} />
                    </button>
                </div>
                </div>

                <div className="overflow-y-auto p-6 space-y-3 max-h-[70vh] bg-slate-50/50">
                {allTransactions.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs font-bold">No extended records found.</p>
                ) : (
                    allTransactions.map(tx => {
                    const isCredit = tx.type === 'TOPUP';
                    return (
                        <button
                        key={tx.id}
                        type="button"
                        onClick={() => setReceiptTx(tx)}
                        className="flex w-full items-center justify-between p-3.5 rounded-xl bg-white border border-slate-100 shadow-2xs text-left transition hover:border-[#7A2F3D]/25 hover:bg-[#7A2F3D]/5 cursor-pointer"
                        >
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {isCredit ? <Smartphone size={16} /> : <MapPin size={16} className="text-[#7A2F3D]" />}
                            </div>
                            <div>
                            <p className="font-black text-xs text-slate-900">
                                {tx.type === 'TOPUP' ? 'Top-Up Load' : 'Fare Payment'}
                            </p>
                            <p className="text-[9px] text-[#7A2F3D] font-mono font-black mt-0.5">
                                ID: {transactionId(tx)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatDate(tx.createdAt)}</p>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className={`font-mono font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isCredit ? '+' : '-'}&#8369;{parseFloat(tx.amount?.toString() || '0').toFixed(2)}
                            </p>
                            <span
                            className="inline-block text-[8px] font-black uppercase px-1.5 py-0.2 rounded mt-0.5"
                            style={{
                                backgroundColor: tx.status === 'SUCCESS' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                color: tx.status === 'SUCCESS' ? '#16a34a' : '#d97706'
                            }}
                            >
                            {tx.status === 'SUCCESS' ? 'Completed' : tx.status}
                            </span>
                        </div>
                        </button>
                    );
                    })
                )}
                </div>

                <div className="p-4 bg-white border-t border-slate-100 text-center">
                <button
                    onClick={() => setShowModal(false)}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase transition-colors cursor-pointer border-none"
                >
                    Close View
                </button>
                </div>
            </div>
            </div>
        )}

        {/* TRANSACTION RECEIPT MODAL */}
        {receiptTx && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-100 px-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#7A2F3D]">Premier Transport</p>
                    <h3 className="mt-0.5 text-base font-black text-slate-900">Receipt</h3>
                </div>
                <button
                    type="button"
                    onClick={() => setReceiptTx(null)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 border-none cursor-pointer"
                >
                    <X size={15} />
                </button>
                </div>

                <div className="px-5 py-5">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {receiptTx.type === 'TOPUP' ? 'Top-Up Load' : 'Fare Payment'}
                        </p>
                        <p className={`mt-1 font-mono text-2xl font-black ${
                        receiptTx.type === 'TOPUP' ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                        {receiptTx.type === 'TOPUP' ? '+' : '-'}&#8369;{parseFloat(receiptTx.amount?.toString() || '0').toFixed(2)}
                        </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider ${
                        receiptTx.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                        {receiptTx.status === 'SUCCESS' ? 'Completed' : receiptTx.status}
                    </span>
                    </div>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                    <div className="flex justify-between gap-4">
                    <span className="font-bold text-slate-500">Reference ID</span>
                    <strong className="text-right font-mono text-slate-900">{transactionId(receiptTx)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                    <span className="font-bold text-slate-500">Date & Time</span>
                    <strong className="text-right font-mono text-slate-900">{formatDate(receiptTx.createdAt) || '-'}</strong>
                    </div>
                    {receiptTx.balanceBefore !== undefined && receiptTx.balanceBefore !== null && (
                    <div className="flex justify-between gap-4">
                        <span className="font-bold text-slate-500">Balance Before</span>
                        <strong className="text-right font-mono text-slate-900">&#8369;{parseFloat(receiptTx.balanceBefore?.toString() || '0').toFixed(2)}</strong>
                    </div>
                    )}
                    {receiptTx.balanceAfter !== undefined && receiptTx.balanceAfter !== null && (
                    <div className="flex justify-between gap-4">
                        <span className="font-bold text-slate-500">Balance After</span>
                        <strong className="text-right font-mono text-slate-900">&#8369;{parseFloat(receiptTx.balanceAfter?.toString() || '0').toFixed(2)}</strong>
                    </div>
                    )}
                    {receiptTx.description && (
                    <div className="border-t border-slate-100 pt-3">
                        <span className="font-bold text-slate-500">Description</span>
                        <p className="mt-1 leading-relaxed text-slate-700">{receiptTx.description}</p>
                    </div>
                    )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                    type="button"
                    onClick={() => downloadReceipt(receiptTx)}
                    className="rounded-xl border border-[#7A2F3D]/20 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#7A2F3D] transition hover:bg-[#7A2F3D]/5 cursor-pointer"
                    >
                    Download
                    </button>

                    <button
                    type="button"
                    onClick={() => setReceiptTx(null)}
                    className="rounded-xl bg-[#7A2F3D] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#642633] border-none cursor-pointer"
                    >
                    Close
                    </button>
                </div>
                </div>
            </div>
            </div>
        )}

        {/* QR FARE PAYMENT MODAL */}
        {showQrModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-90 px-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-6 py-4 bg-[#7A2F3D] text-white">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-yellow-300">Premier Web Fare</p>
                    <h3 className="font-black text-lg tracking-tight">Scan QR Code</h3>
                </div>
                <button
                    onClick={() => setShowQrModal(false)}
                    className="grid place-items-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-none"
                >
                    <X size={16} />
                </button>
                </div>

                <div className="p-6 bg-slate-50 text-center">
                {(qrState === 'loading' || qrState === 'refreshing') && (
                    <div className="grid min-h-80 place-items-center">
                    <div>
                        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#7A2F3D]/20 border-t-[#7A2F3D]" />
                        <p className="text-sm font-black text-slate-800">Preparing secure QR...</p>
                    </div>
                    </div>
                )}

                {qrState === 'ready' && qrData?.payload && (
                    <>
                    <div className="mx-auto inline-block rounded-3xl border border-yellow-300 bg-white p-4 shadow-lg">
                        <QRCodeSVG value={qrData.payload} size={280} bgColor="#FFFFFF" fgColor="#000000" level="M" includeMargin />
                    </div>
                    <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Ready to scan
                    </div>
                    <p className="mt-3 text-sm font-black text-[#7A2F3D]">Refreshes in {formatCountdown(qrSeconds)}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        Keep screen brightness high and hold the QR steady until the reader confirms payment.
                    </p>
                    </>
                )}

                {qrState === 'success' && (
                    <div className="py-8">
                    <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-emerald-600 text-white">
                        <CheckCircle2 size={42} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Payment Successful</h3>
                    <p className="mt-3 text-sm font-bold text-slate-600">
                        Fare deducted: &#8369;{parseFloat(qrPayment?.deductedFare || 0).toFixed(2)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                        Remaining balance: &#8369;{parseFloat(qrPayment?.remainingBalance || 0).toFixed(2)}
                    </p>
                    <p className="mt-2 text-xs font-mono font-black text-[#7A2F3D]">
                        ID: {qrPayment?.referenceNumber || '-'}
                    </p>
                    <button
                        onClick={() => setShowQrModal(false)}
                        className="mt-5 rounded-xl bg-[#7A2F3D] px-6 py-3 text-xs font-black uppercase tracking-widest text-white border-none cursor-pointer"
                    >
                        Done
                    </button>
                    </div>
                )}

                {qrState === 'failed' && (
                    <div className="py-8">
                    <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-red-700 text-white">
                        <AlertTriangle size={38} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">QR Payment Unavailable</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{qrError || 'Unable to prepare QR payment.'}</p>
                    <button
                        onClick={() => loadQrToken(false)}
                        className="mt-5 rounded-xl bg-[#7A2F3D] px-6 py-3 text-xs font-black uppercase tracking-widest text-white border-none cursor-pointer"
                    >
                        Try Again
                    </button>
                    </div>
                )}
                </div>
            </div>
            </div>
        )}

        </div>
    );
};

export default DashboardPage;

