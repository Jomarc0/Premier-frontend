import RemittanceAdjustments from '../components/RemittanceAdjustments';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FiAlertTriangle, FiCheck, FiEye, FiRefreshCw, FiUsers, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import ConfirmModal from '../components/ConfirmModal';
import * as ui from '../components/adminUI';
import { formatDateTime, formatTime, phtDateKey } from '../lib/time';

const today = () => phtDateKey();
const peso = (value) => new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value || 0));
const formatCollectionDate = (value) => {
    const date = new Date(`${value}T12:00:00+08:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric',
    }).format(date);
};
const cashPattern = /^\d{1,8}(?:\.\d{1,2})?$/;
const toCents = (value) => Math.round(Number(value || 0) * 100);

export default function StaffPage() {
    const [date, setDate] = useState(today());
    const [collections, setCollections] = useState([]);
    const [selected, setSelected] = useState(null);
    const [actual, setActual] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [staffSearch, setStaffSearch] = useState('');
    const [remittanceStatus, setRemittanceStatus] = useState('ALL');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmError, setConfirmError] = useState('');
    const [inputError, setInputError] = useState('');
    const detailDialogRef = useRef(null);
    const closeButtonRef = useRef(null);
    const previousFocusRef = useRef(null);
    const confirmationInFlightRef = useRef(false);

    const loadCollections = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminAPI.get(`/staff-cash/collections?date=${date}`);
            setCollections(res.data.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load staff collections');
        } finally { setLoading(false); }
    }, [date]);

    useEffect(() => {
        const initial = window.setTimeout(() => { loadCollections(); }, 0);
        return () => window.clearTimeout(initial);
    }, [loadCollections]);

    const detailOpen = Boolean(selected);
    useEffect(() => {
        if (!detailOpen || !detailDialogRef.current) return undefined;
        const dialog = detailDialogRef.current;
        previousFocusRef.current = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
        closeButtonRef.current?.focus();
        return () => {
            if (dialog.open) dialog.close();
            document.body.style.overflow = previousOverflow;
            if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
        };
    }, [detailOpen]);

    const openCollection = async (row) => {
        try {
            const res = await adminAPI.get(`/staff-cash/collections/${row.staffId}?date=${date}`);
            setSelected(res.data.data);
            setActual('');
            setInputError('');
            setConfirmError('');
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to load collection details'); }
    };

    const dismissConfirmation = () => {
        if (saving) return;
        setConfirmOpen(false);
        setConfirmError('');
    };

    const requestConfirmation = () => {
        if (actual.trim() === '' || !cashPattern.test(actual.trim()) || !Number.isFinite(Number(actual)) || Number(actual) < 0) {
            setInputError('Enter an amount from ₱0.00 to ₱99,999,999.99 with no more than two decimal places.');
            return;
        }
        setInputError('');
        setConfirmError('');
        setConfirmOpen(true);
    };

    const confirmRemittance = async () => {
        if (!selected?.summary?.staffId || confirmationInFlightRef.current) return;
        confirmationInFlightRef.current = true;
        setSaving(true);
        setConfirmError('');
        try {
            const staffId = selected.summary.staffId;
            const res = await adminAPI.post(`/staff-cash/collections/${staffId}/remittance`, {
                date: selected.summary.date,
                actualCashReceived: Number(actual),
            });
            setSelected(res.data.data);
            setActual('');
            setConfirmOpen(false);
            toast.success('Staff remittance confirmed. Any difference is recorded for reconciliation.');
            loadCollections();
        } catch (err) {
            if (err.response?.data?.code === 'REMITTANCE_ALREADY_CONFIRMED') {
                try {
                    const latest = await adminAPI.get(`/staff-cash/collections/${selected.summary.staffId}?date=${selected.summary.date}`);
                    setSelected(latest.data.data);
                    setActual('');
                    setConfirmOpen(false);
                    setConfirmError('');
                    toast.info('This remittance was already confirmed. Latest reconciliation details are shown.');
                    loadCollections();
                    return;
                } catch { /* Keep the confirmation open and show the original response below. */ }
            }
            const message = err.response?.data?.message || 'Failed to confirm remittance. Please review the amount and retry.';
            setConfirmError(message);
            toast.error(message);
        } finally {
            confirmationInFlightRef.current = false;
            setSaving(false);
        }
    };

    const copyReference = async (reference) => {
        if (!reference) return;
        try {
            await navigator.clipboard.writeText(reference);
            toast.success('Transaction reference copied');
        } catch { toast.info('Clipboard unavailable. The full reference is available in the reference tooltip and accessible label.'); }
    };

    const filteredCollections = collections.filter((collection) => {
        const query = staffSearch.trim().toLowerCase();
        const matchesSearch = !query || [collection.staffName, collection.staffId]
            .some(value => String(value || '').toLowerCase().includes(query));
        const status = collection.remittanceState === 'PENDING' ? 'PENDING' : collection.result;
        return matchesSearch && (remittanceStatus === 'ALL' || status === remittanceStatus);
    });

    const summary = selected?.summary;
    const pending = summary?.remittanceState === 'PENDING';
    const expectedCents = toCents(summary?.expectedCash);
    const actualCents = toCents(actual);
    const previewDifference = actual.trim() !== '' && cashPattern.test(actual.trim())
        ? actualCents - expectedCents : null;
    const previewStatus = previewDifference == null ? null
        : previewDifference === 0 ? 'BALANCED' : previewDifference < 0 ? 'SHORT' : 'OVER';
    const originalConfirmedCash = (toCents(summary?.actualCashReceived) - toCents(summary?.adjustmentsTotal)) / 100;

    return <div className={ui.layout}>
        <AdminSidebar />
        <main className={ui.workspace}>
            <header className={ui.headerBar}>
                <div><span className={ui.eyebrow}>Staff Accountability</span><h1 className={ui.headerTitle}>Staff</h1><p className="mt-1 text-sm text-text-muted">Review staff-recorded cash fares and confirm physical cash remittance.</p></div>
                <button type="button" onClick={loadCollections} className={ui.adminActionRefresh}><FiRefreshCw /> Refresh</button>
            </header>
            <section className={ui.filterPanel}>
                <h2 className={ui.filterPanelTitle}>Filter Staff Remittance</h2>
                <div className={ui.filterBar}>
                    <label className={ui.filterGroup}><span className={ui.filterLabel}>Collection date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={ui.filterField} /></label>
                    <label className={`${ui.filterGroup} flex-[1_1_18rem]`}><span className={ui.filterLabel}>Staff</span><input type="search" value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search staff name or ID..." className={`${ui.filterSearch} w-full`} /></label>
                    <label className={ui.filterGroup}><span className={ui.filterLabel}>Remittance status</span><select value={remittanceStatus} onChange={(event) => setRemittanceStatus(event.target.value)} className={ui.filterField}><option value="ALL">All Statuses</option><option value="PENDING">Pending</option><option value="BALANCED">Balanced</option><option value="SHORT">Short</option><option value="OVER">Over</option></select></label>
                    <button type="button" onClick={() => { setDate(today()); setStaffSearch(''); setRemittanceStatus('ALL'); }} className={ui.filterReset}>Reset</button>
                </div>
            </section>
            <section className={ui.dataPanel}>
                <div className={ui.dataPanelHeader}><span className={ui.dataPanelTitle}><FiUsers /> Staff Remittance <span className={ui.countPill}>{filteredCollections.length} shown</span></span></div>
                <div className={ui.tableWrap}><table className={ui.adminTable}><thead><tr>{['Staff','Date','Regular','Discounted','Transactions','Expected Cash','Actual Cash','Difference','Status','Action'].map(h => <th key={h} className={ui.tableTh}>{h}</th>)}</tr></thead>
                    <tbody>{loading ? <tr><td colSpan="10" className={ui.loadingRow}>Loading...</td></tr> : filteredCollections.length ? filteredCollections.map(row => <tr key={row.staffId} className={ui.tableRow}>
                        <td className={`${ui.tableTd} font-black`}>{row.staffName}</td><td className={ui.tableTd}>{row.date}</td><td className={ui.tableTd}>{row.regularCount}</td><td className={ui.tableTd}>{row.discountedCount}</td><td className={ui.tableTd}>{row.totalTransactions}</td>
                        <td className={`${ui.tableTd} font-black`}>{peso(row.expectedCash)}</td><td className={ui.tableTd}>{row.actualCashReceived == null ? '—' : peso(row.actualCashReceived)}</td><td className={ui.tableTd}>{row.difference == null ? '—' : peso(row.difference)}</td>
                        <td className={ui.tableTd}><span className={statusPillClass(row.remittanceState === 'PENDING' ? 'PENDING' : row.result)}>{row.remittanceState === 'PENDING' ? 'PENDING' : row.result}</span></td>
                        <td className={ui.tableTd}><button type="button" onClick={() => openCollection(row)} className={ui.adminAction}><FiEye /> View</button></td>
                    </tr>) : <tr><td colSpan="10" className={ui.emptyRow}>No staff remittances match the selected filters.</td></tr>}</tbody>
                </table></div>
            </section>
        </main>

        {selected && <dialog ref={detailDialogRef} aria-labelledby="staff-remittance-title" aria-describedby="staff-remittance-subtitle"
            onCancel={(event) => { event.preventDefault(); if (!saving && !confirmOpen) setSelected(null); }}
            className="fixed inset-0 m-auto flex max-h-[90dvh] min-h-0 w-[calc(100%-1rem)] max-w-6xl flex-col overflow-hidden rounded-xl border border-border-soft bg-white p-0 text-text-main shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop:bg-black/50 max-[640px]:w-[calc(100%-0.75rem)]">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-soft px-5 py-4 sm:px-6">
                <div className="min-w-0"><h2 id="staff-remittance-title" className="m-0 truncate text-lg font-black text-maroon sm:text-xl">{summary.staffName}</h2><p id="staff-remittance-subtitle" className="m-0 mt-1 text-sm text-text-muted">{formatCollectionDate(summary.date)} · {summary.totalTransactions} cash transactions</p></div>
                <button ref={closeButtonRef} type="button" disabled={saving || confirmOpen} onClick={() => setSelected(null)} aria-label="Close staff remittance details" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border-soft text-text-muted transition hover:bg-page-bg hover:text-maroon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon disabled:cursor-not-allowed disabled:opacity-50"><FiX aria-hidden="true" /></button>
            </header>

            <section aria-label="Remittance summary" className="grid shrink-0 grid-cols-2 gap-3 border-b border-border-soft bg-white px-5 py-4 sm:px-6 lg:grid-cols-4">
                <SummaryCard label="Regular Transactions" value={summary.regularCount} />
                <SummaryCard label="Discounted Transactions" value={summary.discountedCount} />
                <SummaryCard label="Expected Cash" value={peso(summary.expectedCash)} emphasis />
                <SummaryCard label="Remittance Status" value={pending ? 'Pending' : summary.result || 'Confirmed'} status={pending ? 'PENDING' : summary.result} />
            </section>

            <div className="flex min-h-0 flex-1 flex-col overscroll-contain">
                {summary.requiresReconciliation && <div role="status" className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:mx-6"><FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" /><p className="m-0">Late fares changed the expected cash after confirmation. Review the immutable audit history and record an authorized correction if needed.</p></div>}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5 sm:p-6">
                    <div className="mb-3 flex items-center justify-between gap-3"><h3 className="m-0 text-base font-black text-maroon">Cash Transactions</h3><span className="text-xs font-semibold text-text-muted">{selected.transactions.length} rows</span></div>
                    <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-border-soft">
                        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-page-bg text-xs font-extrabold uppercase tracking-wide text-text-muted"><tr>
                                {['Time','Vehicle','Device','Legacy Shift','Terminal','Category','Amount','Reference'].map((heading) => <th key={heading} scope="col" className={`whitespace-nowrap border-b border-border-soft px-3 py-3 ${heading === 'Amount' ? 'text-right' : ''}`}>{heading}</th>)}
                            </tr></thead>
                            <tbody>{selected.transactions.map(tx => <tr key={tx.id} className="border-b border-border-soft last:border-0 hover:bg-page-bg/70">
                                <td className="whitespace-nowrap px-3 py-3 text-text-main">{formatTime(tx.offlineCapturedAt || tx.createdAt)}</td>
                                <td className="whitespace-nowrap px-3 py-3 font-semibold text-text-main">{tx.plateNumber || '—'}</td>
                                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-text-main">{tx.deviceId || '—'}</td>
                                <td className="whitespace-nowrap px-3 py-3 text-text-main">{tx.driverShiftId ?? '—'}</td>
                                <td className="max-w-44 px-3 py-3 text-text-main">{tx.terminal || '—'}</td>
                                <td className="whitespace-nowrap px-3 py-3 text-text-main">{tx.fareCategory === 'REGULAR_CASH' ? 'Regular' : 'Discounted'}</td>
                                <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-text-main">{peso(tx.finalFare)}</td>
                                <td className="max-w-52 px-3 py-3"><button type="button" onClick={() => copyReference(tx.referenceNumber)} title={tx.referenceNumber || 'No transaction reference'} aria-label={`Copy full transaction reference ${tx.referenceNumber || 'unavailable'}`} className="block max-w-48 truncate rounded text-left font-mono text-xs text-maroon underline decoration-border-soft underline-offset-2 hover:decoration-maroon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon">{tx.referenceNumber || '—'}</button></td>
                            </tr>)}</tbody>
                        </table>
                    {selected.transactions.length === 0 && <p className="m-3 text-sm text-text-muted">No cash transactions are recorded for this collection.</p>}
                    {!pending && <details className="m-4 overflow-hidden rounded-lg border border-border-soft bg-white">
                        <summary className="cursor-pointer list-none px-4 py-3 font-black text-maroon marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon">Audit History &amp; Corrections</summary>
                        <div className="border-t border-border-soft p-4 sm:p-5">
                            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                                <AuditMetric label="Original expected" value={peso(summary.confirmedExpectedCash)} />
                                <AuditMetric label="Original confirmed" value={peso(originalConfirmedCash)} />
                                <AuditMetric label="Signed corrections" value={peso(summary.adjustmentsTotal)} />
                                <AuditMetric label="Effective cash" value={peso(summary.actualCashReceived)} />
                                <AuditMetric label="Current status" value={summary.result || 'Confirmed'} status={summary.result} />
                            </div>
                            <div className="mb-4 rounded-lg border border-border-soft bg-page-bg/70 p-3 text-sm">
                                <p className="m-0 font-bold text-text-main">Original remittance confirmation</p>
                                <p className="m-0 mt-1 text-text-muted">Confirmed {summary.confirmedAt ? formatDateTime(summary.confirmedAt) : 'at an unavailable time'}. The original confirmation remains unchanged; corrections are recorded separately.</p>
                            </div>
                            <RemittanceAdjustments key={`${summary.staffId}:${summary.date}`} summary={summary} onUpdated={updated => { setSelected(updated); loadCollections(); }} />
                        </div>
                    </details>}
                    </div>
                </div>
            </div>

            {pending && <footer className="flex shrink-0 flex-col gap-4 border-t border-border-soft bg-page-bg/60 px-5 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 lg:pb-2"><p className="m-0 text-xs font-extrabold uppercase tracking-wide text-text-muted">Expected Cash</p><p className="m-0 mt-1 text-lg font-black tabular-nums text-maroon">{peso(summary.expectedCash)}</p>
                    {previewDifference != null && <p className={`m-0 mt-1 text-sm font-bold ${previewStatus === 'BALANCED' ? 'text-green-brand' : previewStatus === 'PENDING' ? 'text-text-muted' : previewStatus === 'SHORT' || previewStatus === 'OVER' ? 'text-amber-800' : ''}`}>{previewStatus === 'BALANCED' ? 'Matches expected cash' : `${previewStatus}: ${peso(Math.abs(previewDifference) / 100)} ${previewDifference < 0 ? 'less' : 'more'} than expected`}</p>}
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">
                    <label className="min-w-0 flex-1 sm:min-w-64 lg:w-64 lg:flex-none"><span className={ui.fieldLabel}>Actual Cash Received</span><span className="relative mt-1 block"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">₱</span><input type="number" inputMode="decimal" min="0" max="99999999.99" step="0.01" required value={actual} onChange={(e) => { setActual(e.target.value); setInputError(''); }} aria-invalid={Boolean(inputError)} aria-describedby={inputError ? 'actual-cash-error' : undefined} className="min-h-11 w-full rounded-lg border border-border-soft bg-white pl-8 pr-3 text-right font-semibold tabular-nums outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/15" placeholder="0.00" /></span>{inputError && <span id="actual-cash-error" role="alert" className="mt-1 block text-xs font-semibold text-danger-muted">{inputError}</span>}</label>
                    <button type="button" disabled={saving || confirmOpen} onClick={requestConfirmation} className={`${ui.adminActionPrimary} min-h-11 w-full justify-center sm:w-auto`}><FiCheck /> Confirm Remittance</button>
                </div>
            </footer>}
        </dialog>}

        <ConfirmModal
            isOpen={confirmOpen}
            onClose={dismissConfirmation}
            onConfirm={confirmRemittance}
            title="Confirm Cash Remittance?"
            message="This records the original cash confirmation. Any short or over amount is recorded as a discrepancy and must be reconciled through an audited correction."
            details={summary && <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border-soft bg-page-bg p-4 text-sm"><div><span className="block text-xs font-bold text-text-muted">Expected Cash</span><strong className="mt-1 block text-base text-maroon">{peso(summary.expectedCash)}</strong></div><div><span className="block text-xs font-bold text-text-muted">Actual Cash</span><strong className="mt-1 block text-base text-maroon">{peso(actual)}</strong></div><div><span className="block text-xs font-bold text-text-muted">Difference</span><strong className="mt-1 block text-base">{previewDifference == null ? '—' : `${previewDifference < 0 ? '−' : previewDifference > 0 ? '+' : ''}${peso(Math.abs(previewDifference) / 100)}`}</strong></div><div><span className="block text-xs font-bold text-text-muted">Recorded Status</span><strong className="mt-1 block text-base">{previewStatus || '—'}</strong></div></div>}
            warning={previewStatus && previewStatus !== 'BALANCED' ? `This amount will be recorded as ${previewStatus}. It will not be marked balanced.` : 'After confirmation, the original amount is immutable. Corrections require a separate audited adjustment.'}
            error={confirmError}
            confirmText="Confirm Remittance"
            cancelText="Cancel"
            loadingText="Confirming remittance..."
            loading={saving}
            confirmDisabled={!selected?.summary?.staffId}
            variant="primary"
            ariaLabelledBy="confirm-remittance-title"
            ariaDescribedBy="confirm-remittance-description"
        />
    </div>;
}

function SummaryCard({ label, value, emphasis = false, status }) {
    return <div className="flex min-h-[5.2rem] min-w-0 flex-col justify-between rounded-lg border border-border-soft bg-page-bg/70 p-3">
        <span className="text-[0.68rem] font-extrabold uppercase tracking-wide text-text-muted">{label}</span>
        {status ? <span className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-extrabold ${statusPillClass(status)}`}>{value}</span>
            : <strong className={`mt-2 truncate ${emphasis ? 'text-base text-maroon' : 'text-lg text-text-main'}`}>{value}</strong>}
    </div>;
}

function AuditMetric({ label, value, status }) {
    return <div className="min-w-0 rounded-lg border border-border-soft bg-page-bg/70 p-3">
        <span className="block text-[0.65rem] font-extrabold uppercase tracking-wide text-text-muted">{label}</span>
        {status ? <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-extrabold ${statusPillClass(status)}`}>{value}</span>
            : <strong className="mt-2 block truncate text-sm tabular-nums text-text-main">{value}</strong>}
    </div>;
}

function statusPillClass(status) {
    if (status === 'PENDING') return 'bg-amber-100 text-amber-800';
    if (status === 'BALANCED') return 'bg-green-brand/10 text-green-brand';
    if (status === 'SHORT' || status === 'OVER') return 'bg-danger-muted/10 text-danger-muted';
    return 'bg-text-muted/10 text-text-muted';
}
