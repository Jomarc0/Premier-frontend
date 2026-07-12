import { useEffect, useState } from 'react';
import { FiCheck, FiEye, FiRefreshCw, FiUsers, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';

const today = () => new Date().toISOString().slice(0, 10);
const peso = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));

export default function StaffPage() {
    const [date, setDate] = useState(today());
    const [collections, setCollections] = useState([]);
    const [selected, setSelected] = useState(null);
    const [actual, setActual] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadCollections = async () => {
        setLoading(true);
        try {
            const res = await adminAPI.get(`/staff-cash/collections?date=${date}`);
            setCollections(res.data.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load staff collections');
        } finally { setLoading(false); }
    };

    useEffect(() => { loadCollections(); }, [date]);

    const openCollection = async (row) => {
        try {
            const res = await adminAPI.get(`/staff-cash/collections/${row.staffId}?date=${date}`);
            setSelected(res.data.data);
            setActual(res.data.data?.summary?.actualCashReceived ?? '');
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to load collection details'); }
    };

    const confirmRemittance = async () => {
        const amount = Number(actual);
        if (!Number.isFinite(amount) || amount < 0) { toast.warning('Enter a valid actual cash amount'); return; }
        setSaving(true);
        try {
            const staffId = selected.summary.staffId;
            const res = await adminAPI.post(`/staff-cash/collections/${staffId}/remittance`, { date, actualCashReceived: amount });
            setSelected(res.data.data);
            toast.success('Staff remittance confirmed');
            loadCollections();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to confirm remittance'); }
        finally { setSaving(false); }
    };

    return <div className={ui.layout}>
        <AdminSidebar />
        <main className={ui.workspace}>
            <header className={ui.headerBar}>
                <div><span className={ui.eyebrow}>Staff Accountability</span><h1 className={ui.headerTitle}>Staff</h1><p className="mt-1 text-sm text-text-muted">Review staff-recorded cash fares and confirm physical cash remittance.</p></div>
                <button type="button" onClick={loadCollections} className={ui.adminActionRefresh}><FiRefreshCw /> Refresh</button>
            </header>
            <section className="mb-5 flex items-end gap-3 rounded-lg border border-border-soft bg-white p-4">
                <label><span className={ui.fieldLabel}>Collection date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11 rounded-lg border border-border-soft px-3" /></label>
            </section>
            <section className={ui.dataPanel}>
                <div className={ui.dataPanelHeader}><span className={ui.dataPanelTitle}><FiUsers /> Staff Remittance <span className={ui.countPill}>{collections.length} staff</span></span></div>
                <div className={ui.tableWrap}><table className={ui.adminTable}><thead><tr>{['Staff','Date','Regular','Discounted','Transactions','Expected Cash','Actual Cash','Difference','Status','Action'].map(h => <th key={h} className={ui.tableTh}>{h}</th>)}</tr></thead>
                    <tbody>{loading ? <tr><td colSpan="10" className={ui.loadingRow}>Loading...</td></tr> : collections.length ? collections.map(row => <tr key={row.staffId} className={ui.tableRow}>
                        <td className={`${ui.tableTd} font-black`}>{row.staffName}</td><td className={ui.tableTd}>{row.date}</td><td className={ui.tableTd}>{row.regularCount}</td><td className={ui.tableTd}>{row.discountedCount}</td><td className={ui.tableTd}>{row.totalTransactions}</td>
                        <td className={`${ui.tableTd} font-black`}>{peso(row.expectedCash)}</td><td className={ui.tableTd}>{row.actualCashReceived == null ? '—' : peso(row.actualCashReceived)}</td><td className={ui.tableTd}>{row.difference == null ? '—' : peso(row.difference)}</td>
                        <td className={ui.tableTd}><span className={row.remittanceState === 'PENDING' ? 'rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-800' : row.result === 'BALANCED' ? ui.statusPillSoftSuccess : ui.statusPillSoftDanger}>{row.remittanceState === 'PENDING' ? 'PENDING' : row.result}</span></td>
                        <td className={ui.tableTd}><button type="button" onClick={() => openCollection(row)} className={ui.adminAction}><FiEye /> View</button></td>
                    </tr>) : <tr><td colSpan="10" className={ui.emptyRow}>No staff cash transactions for this date.</td></tr>}</tbody>
                </table></div>
            </section>
        </main>
        {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-border-soft p-5"><div><h2 className="text-xl font-black text-text-main">{selected.summary.staffName}</h2><p className="text-sm text-text-muted">{selected.summary.date} · {selected.summary.totalTransactions} cash transactions</p></div><button onClick={() => setSelected(null)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-page-bg"><FiX /></button></header>
            <div className="grid grid-cols-4 gap-3 p-5 max-[760px]:grid-cols-2"><div><small>Regular</small><strong className="block">{selected.summary.regularCount}</strong></div><div><small>Discounted</small><strong className="block">{selected.summary.discountedCount}</strong></div><div><small>Expected Cash</small><strong className="block">{peso(selected.summary.expectedCash)}</strong></div><div><small>Status</small><strong className="block">{selected.summary.result || 'PENDING'}</strong></div></div>
            <div className="overflow-x-auto border-y border-border-soft"><table className={ui.adminTable}><thead><tr>{['Time','Vehicle','Device','Shift','Terminal','Category','Amount','Reference'].map(h => <th key={h} className={ui.tableTh}>{h}</th>)}</tr></thead><tbody>{selected.transactions.map(tx => <tr key={tx.id} className={ui.tableRow}><td className={ui.tableTd}>{new Date(tx.createdAt).toLocaleTimeString()}</td><td className={ui.tableTd}>{tx.plateNumber}</td><td className={ui.tableTd}>{tx.deviceId}</td><td className={ui.tableTd}>{tx.driverShiftId}</td><td className={ui.tableTd}>{tx.terminal || '—'}</td><td className={ui.tableTd}>{tx.fareCategory === 'REGULAR_CASH' ? 'Regular' : 'Discounted'}</td><td className={`${ui.tableTd} font-black`}>{peso(tx.finalFare)}</td><td className={`${ui.tableTd} ${ui.mono}`}>{tx.referenceNumber}</td></tr>)}</tbody></table></div>
            <footer className="flex items-end justify-end gap-3 p-5 max-[620px]:flex-col"><label className="w-full max-w-xs"><span className={ui.fieldLabel}>Actual cash received</span><input type="number" min="0" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} className="min-h-11 w-full rounded-lg border border-border-soft px-3" /></label><button type="button" disabled={saving} onClick={confirmRemittance} className={ui.adminActionPrimary}><FiCheck /> {saving ? 'Saving...' : 'Confirm Remittance'}</button></footer>
        </section></div>}
    </div>;
}
