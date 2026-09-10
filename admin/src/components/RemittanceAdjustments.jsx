import { useEffect, useState } from 'react';
import adminAPI from '../api/adminAxios';
import { useAdminAuth } from '../context/AdminAuthState';

export default function RemittanceAdjustments({ summary, onUpdated }) {
  const { admin, isSuperAdmin } = useAdminAuth();
  const key = `premier:remittance-pending:${admin?.id}:${summary.staffId}:${summary.date}`;
  const [pending, setPending] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); }
    catch { return { invalid: true }; }
  });
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    adminAPI.get(`/staff-cash/collections/${summary.staffId}/adjustments`, { params: { date: summary.date } })
      .then(response => { if (current) { setHistory(response.data?.data || []); setHistoryReady(true); } })
      .catch(() => { if (current) setError('Correction history is unavailable. Refresh before submitting a correction.'); });
    return () => { current = false; };
  }, [summary.staffId, summary.date, summary.adjustmentsTotal]);
  async function submit(event) {
    event.preventDefault();
    if (busy || pending?.invalid || (!pending && !historyReady)) return;
    let intent = pending;
    if (!intent) {
      if (!/^-?\d{1,8}(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) === 0 || reason.trim().length < 10) {
        setError('Enter a nonzero signed amount with at most two decimal places and a reason.'); return;
      }
      intent = { date: summary.date, amount: amount.trim(), reason: reason.trim(), requestId: crypto.randomUUID() };
      try { sessionStorage.setItem(key, JSON.stringify(intent)); }
      catch { setError('Unable to preserve this correction for safe retry. Do not submit from this browser.'); return; }
      setPending(intent);
    }
    setBusy(true); setError('');
    try {
      const response = await adminAPI.post(`/staff-cash/collections/${summary.staffId}/adjustments`, intent, { timeout: 20000 });
      if (!response.data?.data?.summary) throw new Error('Correction response missing.');
      sessionStorage.removeItem(key); setPending(null); setAmount(''); setReason('');
      onUpdated(response.data.data);
    } catch (failure) {
      const status = failure.response?.status;
      if (status >= 400 && status < 500 && ![408, 429].includes(status)) {
        sessionStorage.removeItem(key); setPending(null);
      }
      setError(failure.response?.data?.message || 'Outcome unknown. Retry this same correction to reconcile it; do not create another request.');
    } finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t p-5">
    <h3 className="font-bold">Immutable remittance history</h3>
    <p className="text-sm">Expected at confirmation: {summary.confirmedExpectedCash}. Corrections total: {summary.adjustmentsTotal}. Effective cash received: {summary.actualCashReceived}.</p>
    {summary.requiresReconciliation && <p role="alert" className="text-amber-800">Late fares changed the expected cash after confirmation. Reconcile the difference against the original confirmation.</p>}
    <ul className="space-y-2 text-sm">{history.map(row => <li key={row.id}>{row.amount} — {row.reason} (reference {row.requestId})</li>)}</ul>
    {isSuperAdmin() && <form onSubmit={submit} className="space-y-3">
      <p className="text-sm">Record a signed correction after reviewing the history. The original confirmation remains unchanged.</p>
      {pending && <p className="text-sm text-amber-800">{pending.invalid ? 'Saved correction cannot be read. Review the audit history before using another session.' : `Unresolved correction: ${pending.amount}; reference ${pending.requestId}. Retry uses the same request.`}</p>}
      <label className="block text-sm">Signed correction amount<input value={pending?.amount ?? amount} onChange={event => setAmount(event.target.value)} disabled={!!pending || busy} inputMode="decimal" required className="block rounded border p-2" /></label>
      <label className="block text-sm">Reason / support reference<textarea value={pending?.reason ?? reason} onChange={event => setReason(event.target.value)} disabled={!!pending || busy} required minLength={10} maxLength={240} className="block w-full rounded border p-2" /></label>
      <button disabled={busy || pending?.invalid || (!pending && !historyReady)} className="rounded bg-maroon p-2 text-white disabled:opacity-50">{busy ? 'Reconciling...' : pending ? 'Retry original correction' : 'Record audited correction'}</button>
    </form>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}
