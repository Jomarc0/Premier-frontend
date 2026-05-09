import { useEffect, useState, useRef } from 'react';
import API from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { toast } from 'react-toastify';
import { 
  History, MapPin, Zap, ShieldCheck, 
  Smartphone, CreditCard, Bot, Send, X 
} from 'lucide-react';
import gcash from '../assets/image/gcash.png';
import maya from '../assets/image/maya.png';

const QUICK_AMOUNTS = [20, 40, 50, 100];
const PAYMENT_METHODS = ['Gcash', 'Maya'];

const DashboardPage = () => {
    const { passenger } = useAuth();
    const [balance, setBalance] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [allTransactions, setAllTransactions] = useState([]);
    const [selectedAmount, setSelectedAmount] = useState(null);
    const [customAmount, setCustomAmount] = useState('');
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [loading, setLoading] = useState(true);
    const [pendingPayment, setPendingPayment] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        { from: 'bot', text: "👋 Hi! I'm here to help with your top-up or fare questions. Use the suggestions below to get started!" },
    ]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef(null);

    useEffect(() => { 
        fetchData(); 
    }, []);

    useEffect(() => { 
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
    }, [chatMessages]);

    const fetchData = async () => {
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
    };

    const fetchAllTransactions = async () => {
        try {
        const res = await API.get('/transactions?page=0&size=50');
        setAllTransactions(res.data.data?.content || []);
        setShowModal(true);
        } catch (err) {
        toast.error('Failed to load transactions');
        }
    };

    const handleTopUp = async () => {
        const amount = selectedAmount || parseFloat(customAmount);
        if (!amount || amount < 20) {
        toast.warning('Please select or enter a valid amount (min ₱20)');
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
        const res = await API.post('/topup/initiate', { amount });
        const { checkoutUrl, referenceNumber, topUpId } = res.data.data;
        setPendingPayment({ referenceNumber, amount, topUpId });
        window.open(checkoutUrl, '_blank');
        toast.info('Complete your payment in the new tab. Click "I Already Paid" after paying.');
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
        } catch (specificErr) {
            res = await API.post('/topup/check-paid');
        }
        const { newBalance, amount } = res.data.data;
        toast.success(`₱${amount} added! New balance: ₱${newBalance}`);
        setPendingPayment(null);
        setSelectedAmount(null);
        setCustomAmount('');
        setSelectedPayment(null);
        fetchData();
        } catch (err) {
        toast.error(err.response?.data?.message || 'Payment not yet completed. Please try again.');
        } finally {
        setVerifying(false);
        }
    };

    const handleChatSend = (msg) => {
        const text = msg || chatInput;
        if (!text.trim()) return;
        setChatMessages(prev => [...prev, { from: 'user', text }]);
        setChatInput('');
        setTimeout(() => {
        setChatMessages(prev => [...prev, { from: 'bot', text: getBotReply(text) }]);
        }, 800);
    };

    const getBotReply = (msg) => {
        const m = msg.toLowerCase();
        if (m.includes('top-up') || m.includes('topup') || m.includes('recharge'))
        return 'For top-up issues, please ensure payment was completed. Top-ups reflect within 5-10 minutes.';
        if (m.includes('fare') || m.includes('deduct'))
        return 'Fare deductions are processed automatically on tap-in/tap-out. If incorrectly charged, our team will review it within 24 hours.';
        if (m.includes('payment') || m.includes('failed'))
        return 'If your payment failed, please check your GCash/Maya balance. Try again or contact support at (123) 456-7890.';
        return 'Thank you for contacting Premier Transit Support! A support agent will respond within 24 hours.';
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
        <div className="min-h-screen bg-[#F1F5F9] font-sans text-slate-800 pb-16 selection:bg-[#7B181E] selection:text-white">
        {/* FIXED NAVIGATION */}
        <Navbar />

        {/* HEADER HERO AREA FROM DESIGN REFERENCE */}
        <header className="pt-24 pb-32 md:pb-40 bg-[#7B181E] relative overflow-hidden shadow-inner">
            <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="w-full md:w-auto">
                <div className="inline-flex items-center gap-2 bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase mb-3 border border-yellow-400/30">
                <ShieldCheck size={12} /> Secure RFID Connection Active
                </div>
                
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                WELCOME BACK, PASSENGER!
                </h2>
                
                <p className="text-white/80 text-xs md:text-base font-medium mt-1">
                Ride smarter with Premier Transit — top up and track fares in one place.
                </p>

                {/* Preserved Card No and User ID info row */}
                <div className="mt-4 inline-flex flex-wrap gap-3 md:gap-6 bg-black/20 backdrop-blur-xs px-4 py-2 rounded-xl border border-white/10 text-white text-xs font-mono">
                <span>CARD NO: <strong className="text-yellow-400">{balance?.cardNumber || '—'}</strong></span>
                </div>
            </div>

            </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="max-w-6xl mx-auto px-4 md:px-8 -mt-20 md:mt-20 relative z-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            
            {/* LEFT COLUMN */}
            <div className="lg:col-span-8 space-y-6 md:space-y-8">
                
                {/* BALANCE CARD FROM DESIGN REFERENCE */}
                <div className="bg-white rounded-3xl md:rounded-4xl shadow-2xl overflow-hidden border border-white">
                <div className="p-6 md:p-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-linear-to-br from-white to-slate-50">
                    <div>
                    <p className="text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest mb-1">
                        Available Balance
                    </p>
                    <h3 className="text-4xl md:text-6xl font-black text-slate-900 flex items-start gap-1 tracking-tight font-mono">
                        <span className="text-xl md:text-2xl mt-2 md:mt-3 text-slate-400 font-bold font-sans">₱</span> 
                        {currentBalNum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
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
                    <Zap size={18} className="fill-yellow-400 text-yellow-400" /> QUICK TOP UP
                    </button>
                </div>

                <div className="bg-slate-50 px-6 md:px-10 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-slate-500 text-[10px] md:text-[11px] font-medium italic">
                    Fixed-fare cashless transportation service is currently active.
                    </p>
                    <div className="text-[10px] font-bold text-[#7B181E] bg-[#7B181E]/5 px-3 py-1 rounded-full uppercase">
                        Account: Active
                    </div>
                </div>
                </div>

                {/* RECHARGE CARD IMPLEMENTING DESIGN REFERENCE PILL STYLES */}
                <div id="recharge-section" className="bg-white rounded-3xl md:rounded-4xl p-6 md:p-8 border border-white shadow-xl">
                <h4 className="font-black text-slate-900 mb-6 flex items-center gap-2 text-sm md:text-base uppercase tracking-tighter">
                    <CreditCard size={18} className="text-[#7B181E]" /> Recharge Your Card
                </h4>

                {/* Summary box from real system styled seamlessly */}
                <div className="rounded-2xl p-4 mb-6 bg-slate-50 border border-slate-100/80 space-y-2">
                    <div className="flex justify-between text-xs md:text-sm">
                    <span className="text-slate-500 font-medium">Assigned Card Number</span>
                    <strong className="text-slate-900 font-mono font-bold">{balance?.cardNumber || '—'}</strong>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center text-xs md:text-sm">
                    <span className="text-slate-500 font-medium">Current Ledger Reserve</span>
                    <strong className="text-[#234B20] font-black font-mono text-sm bg-emerald-50 px-2 py-0.5 rounded">
                        ₱{currentBalNum.toFixed(2)}
                    </strong>
                    </div>
                </div>

                {/* Preset amounts container */}
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
                            ? 'bg-[#7B181E] text-white border-[#7B181E] shadow-md scale-105'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                    >
                        ₱{amt}
                    </button>
                    ))}
                </div>

                {/* Custom amount */}
                <label className="block mb-2 text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest">
                    Or Custom Recharge Amount (₱)
                </label>
                
                <input
                    type="number"
                    placeholder="Enter custom amount (min ₱20.00)"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 outline-none mb-6 focus:ring-2 focus:ring-[#7B181E]/30 focus:border-[#7B181E] transition-all bg-slate-50 placeholder-slate-400"
                />

            {/* Payment methods */}
            <label className="block mb-3 text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-widest">
            Authorized Payment Conductor
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {PAYMENT_METHODS.map(pm => {
                const isGcash = pm.toLowerCase() === 'gcash';
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

                    {/* LOGO */}
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 shadow-sm">
                        <img
                        src={isGcash ? gcash : maya}
                        alt={pm}
                        className="w-10 h-10 object-contain"
                        />
                    </div>

                    {/* TEXT */}
                    <div>
                        <span className="font-bold text-[15px] block text-slate-900">
                        {pm} Wallet
                        </span>

                        <span className="text-xs text-slate-400 block mt-0.5">
                        Instant encrypted sync
                        </span>
                    </div>
                </div>

                    <div
                    className={`w-3 h-3 rounded-full transition-all ${
                        isSelected
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                        : 'bg-slate-200'
                    }`}
                    ></div>
                </div>
                );
            })}
            </div>
               {/* Proceed button calling handleTopUp intact */}
                <button
                    onClick={handleTopUp}
                    className="w-full bg-[#7B181E] hover:bg-[#601217] text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-none"
                >
                    <CreditCard size={18} /> Proceed to Secured Payment Gateway
                </button>

                {/* Pending payment banner preserved perfectly */}
                {pendingPayment && (
                    <div className="mt-6 p-5 rounded-2xl bg-amber-50 border border-amber-300 shadow-sm animate-in fade-in duration-200 text-center">
                    <p className="font-black text-xs uppercase tracking-wider text-amber-900 mb-2 flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                        ⏳ Ongoing Payment Authorization
                    </p>
                    
                    <p className="text-xs font-mono text-amber-800 mb-4 bg-white/60 p-2 rounded-lg border border-amber-200 inline-block">
                        Ref: <strong className="text-slate-900">{pendingPayment.referenceNumber}</strong> | Amount: <strong className="text-[#7B181E]">₱{pendingPayment.amount}</strong>
                    </p>
                    
                    <button
                        onClick={handleCheckPayment}
                        disabled={verifying}
                        className={`w-full py-3 rounded-xl text-white font-black text-xs uppercase tracking-wider shadow-md mb-3 transition-all cursor-pointer border-none ${
                        verifying ? 'bg-slate-400 cursor-wait animate-pulse' : 'bg-[#234B20] hover:bg-[#1a3818]'
                        }`}
                    >
                        {verifying ? 'Verifying Checkout Status...' : 'I Already Paid — Check Active Ledger'}
                    </button>
                    
                    <button
                        onClick={() => setPendingPayment(null)}
                        className="text-[10px] text-amber-900 hover:text-red-700 underline tracking-wider font-bold uppercase transition-colors cursor-pointer bg-transparent border-none block mx-auto"
                    >
                        Cancel this Top-Up Transaction
                    </button>
                    </div>
                )}

                </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="lg:col-span-4 space-y-6">
                
                {/* RECENT TRIPS FROM DESIGN REFERENCE */}
                <div className="bg-white rounded-3xl md:rounded-4xl p-6 shadow-xl border border-white">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-base flex items-center gap-2 tracking-tight text-slate-900 uppercase">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[#7B181E] shrink-0">
                        <History size={16} />
                    </div>
                    Transaction History
                    </h3>
                    
                    <button 
                    onClick={fetchAllTransactions}
                    className="text-[#7B181E] font-bold text-[10px] bg-[#7B181E]/5 hover:bg-[#7B181E]/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer uppercase tracking-wider border-none"
                    >
                    See All →
                    </button>
                </div>

                <div className="space-y-3">
                    {loading ? (
                    <p className="text-center py-8 text-slate-400 text-xs font-medium animate-pulse">Auditing transit records...</p>
                    ) : transactions.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs italic font-medium">No ledger taps registered yet.</p>
                    ) : (
                    transactions.map(tx => {
                        const isCredit = tx.type === 'TOPUP';
                        return (
                        <div 
                            key={tx.id} 
                            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100/60 transition-all hover:bg-slate-100/80"
                        >
                            <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                                isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-400'
                            }`}>
                                {isCredit ? <Smartphone size={14} /> : <MapPin size={14} className="text-[#7B181E]" />}
                            </div>
                            <div>
                                <p className="font-black text-xs text-slate-900 leading-tight">
                                {tx.type === 'TOPUP' ? 'Top-Up Load' : 'Fare Payment'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {formatDate(tx.createdAt)}
                                </p>
                            </div>
                            </div>

                            <div className="text-right shrink-0">
                            <p className={`font-mono font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {isCredit ? '+' : '-'}₱{parseFloat(tx.amount?.toString() || '0').toFixed(2)}
                            </p>
                            <span 
                                className="inline-block text-[8px] font-black uppercase px-1.5 py-0.2 rounded mt-1 tracking-tight"
                                style={{
                                backgroundColor: tx.status === 'SUCCESS' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                color: tx.status === 'SUCCESS' ? '#16a34a' : '#d97706'
                                }}
                            >
                                {tx.status === 'SUCCESS' ? 'Completed' : tx.status}
                            </span>
                            </div>
                        </div>
                        );
                    })
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 italic">
                    Secure transaction logs synchronized with Premier Transport RFID system.
                    </p>
                </div>
                </div>

            </div>

            </div>
        </main>

        {/* FULL TRANSACTION HISTORY MODAL */}
        {showModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-80 px-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
                
                <div className="flex items-center justify-between px-6 py-4 bg-[#7B181E] text-white">
                <div className="flex items-center gap-2">
                    <History size={18} className="text-yellow-400" />
                    <span className="font-black text-xs uppercase tracking-wider">Full Transaction Ledger History</span>
                </div>
                
                <button
                    onClick={() => setShowModal(false)}
                    className="grid place-items-center w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-none"
                >
                    <X size={14} />
                </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-3 max-h-[70vh] bg-slate-50/50">
                {allTransactions.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs font-bold">No extended records found.</p>
                ) : (
                    allTransactions.map(tx => {
                    const isCredit = tx.type === 'TOPUP';
                    return (
                        <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-100 shadow-2xs"
                        >
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                            {isCredit ? <Smartphone size={16} /> : <MapPin size={16} className="text-[#7B181E]" />}
                            </div>
                            <div>
                            <p className="font-black text-xs text-slate-900">
                                {tx.type === 'TOPUP' ? 'Top-Up Load' : 'Fare Payment'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatDate(tx.createdAt)}</p>
                            </div>
                        </div>

                        <div className="text-right shrink-0">
                            <p className={`font-mono font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isCredit ? '+' : '-'}₱{parseFloat(tx.amount?.toString() || '0').toFixed(2)}
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
                        </div>
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

        {/* FLOATING CHATBOT  */}
        <div className="fixed bottom-6 right-6 z-60 flex flex-col items-end">
            
            {/* Chatbot window styled beautifully with Design reference styling */}
            {showChat && (
            <div className="w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 mb-3 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-150 flex flex-col h-90">
                
                {/* Chat header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#7B181E]">
                <div className="flex items-center gap-2 text-white font-black text-xs tracking-wider uppercase">
                    <Bot size={16} className="text-yellow-400" />
                    <span>🤖 Premier Bot Support</span>
                </div>
                
                <button
                    onClick={() => setChatMessages([{ from: 'bot', text: "👋 Hi! I'm here to help with your top-up or fare questions. Use the suggestions below to get started!" }])}
                    className="text-[10px] text-white/80 hover:text-white uppercase font-bold tracking-wider bg-white/10 px-2 py-1 rounded cursor-pointer border-none"
                    title="Reset log"
                >
                    Reset
                </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50 text-xs">
                {chatMessages.map((msg, i) => (
                    <div
                    key={i}
                    className={`flex flex-col ${msg.from === 'user' ? 'items-end' : 'items-start'}`}
                    >
                    <span className={`inline-block p-2.5 rounded-xl max-w-[85%] text-left leading-relaxed font-medium ${
                        msg.from === 'user'
                        ? 'bg-[#7B181E] text-white rounded-tr-xs shadow-2xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs shadow-2xs'
                    }`}>
                        {msg.text}
                    </span>
                    </div>
                ))}

                {/* Quick replies from real system */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                    {['Top-up issue', 'Fare deduction', 'Payment failed'].map(q => (
                    <button
                        key={q}
                        onClick={() => handleChatSend(q)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200 bg-white hover:bg-yellow-50 hover:border-yellow-400 text-slate-700 transition-colors cursor-pointer shrink-0 shadow-2xs"
                    >
                        💡 {q}
                    </button>
                    ))}
                </div>

                <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-slate-200">
                <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { 
                    if (e.key === 'Enter') handleChatSend(); 
                    }}
                    placeholder="Type your question..."
                    className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-100 border border-slate-200 text-slate-800 outline-none focus:ring-2 focus:ring-[#7B181E]/30"
                />
                <button
                    onClick={() => handleChatSend()}
                    disabled={!chatInput.trim()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-[#7B181E] hover:bg-[#601217] disabled:opacity-40 shrink-0 transition-colors cursor-pointer shadow-sm border-none"
                >
                    <Send size={14} />
                </button>
                </div>

            </div>
            )}

            {/* FLOATING BUTTON */}
            <button
            onClick={() => setShowChat(!showChat)}
            className="bg-[#7B181E] text-white p-4 rounded-2xl shadow-2xl hover:bg-[#5a1216] transition-all active:scale-90 group relative cursor-pointer block border-none"
            title="Toggle Support Agent"
            >
            <Bot size={28} className="group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></span>
            </button>

        </div>
        </div>
    );
};

export default DashboardPage;
