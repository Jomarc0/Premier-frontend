import { useEffect, useState, useRef } from 'react';
import API from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { toast } from 'react-toastify';
import {
  FiZap, FiCreditCard, FiClock,
  FiPlusCircle, FiMinusCircle, FiMessageCircle, FiSend, FiX,
} from 'react-icons/fi';



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

    useEffect(() => { fetchData(); }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

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

    // Transaction card 
    const TransactionItem = ({ tx }) => {
        const isCredit = tx.type === 'TOPUP';
        return (
        <article className={`grid grid-cols-[2rem_1fr] gap-3 px-3.5 py-3.5 rounded-lg bg-[#fffefe] shadow-[0_8px_20px_rgba(35,31,34,0.06)] mb-3 border-l-[5px] ${isCredit ? 'border-[#25824b]' : 'border-[#8f151d]'}`}>
            <div className={`grid place-items-center self-center text-[1.35rem] ${isCredit ? 'text-[#25824b]' : 'text-[#8f151d]'}`}>
            {isCredit ? <FiPlusCircle /> : <FiMinusCircle />}
            </div>
            <div>
            <time className="text-[#8f151d] text-xs font-black block">{formatDate(tx.createdAt)}</time>
            <h4 className="text-[0.95rem] font-extrabold my-0.5">{tx.type === 'TOPUP' ? 'Top-Up' : 'Fare Payment'}</h4>
            <p className={`text-[0.88rem] font-extrabold m-0 ${isCredit ? 'text-[#25824b]' : 'text-[#8f151d]'}`}>
                {isCredit ? `Amount Added: ₱${tx.amount}` : `Fare Deducted: ₱${tx.amount}`}
            </p>
            <span
                className="inline-flex items-center min-h-[1.45rem] mt-2 px-3 rounded-full text-white text-xs font-black"
                style={{ background: tx.status === 'SUCCESS' ? '#236531' : '#f59e0b' }}
            >
                {tx.status === 'SUCCESS' ? 'Completed' : tx.status}
            </span>
            </div>
        </article>
        );
    };

    return (
        <div className="min-h-screen bg-[#f3f4f7] font-[Inter,sans-serif]">
        <Navbar />

        {/*Hero */}
        <div className="min-h-56 px-4 pt-12 pb-22 bg-[#8f151d] text-white text-center">
            <h1 className="m-0 text-[clamp(1.7rem,4vw,2.35rem)] font-black">
            WELCOME BACK, {passenger?.name?.toUpperCase() || 'PASSENGER'}!
            </h1>
            <p className="mt-2 mb-0 text-[#f4c84d] italic font-extrabold">
            Ride smarter with Premier Transit — top up and track fares in one place.
            </p>
            <p className="text-white/88 text-sm uppercase mt-1">
            Card No: {balance?.cardNumber || '—'}
            </p>
            <p className="text-white/88 text-sm">
            User ID: {balance?.userId || passenger?.name || '—'}
            </p>
        </div>

        {/* Main content*/}
        <div className="w-[min(960px,calc(100%-2rem))] mx-auto mt-[3.2rem] mb-16">

            {/* Balance Card */}
            <div className="flex items-center justify-between gap-4 w-[min(470px,100%)] min-h-24 mx-auto mb-6 px-5 py-5 rounded-lg border-b-[5px] border-[#f4c84d] bg-white shadow-[0_18px_42px_rgba(44,36,41,0.14)]">
            <div>
                <p className="m-0 mb-1 text-[#747986] text-xs font-black uppercase tracking-wide">
                Available Balance
                </p>
                <strong className="text-[#8f151d] text-[clamp(1.7rem,4vw,2rem)] font-black">
                ₱{parseFloat(balance?.balance || 0).toFixed(2)}
                </strong>
            </div>
            <button
                onClick={() => window.scrollTo({ top: 400, behavior: 'smooth' })}
                className="inline-flex items-center gap-1.5 min-h-[2.35rem] px-3.5 rounded-lg bg-[#236531] text-white text-xs font-black uppercase hover:bg-[#1b4e26] transition-colors cursor-pointer whitespace-nowrap"
            >
                <FiZap />
                Quick Top Up
            </button>
            </div>

            {/* Section heading */}
            <div className="flex justify-center items-center gap-2.5 my-5 text-[#8f151d]">
            <FiZap className="text-[1.3rem]" />
            <h2 className="m-0 text-[clamp(1.35rem,3vw,1.7rem)] font-black">Recharge &amp; History</h2>
            </div>

            {/* Dashboard grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.95fr)] gap-5 items-start">

            {/* Recharge Card */}
            <section className="bg-white rounded-lg p-6 shadow-[0_18px_42px_rgba(44,36,41,0.14)]">

                {/* Title row */}
                <div className="flex items-center gap-3 mb-4">
                <span className="grid place-items-center w-[2.35rem] h-[2.35rem] rounded-lg bg-[#fae7e9] text-[#8f151d]">
                    <FiCreditCard />
                </span>
                <h3 className="m-0 text-[#8f151d] text-lg font-extrabold">Recharge Your Card</h3>
                </div>

                {/* Info summary */}
                <div className="rounded-lg px-3 py-3 mb-4 bg-[#f3f4f7]">
                {[
                    ['Card Number', balance?.cardNumber || '—'],
                    ['User ID', balance?.userId || passenger?.name || '—'],
                ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm mb-1">
                    <span className="text-[#717680]">{label}</span>
                    <strong className="text-[#392d33]">{val}</strong>
                    </div>
                ))}
                <div className="flex justify-between text-sm">
                    <span className="text-[#717680]">Balance</span>
                    <strong className="text-[#236531]">₱{parseFloat(balance?.balance || 0).toFixed(2)}</strong>
                </div>
                </div>

                {/* Amount label */}
                <label className="block mb-3 text-[#434854] text-[0.95rem] font-extrabold">
                Select or Enter Amount
                </label>

                {/* Preset amounts */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                {QUICK_AMOUNTS.map(amt => (
                    <button
                    key={amt}
                    onClick={() => { setSelectedAmount(amt); setCustomAmount(''); }}
                    className={`py-3 rounded-lg font-bold text-sm border-2 cursor-pointer transition-colors ${
                        selectedAmount === amt
                        ? 'border-[#8f151d] bg-[#fae7e9] text-[#8f151d]'
                        : 'border-[#e6e8ee] bg-white text-[#392d33] hover:border-[#8f151d]'
                    }`}
                    >
                    ₱{amt}
                    </button>
                ))}
                </div>

                {/* Custom amount */}
                <input
                type="number"
                placeholder="Custom amount (min ₱20.00)"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                className="w-full px-4 py-3 rounded-lg border-2 border-[#e6e8ee] text-sm outline-none mb-4 focus:border-[#8f151d] transition-colors"
                />

                {/* Payment method label */}
                <label className="block mb-3 text-[#434854] text-[0.95rem] font-extrabold">
                Select E-Wallet/Payment Method
                </label>

                {/* Payment methods */}
                <div className="flex gap-3 mb-5">
                {PAYMENT_METHODS.map(pm => (
                    <button
                    key={pm}
                    onClick={() => setSelectedPayment(pm)}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm text-white cursor-pointer transition-all ${
                        pm === 'Gcash'
                        ? selectedPayment === pm ? 'bg-[#1e3a5f]' : 'bg-[#2563eb] hover:bg-[#1d4ed8]'
                        : selectedPayment === pm ? 'bg-[#14532d]' : 'bg-[#236531] hover:bg-[#1b4e26]'
                    } ${selectedPayment && selectedPayment !== pm ? 'opacity-50' : 'opacity-100'}`}
                    >
                    {pm}
                    </button>
                ))}
                </div>

                {/* Proceed button */}
                <button
                onClick={handleTopUp}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[3.2rem] rounded-lg bg-[#8f151d] text-white font-extrabold hover:bg-[#761016] hover:shadow-[0_10px_20px_rgba(143,21,29,0.25)] hover:-translate-y-px transition-all cursor-pointer"
                >
                <FiCreditCard />
                Proceed to Payment
                </button>

                {/* Pending payment banner */}
                {pendingPayment && (
                <div className="mt-4 p-5 rounded-lg text-center bg-[#fffbea] border-2 border-[#f0d060]">
                    <p className="font-bold text-sm mb-2 text-[#92400e]">⏳ Payment Pending</p>
                    <p className="text-xs mb-3 text-[#92400e]">
                    Ref: {pendingPayment.referenceNumber} | Amount: ₱{pendingPayment.amount}
                    </p>
                    <button
                    onClick={handleCheckPayment}
                    disabled={verifying}
                    className={`w-full py-3 rounded-lg text-white font-bold text-sm mb-2 transition-colors ${
                        verifying ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#236531] hover:bg-[#1b4e26] cursor-pointer'
                    }`}
                    >
                    {verifying ? 'Checking...' : 'I Already Paid — Check Now'}
                    </button>
                    <button
                    onClick={() => setPendingPayment(null)}
                    className="text-xs underline cursor-pointer text-[#92400e] bg-transparent hover:text-[#92400e]/80 transition-colors"
                    >
                    Cancel this payment
                    </button>
                </div>
                )}
            </section>

            {/* Recent Transactions */}
            <section className="bg-white rounded-lg p-6 shadow-[0_18px_42px_rgba(44,36,41,0.14)]">
                <div className="flex items-center gap-3 mb-4">
                <span className="grid place-items-center w-[2.35rem] h-[2.35rem] rounded-lg bg-[#fae7e9] text-[#8f151d]">
                    <FiClock />
                </span>
                <h3 className="m-0 text-[#8f151d] text-lg font-extrabold">Recent Transactions</h3>
                </div>

                {loading ? (
                <p className="text-center py-5 text-[#717680] text-sm">Loading...</p>
                ) : transactions.length === 0 ? (
                <p className="text-center py-5 text-[#717680] text-sm">No transactions yet.</p>
                ) : (
                transactions.map(tx => <TransactionItem key={tx.id} tx={tx} />)
                )}

                <button
                onClick={fetchAllTransactions}
                className="w-full text-center mt-3 font-extrabold text-sm text-[#8f151d] bg-transparent cursor-pointer hover:text-[#761016] transition-colors"
                >
                See All Transactions →
                </button>
            </section>
            </div>
        </div>

        {/*Transaction History Modal*/}
        {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-lg w-full max-w-125 max-h-[80vh] overflow-hidden flex flex-col shadow-[0_18px_42px_rgba(44,36,41,0.14)]">
                <div className="flex items-center justify-between px-5 py-4 bg-[#8f151d]">
                <span className="text-white font-bold text-base">🕐 Full Transaction History</span>
                <button
                    onClick={() => setShowModal(false)}
                    className="w-7 h-7 rounded grid place-items-center font-bold text-white bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
                >
                    <FiX />
                </button>
                </div>
                <div className="overflow-y-auto p-4 max-h-[70vh]">
                {allTransactions.map(tx => <TransactionItem key={tx.id} tx={tx} />)}
                </div>
            </div>
            </div>
        )}

        {/* Floating chat button  */}
        <button
            onClick={() => setShowChat(!showChat)}
            className="fixed right-[1.45rem] bottom-[1.45rem] z-15 grid place-items-center w-[3.2rem] h-[3.2rem] rounded-full bg-[#8f151d] text-white text-[1.35rem] shadow-[0_14px_28px_rgba(96,18,24,0.28)] hover:bg-[#761016] transition-colors cursor-pointer"
            aria-label="Open help chat"
        >
            <FiMessageCircle />
        </button>

        {/* Chatbot window */}
        {showChat && (
            <div className="fixed bottom-24 right-[1.45rem] w-80 bg-white rounded-lg z-50 overflow-hidden shadow-[0_18px_42px_rgba(44,36,41,0.14)] border border-[#e6e8ee]">

            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#8f151d]">
                <span className="text-white font-bold text-sm">🤖 Premier Support</span>
                <button
                onClick={() => setShowChat(false)}
                className="text-white text-sm bg-transparent cursor-pointer hover:text-white/70 transition-colors"
                >
                Clear
                </button>
            </div>

            {/* Messages */}
            <div className="px-3 py-3 max-h-72 overflow-y-auto bg-[#f3f4f7]">
                {chatMessages.map((msg, i) => (
                <div
                    key={i}
                    className={`mb-3 flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    <span className={`inline-block px-3 py-2 rounded-lg text-xs max-w-xs text-left leading-relaxed ${
                    msg.from === 'user'
                        ? 'bg-[#8f151d] text-white'
                        : 'bg-white text-[#392d33] border border-[#e6e8ee]'
                    }`}>
                    {msg.text}
                    </span>
                </div>
                ))}

                {/* Quick replies */}
                <div className="flex flex-wrap gap-2 mt-2">
                {['Top-up issue', 'Fare deduction', 'Payment failed'].map(q => (
                    <button
                    key={q}
                    onClick={() => handleChatSend(q)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-[#8f151d] bg-white text-[#8f151d] hover:bg-[#8f151d] hover:text-white transition-colors cursor-pointer"
                    >
                    {q}
                    </button>
                ))}
                </div>
                <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex gap-2 px-3 py-2.5 border-t border-[#e6e8ee]">
                <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleChatSend(); }}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 rounded-full text-xs border border-[#e6e8ee] outline-none focus:border-[#8f151d] transition-colors"
                />
                <button
                onClick={() => handleChatSend()}
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm text-white bg-[#8f151d] hover:bg-[#761016] shrink-0 transition-colors cursor-pointer"
                >
                <FiSend />
                </button>
            </div>
            </div>
        )}
        </div>
    );
    };

export default DashboardPage;