import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, Eye, RefreshCw, Ticket, XCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import { getMySupportTicket, getMySupportTickets } from '../api/chatbotApi';
import { captureEvent } from '../lib/posthog';
import { useRealtime } from '../context/RealtimeContext';
import { formatDateTime } from '../lib/time';

const statusStyle = (status) => ({
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800',
  IN_REVIEW: 'border-sky-200 bg-sky-50 text-sky-800',
  RESOLVED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-800',
}[status] || 'border-slate-200 bg-slate-50 text-slate-700');

const statusLabel = (status) => (status || 'PENDING').replaceAll('_', ' ');
const formatDate = (value) => value ? formatDateTime(value) : '-';

const SupportTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { subscribe } = useRealtime();

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMySupportTickets();
      setTickets(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load your support tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => subscribe((event) => {
    if (event.entity === 'SUPPORT_TICKET') loadTickets();
  }), [loadTickets, subscribe]);

  const openTicket = async (ticket) => {
    try {
      const data = await getMySupportTicket(ticket.id);
      setSelected(data);
      captureEvent('passenger_web_support_ticket_opened', { status: data.status, issue_type: data.issueType });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load this ticket. Please refresh and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12 pt-24">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-[#b78a0e]">Passenger support</p>
            <h1 className="m-0 text-3xl font-black text-slate-900">My support tickets</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">View only tickets linked to your signed-in account. Status updates and final resolution notes appear here.</p>
          </div>
          <button type="button" onClick={loadTickets} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#7A2F3D] shadow-sm transition hover:border-[#7A2F3D] disabled:opacity-60">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </header>

        {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="m-0 flex items-center gap-2 text-base font-black text-slate-800"><Ticket size={18} className="text-[#7A2F3D]" /> Submitted requests</h2>
          </div>
          {loading ? <p className="px-5 py-10 text-center text-sm font-semibold text-slate-500">Loading your tickets…</p> : tickets.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Ticket size={28} className="mx-auto mb-3 text-slate-300" />
              <p className="m-0 font-bold text-slate-700">You have no support tickets yet.</p>
              <p className="mt-1 text-sm text-slate-500">Use the Passenger Support Assistant when you need help.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tickets.map((ticket) => (
                <article key={ticket.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="m-0 font-mono text-sm font-black text-[#7A2F3D]">{ticket.ticketNumber}</p>
                    <p className="mt-1 text-sm font-bold text-slate-800">{statusLabel(ticket.issueType)}</p>
                    <p className="mt-1 text-xs text-slate-500">Submitted {formatDate(ticket.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusStyle(ticket.status)}`}>{statusLabel(ticket.status)}</span>
                    <button type="button" onClick={() => openTicket(ticket)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A2F3D] px-3 py-2 text-xs font-black text-white transition hover:bg-[#612431]"><Eye size={14} /> View</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {selected && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between bg-[#7A2F3D] px-5 py-4 text-white">
            <div><p className="m-0 text-xs font-bold uppercase tracking-wider text-white/70">Support ticket</p><h2 id="ticket-detail-title" className="mt-1 font-mono text-base font-black">{selected.ticketNumber}</h2></div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close ticket details" className="rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"><XCircle size={19} /></button>
          </div>
          <div className="space-y-5 p-5 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusStyle(selected.status)}`}>{statusLabel(selected.status)}</span><span className="text-xs text-slate-500">Updated {formatDate(selected.updatedAt)}</span></div>
            <div><p className="mb-1 text-xs font-black uppercase tracking-wide text-slate-500">Request</p><p className="m-0 font-bold">{statusLabel(selected.issueType)}</p><p className="mt-2 whitespace-pre-wrap leading-6">{selected.reason}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-600"><Clock3 size={14} /> Support update</p><p className="m-0 whitespace-pre-wrap leading-6">{selected.adminNotes || 'Your request is waiting for a support-team update.'}</p></div>
            {selected.status === 'RESOLVED' && <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800"><CheckCircle2 size={18} /> This ticket is resolved. A resolution email was sent to your submitted email address.</p>}
          </div>
        </section>
      </div>}
    </div>
  );
};

export default SupportTicketsPage;
