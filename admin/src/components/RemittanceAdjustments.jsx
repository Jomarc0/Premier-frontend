import { useEffect, useRef, useState } from 'react';
import { FiClock, FiShield } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import ConfirmModal from './ConfirmModal';
import { useAdminAuth } from '../context/AdminAuthState';
import { formatDateTime } from '../lib/time';

const peso = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value || 0));
const cents = (value) => Math.round(Number(value || 0) * 100);

export default function RemittanceAdjustments({ summary, onUpdated }) {
  const { admin, isSuperAdmin } = useAdminAuth();
  const key = `premier:remittance-pending:${admin?.id}:${summary.staffId}:${summary.date}`;
  const [pending, setPending] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
      return saved && !saved.phase ? { ...saved, phase: 'submitted' } : saved;
    }
    catch { return { invalid: true }; }
  });
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState([]);
  const [historyReadyKey, setHistoryReadyKey] = useState('');
  const [historyErrorState, setHistoryErrorState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const inFlightRef = useRef(false);

  const historyIdentity = `${summary.staffId}:${summary.date}:${summary.adjustmentsTotal}`;
  const historyReady = historyReadyKey === historyIdentity;
  const historyError = historyErrorState?.identity === historyIdentity ? historyErrorState.message : '';
  useEffect(() => {
    let current = true;
    adminAPI.get(`/staff-cash/collections/${summary.staffId}/adjustments`, { params: { date: summary.date } })
      .then(response => { if (current) { setHistory(response.data?.data || []); setHistoryReadyKey(historyIdentity); } })
      .catch(() => { if (current) setHistoryErrorState({ identity: historyIdentity, message: 'Correction history is unavailable. Refresh before submitting a correction.' }); });
    return () => { current = false; };
  }, [summary.staffId, summary.date, summary.adjustmentsTotal, historyIdentity]);

  function reviewCorrection(event) {
    event.preventDefault();
    if (busy || pending?.invalid || (!pending && !historyReady)) return;
    let intent = pending;
    if (!intent) {
      if (!/^-?\d{1,8}(?:\.\d{1,2})?$/.test(amount.trim()) || Number(amount) === 0 || reason.trim().length < 10 || reason.trim().length > 240) {
        setError('Enter a nonzero signed amount with at most two decimal places and a reason of 10–240 characters.');
        return;
      }
      intent = { date: summary.date, amount: amount.trim(), reason: reason.trim(), requestId: crypto.randomUUID(), phase: 'prepared' };
      try { sessionStorage.setItem(key, JSON.stringify(intent)); }
      catch { setError('Unable to preserve this correction for safe retry. Do not submit from this browser.'); return; }
      setPending(intent);
    }
    setError('');
    setConfirming(true);
  }

  function dismissConfirmation() {
    if (busy) return;
    if (pending?.phase === 'prepared') {
      sessionStorage.removeItem(key);
      setPending(null);
    }
    setConfirming(false);
    setError('');
  }

  async function recordCorrection() {
    if (!pending || pending.invalid || inFlightRef.current) return;
    inFlightRef.current = true;
    const intent = { ...pending, phase: 'submitted' };
    try { sessionStorage.setItem(key, JSON.stringify(intent)); }
    catch { setError('Unable to preserve this correction for safe retry. Do not submit from this browser.'); inFlightRef.current = false; return; }
    setPending(intent);
    setBusy(true);
    setError('');
    try {
      const response = await adminAPI.post(`/staff-cash/collections/${summary.staffId}/adjustments`, intent, { timeout: 20000 });
      if (!response.data?.data?.summary) throw new Error('Correction response missing. Retry this same correction to reconcile its status.');
      sessionStorage.removeItem(key);
      setPending(null);
      setAmount('');
      setReason('');
      setConfirming(false);
      toast.success('Audited correction recorded. The original confirmation remains unchanged.');
      onUpdated(response.data.data);
    } catch (failure) {
      const status = failure.response?.status;
      if (status >= 400 && status < 500 && ![408, 429].includes(status)) {
        sessionStorage.removeItem(key);
        setPending(null);
      }
      setError(failure.response?.data?.message || failure.message || 'Outcome unknown. Retry this same correction to reconcile it; do not create another request.');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  const submittedAmount = pending?.amount ?? amount;
  const submittedReason = pending?.reason ?? reason;
  const adjustmentCents = cents(submittedAmount);
  const effectiveCents = cents(summary.actualCashReceived);
  const proposedEffectiveCents = effectiveCents + adjustmentCents;
  const orderedHistory = [...history].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return <section aria-labelledby="remittance-audit-title" className="space-y-4">
    <div><h3 id="remittance-audit-title" className="m-0 text-base font-black text-maroon">Immutable Remittance History</h3><p className="m-0 mt-1 text-sm text-text-muted">The original confirmation remains unchanged. Signed corrections are appended to its audit trail.</p></div>

    <div className="space-y-3">
      <h4 className="m-0 inline-flex items-center gap-2 text-sm font-extrabold text-text-main"><FiShield aria-hidden="true" /> Original confirmation</h4>
      <div className="rounded-lg border border-border-soft bg-page-bg/60 p-3 text-sm">
        <p className="m-0 font-semibold text-text-main">Expected at confirmation: <strong>{peso(summary.confirmedExpectedCash)}</strong></p>
        <p className="m-0 mt-1 text-text-muted">Confirmed {summary.confirmedAt ? formatDateTime(summary.confirmedAt) : 'at an unavailable time'}. The original administrator identity is not included in this response.</p>
      </div>
    </div>

    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><h4 className="m-0 inline-flex items-center gap-2 text-sm font-extrabold text-text-main"><FiClock aria-hidden="true" /> Chronological correction history</h4><span className="text-xs text-text-muted">{orderedHistory.length} events</span></div>
      {historyError && <p role="alert" className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{historyError}</p>}
      {!historyError && orderedHistory.length === 0 && <p className="m-0 rounded-lg border border-dashed border-border-soft p-3 text-sm text-text-muted">No audited corrections have been recorded.</p>}
      {orderedHistory.length > 0 && <ol className="divide-y divide-border-soft rounded-lg border border-border-soft">
        {orderedHistory.map(row => <li key={row.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(10rem,0.9fr)_minmax(0,2fr)_auto] sm:items-start">
          <div><p className="m-0 text-xs font-bold text-text-main">{row.createdAt ? formatDateTime(row.createdAt) : 'Time unavailable'}</p><p className="m-0 mt-1 text-xs text-text-muted">Audited correction · Admin {row.authorizedBy ?? 'unavailable'}</p></div>
          <div className="min-w-0"><p className="m-0 break-words text-sm text-text-main">{row.reason}</p><p className="m-0 mt-1 break-all font-mono text-[0.68rem] text-text-muted">Support reference: {row.requestId}</p></div>
          <strong className={`whitespace-nowrap text-sm tabular-nums ${Number(row.amount) < 0 ? 'text-danger-muted' : 'text-green-brand'}`}>{Number(row.amount) > 0 ? '+' : '−'}{peso(Math.abs(Number(row.amount)))}</strong>
        </li>)}
      </ol>}
    </div>

    {isSuperAdmin() ? <form onSubmit={reviewCorrection} className="space-y-3 rounded-lg border border-border-soft bg-page-bg/50 p-4">
      <div><h4 className="m-0 text-sm font-black text-maroon">Record a signed correction</h4><p className="m-0 mt-1 text-xs leading-5 text-text-muted">A correction changes effective cash only. It does not edit the original confirmation or any fare transaction.</p></div>
      {pending && <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{pending.invalid ? 'A saved correction cannot be read. Review the audit history before using another session.' : pending.phase === 'prepared' ? `Unsubmitted correction: ${peso(pending.amount)}. It can still be canceled.` : `Unresolved correction: ${peso(pending.amount)}; reference ${pending.requestId}. Retry uses this same request.`}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-text-muted">Signed correction amount
          <span className="relative mt-1 block"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">₱</span><input type="text" inputMode="decimal" value={pending?.amount ?? amount} onChange={event => { setAmount(event.target.value); setError(''); }} disabled={!!pending || busy} required aria-label="Signed correction amount" placeholder="e.g. -25.00" className="min-h-11 w-full rounded-lg border border-border-soft bg-white pl-8 pr-3 text-right text-sm font-semibold tabular-nums text-text-main outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/15 disabled:bg-page-bg" /></span>
        </label>
        <label className="block text-xs font-bold text-text-muted">Reason / support reference
          <textarea value={pending?.reason ?? reason} onChange={event => { setReason(event.target.value); setError(''); }} disabled={!!pending || busy} required minLength={10} maxLength={240} rows={2} className="mt-1 block min-h-11 w-full resize-y rounded-lg border border-border-soft bg-white px-3 py-2 text-sm font-medium text-text-main outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/15 disabled:bg-page-bg" />
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {pending && !pending.invalid ? <p className="m-0 text-xs text-text-muted">Current effective cash: {peso(summary.actualCashReceived)}. Proposed effective cash: {peso(proposedEffectiveCents / 100)}.</p> : <span />}
        <button type="submit" disabled={busy || pending?.invalid || (!pending && !historyReady)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-maroon px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-maroon-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon disabled:cursor-not-allowed disabled:opacity-50">{pending?.phase === 'submitted' ? 'Review saved correction' : 'Record Audited Correction'}</button>
      </div>
      {error && !confirming && <p role="alert" className="m-0 text-sm font-semibold text-danger-muted">{error}</p>}
    </form> : <p className="m-0 rounded-lg border border-border-soft bg-page-bg/60 p-3 text-sm text-text-muted">Audited corrections require current Super Admin authorization.</p>}

    <ConfirmModal
      isOpen={confirming}
      onClose={dismissConfirmation}
      onConfirm={recordCorrection}
      title="Record Audited Correction?"
      message="This appends an immutable signed correction to the remittance audit history. It does not change the original confirmation or transaction records."
      details={<div className="mt-4 space-y-2 rounded-lg border border-border-soft bg-page-bg p-4 text-sm"><p className="m-0"><span className="font-semibold text-text-muted">Correction amount: </span><strong>{Number(submittedAmount) > 0 ? '+' : '−'}{peso(Math.abs(Number(submittedAmount || 0)))}</strong></p><p className="m-0"><span className="font-semibold text-text-muted">Effective cash after correction: </span><strong>{peso(proposedEffectiveCents / 100)}</strong></p><p className="m-0 break-words"><span className="font-semibold text-text-muted">Reason: </span>{submittedReason}</p>{pending?.requestId && <p className="m-0 break-all font-mono text-xs text-text-muted">Request reference: {pending.requestId}</p>}</div>}
      warning="Review the signed amount and reason. Recording requires Super Admin authorization and cannot be removed from the audit history."
      error={error}
      confirmText="Record Audited Correction"
      cancelText="Cancel"
      loadingText="Recording correction..."
      loading={busy}
      confirmDisabled={!pending || pending.invalid || !isSuperAdmin()}
      variant="primary"
      ariaLabelledBy="confirm-remittance-adjustment-title"
      ariaDescribedBy="confirm-remittance-adjustment-description"
    />
  </section>;
}
