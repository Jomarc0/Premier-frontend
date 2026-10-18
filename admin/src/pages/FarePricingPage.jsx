import { useEffect, useState } from 'react';
import { FiInfo, FiRefreshCw, FiSave } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';

const peso = (amount) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
}).format(Number(amount || 0));

const inputShell = 'flex min-h-16 overflow-hidden rounded-xl border border-border-soft bg-white transition focus-within:border-maroon focus-within:ring-4 focus-within:ring-maroon/10';
const inputBase = 'min-w-0 flex-1 bg-transparent px-4 text-base font-bold text-[#303b49] outline-none';

function FareField({ label, description, value, onChange, name }) {
  return (
    <label className="block rounded-xl border border-border-soft bg-white p-5 max-[560px]:p-4">
      <span className="mb-3 block text-sm font-bold text-[#303b49]">{label}</span>
      <span className={inputShell}>
        <span className="grid w-14 shrink-0 place-items-center border-r border-border-soft bg-page-bg text-xl font-bold text-text-muted" aria-hidden="true">₱</span>
        <input
          aria-label={label}
          className={inputBase}
          name={name}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      <span className="mt-3 block text-sm text-text-muted">{description}</span>
    </label>
  );
}

export default function FarePricingPage() {
  const [config, setConfig] = useState(null);
  const [regular, setRegular] = useState('');
  const [discounted, setDiscounted] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await adminAPI.get('/fares');
      const row = data?.data;
      if (!row || row.regularFare == null || row.discountedFare == null || row.version == null) {
        throw new Error('The fare configuration response is incomplete.');
      }
      setConfig(row);
      setRegular(String(row.regularFare));
      setDiscounted(String(row.discountedFare));
    } catch (error) {
      setConfig(null);
      setLoadError(error.response?.data?.message || error.message || 'Unable to load active fares.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const errors = [];
  for (const [label, value] of [['Regular fare', regular], ['Discounted fare', discounted]]) {
    if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) < 0 || Number(value) > 100000) {
      errors.push(`${label} must be PHP 0.00–100,000.00 (up to 2 decimals).`);
    }
  }
  if (!errors.length && Number(discounted) >= Number(regular)) {
    errors.push('Discounted fare must be less than regular fare.');
  }

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await adminAPI.put('/fares', {
        regularFare: Number(regular).toFixed(2),
        discountedFare: Number(discounted).toFixed(2),
        version: config.version,
      });
      setConfig(data.data);
      setRegular(String(data.data.regularFare));
      setDiscounted(String(data.data.discountedFare));
      setConfirm(false);
      toast.success('Fare configuration updated. Devices will sync when connected.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update fares');
      if (error.response?.status === 409) load();
    } finally {
      setSaving(false);
    }
  };

  const changed = config && (String(config.regularFare) !== regular || String(config.discountedFare) !== discounted);

  return (
    <div className={ui.layout}>
      <AdminSidebar />
      <main className={ui.workspace}>
        <header className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-border-soft bg-white px-6 py-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:px-4 max-[560px]:py-4">
          <div>
            <h1 className="m-0 text-[clamp(1.5rem,2.5vw,1.75rem)] font-extrabold leading-tight text-[#202b3a]">Fare Pricing Management</h1>
            <p className="mt-1 text-sm text-text-muted">Manage the active system fares.</p>
          </div>
        </header>

        {loading ? (
          <section className="rounded-xl border border-border-soft bg-white p-7 text-text-muted" role="status">
            Loading active fare configuration…
          </section>
        ) : !config ? (
          <section role="alert" className="rounded-xl border border-border-soft bg-white p-7">
            <h2 className="text-xl font-bold text-maroon">Couldn’t load fare configuration</h2>
            <p className="my-3 text-sm text-slate-600">{loadError || 'The fare service is temporarily unavailable. No changes have been made.'}</p>
            <button type="button" onClick={load} className="rounded-lg bg-maroon px-5 py-3 font-bold text-white transition hover:bg-maroon-dark">Retry</button>
          </section>
        ) : (
          <section className="rounded-xl border border-border-soft bg-white p-5 shadow-[0_2px_8px_rgba(31,42,55,0.04)] max-[560px]:p-4">
            <div className="mb-6">
              <h2 className="text-base font-bold text-[#202b3a]">Current Fare Configuration</h2>
              <p className="mt-1 text-sm text-text-muted">Set the fixed fare charged per passenger.</p>
            </div>

            <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
              <FareField
                label="Regular Fare"
                description="Standard passenger fare."
                name="regularFare"
                value={regular}
                onChange={setRegular}
              />
              <FareField
                label="Discounted Fare"
                description="Verified student, senior, and PWD passengers."
                name="discountedFare"
                value={discounted}
                onChange={setDiscounted}
              />
            </div>

            <div className="my-6 flex gap-4 rounded-xl border border-gold/30 bg-gold/10 p-5 text-text-muted max-[560px]:gap-3 max-[560px]:p-4">
              <FiInfo aria-hidden="true" className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-gold p-1.5 text-maroon" />
              <div className="space-y-1 text-sm leading-6">
                <p className="font-bold text-maroon">Current active fares: {peso(config.regularFare)} regular <span className="px-1">•</span> {peso(config.discountedFare)} discounted</p>
                <p>Last updated {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : '—'}</p>
                <p>Discounted fares follow verified passenger eligibility.</p>
              </div>
            </div>

            {errors.map((error) => <p role="alert" className="mb-2 text-sm font-medium text-red-700" key={error}>{error}</p>)}

            <div className="flex flex-wrap gap-3">
              <button
                disabled={!!errors.length || saving || !changed}
                onClick={() => setConfirm(true)}
                className="inline-flex min-h-14 items-center gap-3 rounded-xl bg-maroon px-7 font-bold text-white shadow-sm transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FiSave aria-hidden="true" className="shrink-0 text-sm" /> Save Changes
              </button>
              <button
                type="button"
                onClick={() => { setRegular(String(config.regularFare)); setDiscounted(String(config.discountedFare)); }}
                disabled={!changed || saving}
                className="inline-flex min-h-14 items-center gap-3 rounded-xl border border-maroon bg-white px-6 font-bold text-maroon transition hover:bg-maroon/5 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FiRefreshCw aria-hidden="true" className="shrink-0 text-sm" /> Reset
              </button>
            </div>

            {confirm && (
              <div role="dialog" aria-modal="true" aria-labelledby="fare-confirm-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                  <h2 id="fare-confirm-title" className="text-xl font-bold text-maroon">Apply new fares?</h2>
                  <p className="my-4 text-slate-600">Regular {peso(regular)} · Discounted {peso(discounted)}. New transactions use these fares after the configuration is saved.</p>
                  <div className="flex justify-end gap-3">
                    <button disabled={saving} onClick={() => setConfirm(false)} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Cancel</button>
                    <button disabled={saving} onClick={save} className="rounded-lg bg-maroon px-4 py-2 font-bold text-white transition hover:bg-maroon-dark disabled:opacity-60">{saving ? 'Saving…' : 'Confirm and apply'}</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
