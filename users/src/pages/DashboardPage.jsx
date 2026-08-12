import { useCallback, useEffect, useState } from 'react';
import API from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { toast } from 'react-toastify';
import { QRCodeSVG } from 'qrcode.react';
import {
  History, MapPin, Search, ArrowUp, ArrowDown, Bus,
  Smartphone, CreditCard, X, QrCode, CheckCircle2, AlertTriangle, Download
} from 'lucide-react';
import gcash from '../assets/image/gcash.png';
import maya from '../assets/image/maya.png';
import { captureEvent } from '../lib/posthog';
import { formatDateTime, phtDateKey } from '../lib/time';
import { useRealtime } from '../context/RealtimeContext';

const QUICK_AMOUNTS    = [20, 50, 100, 200];
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
    const [historySearch, setHistorySearch] = useState('');
    const [historyFilter, setHistoryFilter] = useState('ALL');
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
    const { subscribe } = useRealtime();

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

    useEffect(() => subscribe((event) => {
        if (event.entity === 'TRANSACTION' || event.entity === 'TOPUP' || event.entity === 'PASSENGER') {
            fetchData();
        }
    }), [fetchData, subscribe]);

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
        link.download = `premier-transactions-${phtDateKey()}.csv`;
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
        toast.warning('Please select or enter a valid amount (minimum 20)');
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
        return formatDateTime(dateStr);
    };

    const currentBalNum = parseFloat(balance?.balance || 0);
    const activeTopUpAmount = selectedAmount || Number.parseFloat(customAmount);
    const canProceedToPayment = Boolean(activeTopUpAmount >= 20 && selectedPayment && !pendingPayment);
    const filteredHistory = allTransactions.filter((transaction) => {
        const query = historySearch.trim().toLowerCase();
        const matchesSearch = !query || transactionId(transaction).toLowerCase().includes(query);
        const matchesFilter = historyFilter === 'ALL'
            || (historyFilter === 'TOPUP' && transaction.type === 'TOPUP')
            || (historyFilter === 'FARE' && transaction.type !== 'TOPUP')
            || (historyFilter === 'COMPLETED' && transaction.status === 'SUCCESS');
        return matchesSearch && matchesFilter;
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return (
        <div className="min-h-screen bg-white font-sans text-[#1F2937] pb-16 selection:bg-[#7A2635] selection:text-white">

        {/* FIXED NAVIGATION */}
        <Navbar />

        <main className="mx-auto max-w-7xl px-5 pb-12 pt-16 md:px-8">
            <header className="relative flex min-h-[176px] items-center py-7 md:h-[184px] md:py-0 before:absolute before:inset-y-0 before:left-1/2 before:z-0 before:w-screen before:-translate-x-1/2 before:rounded-b-xl before:bg-[#7A2635]">
                <div className="relative z-10 grid w-full gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div>
                        <p className="mb-2 text-[14px] font-semibold text-white/90">Passenger dashboard</p>
                        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">Available balance</p>
                        <h1 className="mt-2 font-mono text-[48px] font-black leading-none tracking-tight text-white md:text-[56px]">&#8369;{currentBalNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h1>
                        <div className="mt-3 flex items-center gap-3 text-[14px] text-white/80"><span>Card ••••{balance?.cardNumber ? String(balance.cardNumber).slice(-4) : '—'}</span><span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" /><span className="font-semibold text-[#22C55E]">Active</span></div>
                    </div>
                    <div className="flex w-full flex-nowrap gap-4 md:w-auto md:justify-self-end">
                        <button type="button" onClick={() => document.getElementById('recharge-section')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-3 text-base font-semibold text-[#651F2D] transition hover:bg-[#e4c65d] cursor-pointer border-none md:w-[132px] md:flex-none md:px-5"><CreditCard size={16} /> Top Up</button>
                        <button type="button" onClick={() => loadQrToken(false)} disabled={qrState === 'loading' || qrState === 'refreshing'} className="inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-3 text-base font-semibold text-white transition hover:bg-white/15 disabled:opacity-70 cursor-pointer md:w-[144px] md:flex-none md:px-5"><QrCode size={16} /> {qrState === 'loading' || qrState === 'refreshing' ? 'Preparing...' : 'Show QR'}</button>
                    </div>
                </div>
            </header>

            <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-0">
            <div className="lg:col-span-8">

                {/* RECHARGE FLOW */}
                <section id="recharge-section" className="lg:pr-12">
                <h2 className="mb-2 text-[32px] font-bold tracking-tight text-[#1F2937]">Recharge</h2>
                <p className="mb-8 text-[13px] text-[#6B7280]">Add funds to your transport card.</p>

                <label className="mb-3 block text-[13px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                    Step 1 · Choose amount
                </label>
                <div className="mb-5 grid grid-cols-2 gap-3 font-mono sm:grid-cols-4">
                    {QUICK_AMOUNTS.map(amt => (
                    <button
                        key={amt}
                        type="button"
                        aria-pressed={selectedAmount === amt}
                        onClick={() => { setSelectedAmount(amt); setCustomAmount(''); }}
                        className={`min-h-12 rounded-xl border font-semibold text-sm transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2635] ${
                        selectedAmount === amt
                            ? 'border-[#7A2635] bg-[#7A2635] text-white shadow-[0_1px_2px_rgba(122,38,53,0.18)]'
                            : 'border-[#D1D5DB] bg-[#FAFAFB] text-[#1F2937] hover:border-[#7A2635]/50 hover:bg-white'
                        }`}
                    >
                        &#8369;{amt}
                    </button>
                    ))}
                </div>

                <label className="mb-2 block text-[13px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                    Custom amount (&#8369;)
                </label>
                <input
                    type="number"
                    placeholder="Enter custom amount (min ₱20.00)"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                    className="mb-9 min-h-12 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-base font-mono font-bold text-[#1F2937] outline-none transition-all placeholder-slate-400 focus:border-[#7A2635] focus:ring-2 focus:ring-[#7A2635]/15"
                />

                <label className="mb-3 block text-[13px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                    Step 2 · Payment method
                </label>
                <div className="mb-9 divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
                    {PAYMENT_METHODS.map(pm => {
                    const isGcash    = pm.toLowerCase() === 'gcash';
                    const isSelected = selectedPayment === pm;
                    return (
                        <button
                        key={pm}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedPayment(pm)}
                        className={`flex min-h-16 w-full items-center justify-between rounded-lg border px-3 text-left cursor-pointer transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2635] ${
                            isSelected
                            ? 'border-[#7A2635]/60 bg-[#7A2635]/5 text-[#7A2635]'
                            : 'border-transparent bg-white text-[#1F2937] hover:bg-[#FAFAFB]'
                        }`}
                        >
                        <span className="flex items-center gap-3">
                            <img src={isGcash ? gcash : maya} alt="" className="h-7 w-7 object-contain" />
                            <span><span className="block text-[15px] font-semibold">{pm} Wallet</span><span className="block text-[11px] text-[#6B7280]">Secure digital wallet</span></span>
                        </span>
                        <span aria-hidden="true" className={`grid h-4 w-4 place-items-center rounded-full border ${isSelected ? 'border-[#7A2635]' : 'border-[#D1D5DB]'}`}>
                            {isSelected && <span className="h-2 w-2 rounded-full bg-[#7A2635]" />}
                        </span>
                        </button>
                    );
                    })}
                </div>

                <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">Step 3 · Confirm payment</p>
                <button
                    onClick={handleTopUp}
                    disabled={!canProceedToPayment}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-none bg-[#7A2635] px-5 text-base font-semibold text-white transition hover:bg-[#651F2D] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:active:scale-100"
                >
                    <CreditCard size={18} /> Proceed to Payment
                </button>

                {pendingPayment && (
                    <div className="mt-6 border-t border-[#E5E7EB] pt-6 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                        <p className="flex items-center gap-2 text-[13px] font-semibold text-[#1F2937]"><span className="h-2 w-2 rounded-full bg-[#D4AF37]" />Payment pending</p>
                        <p className="mt-1 text-[12px] text-[#6B7280]">Complete payment in the opened tab, then verify it here.</p>
                        </div>
                        <p className="font-mono text-[12px] text-[#6B7280]">Ref: <strong className="text-[#1F2937]">{pendingPayment.referenceNumber}</strong> <span className="mx-1 text-[#D1D5DB]">·</span> &#8369;{pendingPayment.amount}</p>
                    </div>
                    <button
                        onClick={handleCheckPayment}
                        disabled={verifying}
                        className={`mt-5 h-12 w-full rounded-xl text-white text-sm font-semibold transition-all cursor-pointer border-none ${
                        verifying ? 'bg-slate-400 cursor-wait animate-pulse' : 'bg-[#7A2635] hover:bg-[#651F2D]'
                        }`}
                    >
                        {verifying ? 'Verifying Payment...' : 'Verify My Payment'}
                    </button>
                    <button
                        onClick={() => setPendingPayment(null)}
                        className="mt-3 text-[12px] text-[#6B7280] hover:text-[#7A2635] underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-none block mx-auto"
                    >
                        Cancel Top-Up
                    </button>
                    </div>
                )}
                </section>
            </div>

            {/* RIGHT SIDEBAR */}
            <aside id="transactions" className="border-t border-[#E5E7EB] pt-10 lg:col-span-4 lg:border-l lg:border-slate-200/70 lg:border-t-0 lg:pl-12 lg:pt-0">
                <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#E5E7EB] pb-4">
                    <h2 className="text-[32px] font-bold tracking-tight text-[#1F2937]">Recent activity</h2>
                    <button
                    onClick={fetchAllTransactions}
                    className="border-none bg-transparent px-0 py-1 text-sm font-semibold text-[#7A2635] transition hover:text-[#651F2D] cursor-pointer"
                    >
                    View all
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
                            className="flex w-full items-center justify-between gap-4 bg-transparent py-5 text-left transition hover:bg-slate-50 cursor-pointer border-none"
                        >
                            <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${isCredit ? 'bg-emerald-500' : 'bg-[#7A2F3D]'}`} />
                                <p className="truncate text-sm font-semibold text-[#1F2937]">
                                {tx.type === 'TOPUP' ? 'Top-Up Load' : 'Fare Payment'}
                                </p>
                            </div>
                            <p className="mt-1 truncate pl-4 text-[12px] font-mono font-medium text-[#64748B]">
                                {transactionId(tx)}
                            </p>
                            <p className="mt-0.5 pl-4 text-[12px] font-mono text-[#64748B]">{formatDate(tx.createdAt)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                            <p className={`font-mono text-lg font-bold ${isCredit ? 'text-[#16A34A]' : 'text-[#7A2635]'}`}>
                                {isCredit ? '+' : '-'}&#8369;{parseFloat(tx.amount?.toString() || '0').toFixed(2)}
                            </p>
                            <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-[#6B7280]"><i className={`h-1.5 w-1.5 rounded-full ${tx.status === 'SUCCESS' ? 'bg-[#16A34A]' : 'bg-amber-500'}`} />{tx.status === 'SUCCESS' ? 'Completed' : tx.status}</span>
                            </div>
                        </button>
                        );
                    })
                    )}
                </div>
            </aside>

            </div>
        </main>

        {/* TRANSACTION HISTORY MODAL */}
        {showModal && (
            <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/45 px-4">
            <section role="dialog" aria-modal="true" aria-labelledby="transaction-history-title" className="flex max-h-[80vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.16)]">
                <header className="flex items-start justify-between gap-5 border-b border-[#E5E7EB] px-6 py-5">
                    <div><h2 id="transaction-history-title" className="text-base font-semibold text-[#1F2937]">Transaction History</h2><p className="mt-1 text-[13px] text-[#6B7280]">Select a transaction to view the receipt.</p></div>
                    <div className="flex items-center gap-2"><button type="button" onClick={downloadTransactions} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#6E2233] transition hover:bg-[#F8F9FB]"><Download size={14} /> Export CSV</button><button type="button" onClick={() => setShowModal(false)} aria-label="Close transaction history" className="grid h-9 w-9 place-items-center rounded-lg text-[#6B7280] transition hover:bg-[#F8F9FB]"><X size={18} /></button></div>
                </header>
                <div className="border-b border-[#E5E7EB] px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="relative min-w-[14rem] flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" /><input type="search" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search by Transaction ID" className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-[13px] text-[#1F2937] outline-none focus:border-[#6E2233] focus:ring-2 focus:ring-[#6E2233]/10" /></label>
                        {[['ALL', 'All'], ['TOPUP', 'Top-Up'], ['FARE', 'Fare Payment'], ['COMPLETED', 'Completed']].map(([value, label]) => <button key={value} type="button" onClick={() => setHistoryFilter(value)} className={`h-9 rounded-lg px-3 text-[13px] font-medium transition ${historyFilter === value ? 'bg-[#6E2233] text-white' : 'bg-white text-[#6B7280] hover:bg-[#F8F9FB]'}`}>{label}</button>)}
                        <span className="ml-auto text-[13px] font-medium text-[#6B7280]">Newest first</span>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6">
                {filteredHistory.length === 0 ? <p className="py-12 text-center text-[13px] text-[#6B7280]">No transactions match your search.</p> : filteredHistory.map(tx => {
                    const isCredit = tx.type === 'TOPUP';
                    return <button key={tx.id} type="button" onClick={() => setReceiptTx(tx)} className="flex w-full items-center justify-between gap-4 border-b border-[#E5E7EB] py-4 text-left transition hover:bg-[#F8F9FB] cursor-pointer">
                        <span className="flex min-w-0 items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${isCredit ? 'bg-emerald-50 text-[#16A34A]' : 'bg-[#6E2233]/7 text-[#6E2233]'}`}>{isCredit ? <ArrowUp size={15} /> : <Bus size={15} />}</span><span className="min-w-0"><strong className="block text-sm font-semibold text-[#1F2937]">{isCredit ? 'Top-Up' : 'Fare Payment'}</strong><span className="mt-1 block truncate font-mono text-xs text-[#6B7280]">{transactionId(tx)}</span><span className="mt-1 block text-[13px] text-[#6B7280]">{formatDate(tx.createdAt)}</span></span></span>
                        <span className="shrink-0 text-right"><strong className={`block font-mono text-xl font-bold ${isCredit ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{isCredit ? '+' : '-'}&#8369;{parseFloat(tx.amount?.toString() || '0').toFixed(2)}</strong><span className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#6B7280]"><i className={`h-1.5 w-1.5 rounded-full ${tx.status === 'SUCCESS' ? 'bg-[#16A34A]' : 'bg-amber-500'}`} />{tx.status === 'SUCCESS' ? 'Completed' : tx.status}</span></span>
                    </button>;
                })}
                </div>
                <footer className="flex justify-end border-t border-[#E5E7EB] px-6 py-4"><button type="button" onClick={() => setShowModal(false)} className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#1F2937] transition hover:bg-[#F8F9FB]">Close</button></footer>
            </section>
            </div>
        )}

        {/* TRANSACTION RECEIPT MODAL */}
        {receiptTx && (
            <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/45 px-4">
            <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.16)]">
                <header className="flex items-start justify-between border-b border-[#E5E7EB] px-6 py-5">
                    <div>
                        <p className="text-[13px] font-semibold text-[#6E2233]">Premier Transport Corporation</p>
                        <h2 id="receipt-title" className="mt-1 text-base font-semibold text-[#1F2937]">Receipt</h2>
                    </div>
                    <button type="button" onClick={() => setReceiptTx(null)} aria-label="Close receipt" className="grid h-9 w-9 place-items-center rounded-lg text-[#6B7280] transition hover:bg-[#F8F9FB]"><X size={18} /></button>
                </header>

                <div className="px-6 py-6">
                    <p className="text-[13px] font-medium text-[#6B7280]">Transaction type</p>
                    <div className="mt-1 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-base font-semibold text-[#1F2937]">{receiptTx.type === 'TOPUP' ? 'Top-Up' : 'Fare Payment'}</p>
                            <p className={`mt-2 font-mono text-[40px] font-bold leading-none ${receiptTx.type === 'TOPUP' ? 'text-[#16A34A]' : 'text-[#1F2937]'}`}>
                                {receiptTx.type === 'TOPUP' ? '+' : '-'}&#8369;{parseFloat(receiptTx.amount?.toString() || '0').toFixed(2)}
                            </p>
                        </div>
                        <span className="mb-1 inline-flex items-center gap-1.5 text-[13px] text-[#6B7280]"><i className={`h-1.5 w-1.5 rounded-full ${receiptTx.status === 'SUCCESS' ? 'bg-[#16A34A]' : 'bg-amber-500'}`} />{receiptTx.status === 'SUCCESS' ? 'Completed' : receiptTx.status}</span>
                    </div>

                    <section className="mt-7 border-y border-[#E5E7EB] py-5">
                        <h3 className="text-[13px] font-semibold text-[#1F2937]">Transaction details</h3>
                        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 text-[13px]">
                            <div><dt className="text-[#6B7280]">Receipt number</dt><dd className="mt-1 break-all font-mono font-medium text-[#1F2937]">{transactionId(receiptTx)}</dd></div>
                            <div><dt className="text-[#6B7280]">Reference ID</dt><dd className="mt-1 break-all font-mono font-medium text-[#1F2937]">{receiptTx.id || '-'}</dd></div>
                            <div><dt className="text-[#6B7280]">Date &amp; time</dt><dd className="mt-1 font-medium text-[#1F2937]">{formatDate(receiptTx.createdAt) || '-'}</dd></div>
                            <div><dt className="text-[#6B7280]">Payment method</dt><dd className="mt-1 font-medium text-[#1F2937]">{receiptTx.paymentMethod || (receiptTx.type === 'TOPUP' ? 'Digital wallet' : 'RFID fare')}</dd></div>
                        </dl>
                    </section>

                    {(receiptTx.balanceBefore !== undefined && receiptTx.balanceBefore !== null || receiptTx.balanceAfter !== undefined && receiptTx.balanceAfter !== null) && (
                        <dl className="border-b border-[#E5E7EB] py-4 text-[13px]">
                            {receiptTx.balanceBefore !== undefined && receiptTx.balanceBefore !== null && <div className="flex items-center justify-between gap-4 py-1"><dt className="text-[#6B7280]">Balance before</dt><dd className="font-mono font-medium text-[#1F2937]">&#8369;{parseFloat(receiptTx.balanceBefore?.toString() || '0').toFixed(2)}</dd></div>}
                            {receiptTx.balanceAfter !== undefined && receiptTx.balanceAfter !== null && <div className="flex items-center justify-between gap-4 py-1"><dt className="text-[#6B7280]">Balance after</dt><dd className="font-mono font-medium text-[#1F2937]">&#8369;{parseFloat(receiptTx.balanceAfter?.toString() || '0').toFixed(2)}</dd></div>}
                        </dl>
                    )}
                    {receiptTx.description && <div className="pt-4"><p className="text-[13px] font-medium text-[#6B7280]">Description</p><p className="mt-1 text-[13px] leading-6 text-[#1F2937]">{receiptTx.description}</p></div>}
                </div>

                <footer className="flex items-center justify-between border-t border-[#E5E7EB] px-6 py-4">
                    <button type="button" onClick={() => downloadReceipt(receiptTx)} className="h-10 rounded-lg border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#1F2937] transition hover:bg-[#F8F9FB]"><Download size={15} className="mr-2 inline-block" />Download receipt</button>
                    <button type="button" onClick={() => setReceiptTx(null)} className="h-10 rounded-lg bg-[#6E2233] px-5 text-[13px] font-semibold text-white transition hover:bg-[#581b29]">Close</button>
                </footer>
            </section>
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

