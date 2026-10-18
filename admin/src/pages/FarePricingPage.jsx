import { useEffect, useState } from 'react';
import { FiInfo, FiRotateCcw, FiSave, FiTag, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';

const peso = (amount) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
}).format(Number(amount || 0));

const inputShell = 'flex min-h-16 overflow-hidden rounded-xl border border-[#d6dfec] bg-white transition focus-within:border-[#8297b8] focus-within:ring-4 focus-within:ring-[#dce6f4]';
const inputBase = 'min-w-0 flex-1 bg-transparent px-4 text-2xl font-bold text-slate-900 outline-none max-[560px]:text-xl';

function FareField({ icon: Icon, label, description, value, onChange, name }) {
  return (
    <label className="block rounded-xl border border-[#d8e1ee] bg-white p-5 max-[560px]:p-4">
      <span className="mb-3 flex items-center gap-4 text-lg font-bold text-[#702034]">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#f7eff1] text-2xl text-[#702034]">
          <Icon aria-hidden="true" />
        </span>
        <span>{label}</span>
      </span>
      <span className={inputShell}>
        <span className="grid w-14 shrink-0 place-items-center border-r border-[#e0e6ef] bg-[#f1f4f8] text-xl font-bold text-slate-500" aria-hidden="true">₱</span>
        <input
          aria-label={label}
          className={inputBase}
          name={name}
          type="number"
          min="0"
          max="100000"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="grid shrink-0 place-items-center px-3 text-xs leading-4 text-slate-400" aria-hidden="true">▴<br />▾</span>
      </span>
      <span className="mt-3 block text-sm text-[#71829f]">{description}</span>
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
        <header className="mb-5 rounded-xl border border-[#d8e1ee] bg-white px-7 py-6 max-[560px]:px-4 max-[560px]:py-5">
          <div className="border-l-[6px] border-[#d9b642] pl-5">
            <h1 className="m-0 text-[clamp(1.65rem,2.5vw,2.35rem)] font-extrabold leading-tight text-[#702034]">Fare Pricing Management</h1>
            <p className="mt-1 text-lg text-[#71829f]">Manage the active system fares.</p>
          </div>
        </header>

        {loading ? (
          <section className="rounded-xl border border-[#d8e1ee] bg-white p-7 text-slate-600" role="status">
            Loading active fare configuration…
          </section>
        ) : !config ? (
          <section role="alert" className="rounded-xl border border-[#d8e1ee] bg-white p-7">
            <h2 className="text-xl font-bold text-[#702034]">Couldn’t load fare configuration</h2>
            <p className="my-3 text-sm text-slate-600">{loadError || 'The fare service is temporarily unavailable. No changes have been made.'}</p>
            <button type="button" onClick={load} className="rounded-lg bg-[#702034] px-5 py-3 font-bold text-white transition hover:bg-[#591728]">Retry</button>
          </section>
        ) : (
          <section className="rounded-xl border border-[#d8e1ee] bg-white p-7 max-[560px]:p-4">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#702034] max-[560px]:text-xl">Current Fare Configuration</h2>
              <p className="mt-1 text-base text-[#71829f]">Set the fixed fare charged per passenger.</p>
            </div>

            <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
              <FareField
                icon={FiUser}
                label="Regular Fare"
                description="Standard passenger fare."
                name="regularFare"
                value={regular}
                onChange={setRegular}
              />
              <FareField
                icon={FiTag}
                label="Discounted Fare"
                description="Verified student, senior, and PWD passengers."
                name="discountedFare"
                value={discounted}
                onChange={setDiscounted}
              />
            </div>

            <div className="my-6 flex gap-4 rounded-xl bg-[#f0f4fa] p-5 text-[#536b91] max-[560px]:gap-3 max-[560px]:p-4">
              <FiInfo aria-hidden="true" className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-[#7890b4] p-1.5 text-white" />
              <div className="space-y-1 text-sm leading-6">
                <p className="font-bold text-[#3e557b]">Current active fares: {peso(config.regularFare)} regular <span className="px-1">•</span> {peso(config.discountedFare)} discounted</p>
                <p>Version {config.version} <span className="px-1">·</span> Last updated {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : 'Initial configuration'} by {config.updatedBy || 'System'}</p>
                <p>Discounted fares follow verified passenger eligibility.</p>
              </div>
            </div>

            {errors.map((error) => <p role="alert" className="mb-2 text-sm font-medium text-red-700" key={error}>{error}</p>)}

            <div className="flex flex-wrap gap-3">
              <button
                disabled={!!errors.length || saving || !changed}
                onClick={() => setConfirm(true)}
                className="inline-flex min-h-14 items-center gap-3 rounded-xl bg-[#702034] px-7 font-bold text-white shadow-sm transition hover:bg-[#591728] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FiSave aria-hidden="true" className="text-xl" /> Save Changes
              </button>
              <button
                type="button"
                onClick={() => { setRegular(String(config.regularFare)); setDiscounted(String(config.discountedFare)); }}
                disabled={!changed || saving}
                className="inline-flex min-h-14 items-center gap-3 rounded-xl border border-[#702034] bg-white px-6 font-bold text-[#702034] transition hover:bg-[#faf4f5] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <FiRotateCcw aria-hidden="true" className="text-xl" /> Reset
              </button>
            </div>

            {confirm && (
              <div role="dialog" aria-modal="true" aria-labelledby="fare-confirm-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                  <h2 id="fare-confirm-title" className="text-xl font-bold text-[#702034]">Apply new fares?</h2>
                  <p className="my-4 text-slate-600">Regular {peso(regular)} · Discounted {peso(discounted)}. New transactions use these fares after the configuration is saved.</p>
                  <div className="flex justify-end gap-3">
                    <button disabled={saving} onClick={() => setConfirm(false)} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Cancel</button>
                    <button disabled={saving} onClick={save} className="rounded-lg bg-[#702034] px-4 py-2 font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Confirm and apply'}</button>
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
