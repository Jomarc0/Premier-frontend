import { useEffect, useState } from 'react';
import { FiCheck, FiEye, FiRefreshCw, FiShield, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';

const statusClass = (status) => {
    if (status === 'APPROVED') return ui.statusPillSoftSuccess;
    if (status === 'REJECTED' || status === 'CANCELLED') return ui.statusPillSoftDanger;
    return 'inline-flex items-center px-[0.65rem] py-[0.22rem] rounded-full text-[0.7rem] font-black tracking-[0.03em] uppercase bg-gold/20 text-maroon';
};

const CardFreezeRequestsPage = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [remarks, setRemarks] = useState('');
    const [busyId, setBusyId] = useState(null);

    useEffect(() => { fetchRequests(); }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await adminAPI.get('/card-freeze-requests');
            setRequests(res.data.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load card requests');
        } finally {
            setLoading(false);
        }
    };

    const approve = async (request) => {
        const isUpdateOnly = request.requestType === 'CARD_UPDATE';
        const message = isUpdateOnly
            ? 'Approve card update request for ' + request.maskedCardNumber + '? This will not freeze the card automatically.'
            : 'Approve and freeze card ' + request.maskedCardNumber + '?';
        if (!window.confirm(message)) return;
        setBusyId(request.id);
        try {
            await adminAPI.put(`/card-freeze-requests/${request.id}/approve`);
            toast.success(request.requestType === 'CARD_UPDATE' ? 'Card update request approved' : 'Request approved and card frozen');
            fetchRequests();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to approve request');
        } finally {
            setBusyId(null);
        }
    };

    const reject = async () => {
        if (!remarks.trim()) {
            toast.warning('Enter admin remarks before rejecting');
            return;
        }
        setBusyId(rejecting.id);
        try {
            await adminAPI.put(`/card-freeze-requests/${rejecting.id}/reject`, { adminRemarks: remarks.trim() });
            toast.success('Request rejected');
            setRejecting(null);
            setRemarks('');
            fetchRequests();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject request');
        } finally {
            setBusyId(null);
        }
    };

    const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
    const activeModal = selected || rejecting;

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Security Review</span>
                        <h1 className={ui.headerTitle}>Card Requests</h1>
                        <p className="mt-1 text-sm text-text-muted">Review passenger lost, stolen, freeze-card, and card-change requests before changing card status.</p>
                    </div>
                    <button onClick={fetchRequests} className={ui.adminActionRefresh}>
                        <FiRefreshCw /> Refresh
                    </button>
                </header>

                <section className="grid grid-cols-3 gap-4 mb-5 max-[860px]:grid-cols-1">
                    <article className={ui.statCardVariant.maroon}><div><span className={ui.statLabel}>Total Requests</span><span className={ui.statValue}>{requests.length}</span></div><span className={ui.statIconVariant.maroon}><FiShield /></span></article>
                    <article className={ui.statCardVariant.gold}><div><span className={ui.statLabel}>Pending Review</span><span className={ui.statValue}>{pendingCount}</span></div><span className={ui.statIconVariant.gold}><FiEye /></span></article>
                    <article className={ui.statCardVariant.green}><div><span className={ui.statLabel}>Processed</span><span className={ui.statValue}>{requests.length - pendingCount}</span></div><span className={ui.statIconVariant.green}><FiCheck /></span></article>
                </section>

                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}><FiShield /> Requests</span>
                        <span className={ui.countPill}>{pendingCount} pending</span>
                    </div>
                    <div className={ui.tableWrap}>
                        <table className={ui.adminTable}>
                            <thead>
                                <tr>
                                    <th className={ui.tableTh}>Passenger</th>
                                    <th className={ui.tableTh}>Card</th>
                                    <th className={ui.tableTh}>Type</th>
                                    <th className={ui.tableTh}>Reason</th>
                                    <th className={ui.tableTh}>Submitted</th>
                                    <th className={ui.tableTh}>Status</th>
                                    <th className={ui.tableTh}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && <tr><td className={ui.loadingRow} colSpan="7">Loading requests...</td></tr>}
                                {!loading && requests.length === 0 && <tr><td className={ui.emptyRow} colSpan="7">No card requests yet.</td></tr>}
                                {!loading && requests.map((request) => (
                                    <tr key={request.id} className={ui.tableRow}>
                                        <td className={ui.tableTd}>{request.passengerName}</td>
                                        <td className={`${ui.tableTd} ${ui.mono}`}>{request.maskedCardNumber}</td>
                                        <td className={ui.tableTd}>{request.requestType}</td>
                                        <td className={`${ui.tableTd} max-w-[22rem] truncate`}>{request.reason || 'No reason provided'}</td>
                                        <td className={ui.tableTd}>{request.createdAt ? new Date(request.createdAt).toLocaleString() : '-'}</td>
                                        <td className={ui.tableTd}><span className={statusClass(request.status)}>{request.status}</span></td>
                                        <td className={ui.tableTd}>
                                            <div className="flex flex-wrap gap-2">
                                                <button className={ui.adminAction} onClick={() => setSelected(request)}><FiEye /> View</button>
                                                {request.status === 'PENDING' && <button disabled={busyId === request.id} className={ui.adminActionPrimary} onClick={() => approve(request)}><FiCheck /> Approve</button>}
                                                {request.status === 'PENDING' && <button disabled={busyId === request.id} className="inline-flex items-center gap-[0.45rem] min-h-[2.45rem] px-[0.95rem] rounded-lg bg-white text-danger-muted border border-danger-muted/30 text-[0.86rem] font-black cursor-pointer hover:bg-danger-muted hover:text-white" onClick={() => setRejecting(request)}><FiX /> Reject</button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            {activeModal && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
                    <div className="w-full max-w-xl rounded-lg bg-white shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between bg-maroon px-5 py-4 text-white">
                            <strong>{rejecting ? 'Reject Request' : 'Request Details'}</strong>
                            <button className="rounded-md bg-white/15 px-3 py-2" onClick={() => { setSelected(null); setRejecting(null); setRemarks(''); }}>x</button>
                        </div>
                        <div className="p-5 space-y-3 text-sm text-text-main">
                            <p><strong>Passenger:</strong> {activeModal.passengerName}</p>
                            <p><strong>Card:</strong> {activeModal.maskedCardNumber}</p>
                            <p><strong>Type:</strong> {activeModal.requestType}</p>
                            <p><strong>Status:</strong> {activeModal.status}</p>
                            <p><strong>Reason:</strong> {activeModal.reason || 'No reason provided'}</p>
                            {rejecting && <>
                                <label className={ui.fieldLabel}>Admin remarks</label>
                                <textarea className="w-full min-h-[8rem] rounded-lg border-2 border-[#d9dce2] p-3 outline-none focus:border-maroon" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Explain why this request is rejected." />
                                <button className={ui.primaryButton} disabled={busyId === rejecting.id} onClick={reject}>Reject Request</button>
                            </>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CardFreezeRequestsPage;
