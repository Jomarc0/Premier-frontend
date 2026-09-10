import { useState } from 'react';
import adminAPI from '../api/adminAxios';
import { useAdminAuth } from '../context/AdminAuthState';

export default function RecoveryIntake({ onCreated }) {
  const { isSuperAdmin } = useAdminAuth();
  const [form, setForm] = useState({ cardNumber: '', email: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!isSuperAdmin()) return null;
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await adminAPI.post('/support-tickets/recovery-intake', form, { timeout: 20000 });
      if (!response.data?.data?.id) throw new Error('Ticket response missing.');
      setForm({ cardNumber: '', email: '', reason: '' });
      onCreated(response.data.data);
    } catch (failure) {
      setError(failure.response?.data?.message || 'The response was not received. Refresh the ticket list before submitting again.');
    } finally { setBusy(false); }
  }
  return <details className="mb-5 rounded-xl border bg-white p-4 ph-no-capture">
    <summary className="cursor-pointer font-bold">Open an authenticator recovery ticket</summary>
    <p className="my-3 text-sm">For passengers unable to sign in, record the support request here. Creating a ticket does not authorize recovery. Complete the approved identity procedure before using the ticket’s recovery authorization form.</p>
    <form onSubmit={submit} className="grid gap-3">
      <label className="text-sm">Passenger card number<input name="cardNumber" value={form.cardNumber} onChange={update} required maxLength={80} autoComplete="off" className="block w-full rounded border p-2" /></label>
      <label className="text-sm">Contact email<input name="email" type="email" value={form.email} onChange={update} required maxLength={160} autoComplete="off" className="block w-full rounded border p-2" /></label>
      <label className="text-sm">Support reason / external reference<textarea name="reason" value={form.reason} onChange={update} required minLength={10} maxLength={500} className="block w-full rounded border p-2" /></label>
      <p className="text-xs">Do not enter identity-document numbers or copies. This form does not send an email.</p>
      <button disabled={busy} className="rounded bg-maroon p-2 text-white disabled:opacity-50">{busy ? 'Opening...' : 'Open verification ticket'}</button>
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </form>
  </details>;
}
