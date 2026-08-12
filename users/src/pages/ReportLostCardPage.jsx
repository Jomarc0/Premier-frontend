import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import API from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import { captureEvent } from '../lib/posthog';

const ReportLostCardPage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [email, setEmail] = useState('');

  const reportLostCard = async () => {
    setSubmitting(true);
    try {
      const response = await API.post('/card/report-lost', { email });
      const ticket = response.data.data;
      setTicketNumber(ticket.ticketNumber);
      captureEvent('passenger_web_lost_card_reported');
      toast.success('Your card is frozen.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to report the lost card. Please call support.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f8] pb-16 font-sans text-slate-800 selection:bg-[#7A2F3D] selection:text-white">
      <Navbar />
      <header className="pt-20 md:pt-22">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <section className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#923449] via-[#7A2F3D] to-[#5c1e2b] px-5 py-6 text-white shadow-[0_14px_32px_rgba(83,27,40,0.2)] md:px-6">
            <div aria-hidden="true" className="absolute -right-4 -top-14 text-[12rem] font-black italic leading-none text-white/[0.06]">P</div>
            <div className="relative flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/12 text-[#ffc633]"><ShieldAlert size={24} /></span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/70">Card security</p>
                <h1 className="mt-1 text-xl font-black tracking-tight md:text-2xl">Report a lost RFID card</h1>
                <p className="mt-1 text-xs font-medium text-white/75">Secure your account and start a replacement request.</p>
              </div>
            </div>
          </section>
        </div>
      </header>

      <main className="mx-auto mt-5 grid max-w-7xl gap-5 px-4 md:mt-6 md:grid-cols-[minmax(0,1fr)_300px] md:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:p-6">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-slate-900"><ShieldAlert size={18} className="text-[#7A2F3D]" /> Freeze lost card</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use this only if your physical RFID card is lost or stolen.</p>
          </div>
          <div className="space-y-5">
            {ticketNumber ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                  <p className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={18} /> Your RFID card is now frozen.</p>
                  <p className="mt-2 text-xs leading-5">Your high-priority replacement request is <span className="font-mono font-black">{ticketNumber}</span>.</p>
                </div>
                <p className="text-sm leading-6 text-slate-600">We will send status updates and the final resolution to your email. Please visit the Premier Transport office with a valid ID to verify ownership and receive a replacement card.</p>
                <button type="button" onClick={() => navigate('/dashboard')} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#7A2F3D] px-4 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-[#642633]">Return to dashboard</button>
              </div>
            ) : (
              <>
                <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={20} />
                  <p className="m-0"><strong className="font-black">Important:</strong> submitting this report immediately stops this RFID card from being used for fares. This cannot be undone here.</p>
                </div>
                <p className="text-sm leading-6 text-slate-600">Your identity has already been verified with Google Authenticator. Enter an email address for updates when the issue is resolved or your replacement is ready.</p>
                <label className="block text-left text-[10px] font-black uppercase tracking-widest text-slate-400" htmlFor="lost-card-email">
                  Email for support updates
                  <span className="relative mt-2 block">
                    <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input id="lost-card-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none transition focus:border-[#7A2F3D] focus:bg-white focus:ring-2 focus:ring-[#7A2F3D]/20" />
                  </span>
                </label>
                <button type="button" disabled={submitting || !email.trim()} onClick={reportLostCard} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#7A2F3D] px-4 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-[#642633] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
                  {submitting ? 'Freezing card...' : 'Confirm and freeze my card'}
                </button>
                <button type="button" disabled={submitting} onClick={() => navigate('/dashboard')} className="inline-flex w-full items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:text-[#7A2F3D]">
                  <ArrowLeft size={16} /> Cancel
                </button>
              </>
            )}
          </div>
        </section>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-slate-900"><ShieldCheck size={17} className="text-[#7A2F3D]" /> What happens next</h2>
          <ol className="mt-4 space-y-4 border-l border-slate-200 pl-4 text-xs leading-5 text-slate-600">
            <li><strong className="block text-slate-900">1. Card is frozen</strong>Your RFID card can no longer be used for fares.</li>
            <li><strong className="block text-slate-900">2. Request is created</strong>Support receives a high-priority replacement request.</li>
            <li><strong className="block text-slate-900">3. Identity is checked</strong>Bring a valid ID to the Premier Transport office to receive a replacement.</li>
          </ol>
        </aside>
      </main>
    </div>
  );
};

export default ReportLostCardPage;
