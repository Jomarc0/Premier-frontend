import { useEffect, useRef, useState } from 'react';
import adminAPI from '../api/adminAxios';
import { useAdminAuth } from '../context/AdminAuthState';

export default function PassengerMfaRecovery({ ticket }) {
  const { isSuperAdmin } = useAdminAuth();
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!result) return undefined;
    const timer = setTimeout(() => setResult(null), Math.max(0, Date.parse(result.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [result]);
  if (!isSuperAdmin()) return null;
  async function authorize(event) {
    event.preventDefault();
    if (busy || !verified || reason.trim().length < 10) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await adminAPI.post(`/support-tickets/${ticket.id}/authorize-mfa-recovery`, {
        identityVerified: true, reason: reason.trim(),
      }, { timeout: 20000 });
      const data = response.data?.data;
      if (!data?.recoveryToken || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error('Missing recovery authorization.');
      if (mounted.current) { setResult(data); setVerified(false); setReason(''); }
    } catch (failure) {
      if (mounted.current) setError(failure.response?.data?.message || 'The authorization response was not received. Check ticket history before creating a new verified recovery ticket.');
    } finally { if (mounted.current) setBusy(false); }
  }
  return <section className="rounded-lg border border-maroon/30 p-3 ph-no-capture">
    <h3 className="font-bold">Passenger authenticator recovery</h3>
    <p className="my-2 text-sm">Verify this passenger using the organization’s approved identification procedure. A card number alone is never sufficient. Authorization immediately revokes existing sessions and authenticator access.</p>
    <form onSubmit={authorize} className="space-y-3">
      <label className="block text-sm"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} /> I completed the approved identity verification for ticket {ticket.ticketNumber}.</label>
      <label className="block text-sm">Verification reason / reference (do not enter identity-document numbers)
        <textarea value={reason} onChange={event => setReason(event.target.value)} required minLength={10} maxLength={240} className="mt-1 w-full rounded border p-2" />
      </label>
      <button disabled={busy || !verified || reason.trim().length < 10 || !!result} className="rounded bg-maroon p-2 text-white disabled:opacity-50">{busy ? 'Authorizing...' : 'Authorize one-use recovery'}</button>
    </form>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {result && <div className="mt-3 space-y-2">
      <p className="text-sm">Deliver directly to the verified passenger. This authorization is shown only here and expires at {new Date(result.expiresAt).toLocaleTimeString()}.</p>
      <label className="block text-sm">One-use authorization<input readOnly type="password" autoComplete="off" value={result.recoveryToken} className="w-full rounded border p-2 ph-no-capture" onFocus={event => event.target.select()} /></label>
      <button type="button" onClick={() => setResult(null)} className="underline">Hide authorization</button>
    </div>}
  </section>;
}
