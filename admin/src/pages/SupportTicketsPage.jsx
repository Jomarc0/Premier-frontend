import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCheck, FiCreditCard, FiEdit3, FiEye, FiRefreshCw, FiShield, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';
import { captureEvent } from '../lib/posthog';
import { useRealtime } from '../context/RealtimeContext';
import { formatDateTime } from '../lib/time';

const filters = [
    ['ALL', 'All'],
    ['PENDING', 'Pending'],
    ['IN_REVIEW', 'In Review'],
    ['RESOLVED', 'Resolved'],
    ['REJECTED', 'Rejected'],
    ['LOST_CARD', 'Lost Card'],
    ['TOP_UP_ISSUE', 'Top-up Issue'],
];

const statusClass = (status) => {
    if (status === 'RESOLVED') return ui.statusPillSoftSuccess;
    if (status === 'REJECTED') return ui.statusPillSoftDanger;
    return 'inline-flex items-center px-[0.65rem] py-[0.22rem] rounded-full text-[0.7rem] font-black tracking-[0.03em] uppercase bg-gold/20 text-maroon';
};

const cleanUid = (value) =>
    String(value || '').trim().replace(/[^a-fA-F0-9]/g, '').toUpperCase();

const normalizeReaderUid = (value) => {
    if (!value) return '';
    const cleaned = String(value)
        .toUpperCase()
        .replace(/RFID|CARD|UID|TAG|ID|HEX|:/g, ' ')
        .replace(/[^A-F0-9]/g, '');
    return cleaned.length >= 4 && cleaned.length <= 20 ? cleaned : '';
};

const SupportTicketsPage = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [notes, setNotes] = useState('');
    const [newRfidUid, setNewRfidUid] = useState('');
    const [busy, setBusy] = useState(false);
    const [readingUid, setReadingUid] = useState(false);
    const [confirmation, setConfirmation] = useState(null);
    const { subscribe } = useRealtime();

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminAPI.get('/support-tickets');
            setTickets(res.data.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load support tickets');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    useEffect(() => subscribe((event) => {
        if (event.entity === 'SUPPORT_TICKET') fetchTickets();
    }), [fetchTickets, subscribe]);

    const visibleTickets = useMemo(() => {
        return tickets.filter((ticket) => {
            const matchesFilter = filter === 'ALL' || ticket.status === filter || ticket.issueType === filter;
            const query = search.trim().toLowerCase();
            const matchesSearch = !query || [ticket.ticketNumber, ticket.maskedCardNumber, ticket.email, ticket.issueType]
                .some(value => String(value || '').toLowerCase().includes(query));
            return matchesFilter && matchesSearch;
        });
    }, [filter, search, tickets]);

    const pendingCount = tickets.filter((ticket) => ticket.status === 'PENDING').length;
    const inReviewCount = tickets.filter((ticket) => ticket.status === 'IN_REVIEW').length;
    const isClosed = selected?.status === 'RESOLVED' || selected?.status === 'REJECTED';

    const openTicket = (ticket) => {
        setSelected(ticket);
        setNotes(ticket.adminNotes || '');
        setNewRfidUid('');
        setReadingUid(false);
        captureEvent('admin_support_ticket_opened', {
            issue_type: ticket.issueType,
            status: ticket.status,
            priority: ticket.priority,
        });
    };

    const refreshSelected = (updated) => {
        setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket));
        setSelected(updated);
        setNotes(updated.adminNotes || '');
    };

    const runAction = async (label, action, analyticsAction = 'update') => {
        if (!selected) return;
        setBusy(true);
        try {
            const res = await action();
            refreshSelected(res.data.data);
            toast.success(res.data?.message || label);
            captureEvent('admin_support_ticket_action', {
                action: analyticsAction,
                issue_type: selected.issueType,
                previous_status: selected.status,
                next_status: res.data.data?.status,
            });
        } catch (err) {
            captureEvent('admin_support_ticket_action_failed', {
                action: analyticsAction,
                issue_type: selected.issueType,
                status: selected.status,
            });
            toast.error(err.response?.data?.message || 'Action failed');
        } finally {
            setBusy(false);
        }
    };

    const runConfirmedAction = async (confirmMessage, label, action, analyticsAction = 'update') => {
        if (!selected) return;
        setConfirmation({ confirmMessage, label, action, analyticsAction });
    };

    const confirmAction = async () => {
        if (!confirmation) return;
        try {
            await runAction(confirmation.label, confirmation.action, confirmation.analyticsAction);
        } finally {
            setConfirmation(null);
        }
    };

    const handleReadReplacementUid = async () => {
        setReadingUid(true);
        try {
            const startRes = await adminAPI.post('/rfid/uid-capture/start');
            const requestId = startRes.data?.data?.requestId;
            if (!requestId) {
                throw new Error('Unable to start RFID UID capture.');
            }

            toast.info('Tap the replacement RFID card on the PN532 reader.');

            const startedAt = Date.now();
            const timeoutMs = 65000;

            while (Date.now() - startedAt < timeoutMs) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                const statusRes = await adminAPI.get(`/rfid/uid-capture/${requestId}`);
                const status = statusRes.data?.data?.status;
                const rfidUid = normalizeReaderUid(statusRes.data?.data?.rfidUid);

                if (status === 'CAPTURED' && rfidUid) {
                    setNewRfidUid(rfidUid);
                    toast.success(`Replacement RFID UID captured: ${rfidUid}`);
                    return;
                }

                if (status === 'EXPIRED') {
                    toast.warning('RFID UID capture expired. Click Read UID again.');
                    return;
                }
            }

            toast.warning('No RFID UID was read. Click Read UID and tap the card again.');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to read RFID UID.');
        } finally {
            setReadingUid(false);
        }
    };

    const handleReplaceRfidUid = async () => {
        const normalizedUid = cleanUid(newRfidUid);
        if (normalizedUid.length < 4) {
            toast.warning('Read or enter a valid replacement RFID UID.');
            return;
        }

        await runConfirmedAction(
            `Assign this replacement RFID card to ${selected.ticketNumber}?\n\nCard: ${selected.cardNumber}\nOld UID: ${selected.currentRfidUid || '-'}\nNew UID: ${normalizedUid}\n\nThis activates the passenger account on the replacement card. The ticket remains open so you can add notes and send the resolution email.`,
            'Replacement card assigned and account reactivated',
            () => adminAPI.post(`/support-tickets/${selected.id}/replace-rfid`, {
                newRfidUid: normalizedUid,
                adminNotes: notes,
            }),
            'replace_rfid_uid',
        );
    };

    const handleReject = async () => {
        const rejectionNotes = notes.trim();
        if (!rejectionNotes) {
            toast.warning('Enter admin notes explaining why the ticket is being rejected.');
            return;
        }
        await runConfirmedAction(
            `Reject ${selected.ticketNumber}? This sends the update email to the passenger.`,
            'Ticket rejected',
            () => adminAPI.post(`/support-tickets/${selected.id}/reject`, { adminNotes: rejectionNotes }),
            'reject',
        );
    };

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Passenger Support</span>
                        <h1 className={ui.headerTitle}>Support Tickets</h1>
                        <p className="mt-1 text-sm text-text-muted">Review public lost card, top-up, balance, login, and RFID concerns.</p>
                    </div>
                    <button onClick={fetchTickets} className={ui.adminActionRefresh}>
                        <FiRefreshCw /> Refresh
                    </button>
                </header>

                <section className="grid grid-cols-3 gap-4 mb-5 max-[860px]:grid-cols-1">
                    <article className={ui.statCardVariant.maroon}><div><span className={ui.statLabel}>Total Tickets</span><span className={ui.statValue}>{tickets.length}</span></div><span className={ui.statIconVariant.maroon}><FiShield /></span></article>
                    <article className={ui.statCardVariant.gold}><div><span className={ui.statLabel}>Pending</span><span className={ui.statValue}>{pendingCount}</span></div><span className={ui.statIconVariant.gold}><FiEye /></span></article>
                    <article className={ui.statCardVariant.green}><div><span className={ui.statLabel}>In Review</span><span className={ui.statValue}>{inReviewCount}</span></div><span className={ui.statIconVariant.green}><FiEdit3 /></span></article>
                </section>

                <section className={ui.filterPanel}>
                    <h2 className={ui.filterPanelTitle}>Filter Support Tickets</h2>
                    <div className={ui.filterBar}>
                        <label className={`${ui.filterGroup} flex-[1_1_18rem]`}><span className={ui.filterLabel}>Search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ticket, card, email, or issue..." className={`${ui.filterSearch} w-full`} /></label>
                        <label className={ui.filterGroup}><span className={ui.filterLabel}>Status or issue</span><select value={filter} onChange={(event) => setFilter(event.target.value)} className={ui.filterField}>{filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <button type="button" onClick={() => { setSearch(''); setFilter('ALL'); }} className={ui.filterReset}>Reset</button>
                    </div>
                </section>

                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}><FiShield /> Tickets</span>
                        <span className={ui.countPill}>{pendingCount} pending</span>
                    </div>
                    <div className={ui.tableWrap}>
                        <table className={ui.adminTable}>
                            <thead>
                                <tr>
                                    <th className={ui.tableTh}>Ticket</th>
                                    <th className={ui.tableTh}>Card</th>
                                    <th className={ui.tableTh}>Email</th>
                                    <th className={ui.tableTh}>Issue</th>
                                    <th className={ui.tableTh}>Priority</th>
                                    <th className={ui.tableTh}>Status</th>
                                    <th className={ui.tableTh}>Submitted</th>
                                    <th className={ui.tableTh}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && <tr><td className={ui.loadingRow} colSpan="8">Loading support tickets...</td></tr>}
                                {!loading && visibleTickets.length === 0 && <tr><td className={ui.emptyRow} colSpan="8">No support tickets found.</td></tr>}
                                {!loading && visibleTickets.map((ticket) => (
                                    <tr key={ticket.id} className={ui.tableRow}>
                                        <td className={`${ui.tableTd} ${ui.mono}`}>{ticket.ticketNumber}</td>
                                        <td className={`${ui.tableTd} ${ui.mono}`}>{ticket.maskedCardNumber}</td>
                                        <td className={ui.tableTd}>{ticket.email}</td>
                                        <td className={ui.tableTd}>{ticket.issueType}</td>
                                        <td className={ui.tableTd}>{ticket.priority}</td>
                                        <td className={ui.tableTd}><span className={statusClass(ticket.status)}>{ticket.status}</span></td>
                                        <td className={ui.tableTd}>{ticket.createdAt ? formatDateTime(ticket.createdAt) : '-'}</td>
                                        <td className={ui.tableTd}><button className={ui.adminAction} onClick={() => openTicket(ticket)}><FiEye /> View</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            {selected && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
                    <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between bg-maroon px-5 py-4 text-white">
                            <strong>{selected.ticketNumber}</strong>
                            <button className="rounded-md bg-white/15 px-3 py-2" onClick={() => setSelected(null)}>x</button>
                        </div>
                        <div className="grid gap-4 p-5 text-sm text-text-main md:grid-cols-2">
                            <div className="space-y-2">
                                <p><strong>Card:</strong> <span className={ui.mono}>{selected.cardNumber}</span></p>
                                <p><strong>Passenger:</strong> {selected.passengerName || 'Unknown'}</p>
                                <p><strong>Current RFID UID:</strong> <span className={ui.mono}>{selected.currentRfidUid || '-'}</span></p>
                                <p><strong>Email:</strong> {selected.email}</p>
                                <p><strong>Issue:</strong> {selected.issueType}</p>
                                <p><strong>Status:</strong> {selected.status}</p>
                                <p><strong>Priority:</strong> {selected.priority}</p>
                                <p><strong>Reason:</strong> {selected.reason}</p>
                            </div>
                            <div className="space-y-3">
                                {isClosed && (
                                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                                        This ticket is closed. No further card changes or notification emails can be sent.
                                    </p>
                                )}
                                <label className={ui.fieldLabel}>Admin notes <span className="text-danger-muted">(required to reject)</span></label>
                                <textarea className="w-full min-h-[7rem] rounded-lg border-2 border-[#d9dce2] p-3 outline-none focus:border-maroon" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter the resolution or rejection reason for the passenger" />
                                <button className={ui.adminActionPrimary} disabled={busy || isClosed} onClick={() => runAction('Notes saved', () => adminAPI.put(`/support-tickets/${selected.id}/notes`, { adminNotes: notes }), 'save_notes')}><FiEdit3 /> Save Notes</button>

                                <label className={ui.fieldLabel}>Replacement card RFID UID</label>
                                <div className="grid grid-cols-[1fr_8.5rem] gap-2 max-[620px]:grid-cols-1">
                                    <input
                                        className="w-full rounded-lg border-2 border-[#d9dce2] p-3 font-mono outline-none focus:border-maroon"
                                        value={newRfidUid}
                                        onChange={(e) => setNewRfidUid(e.target.value)}
                                        placeholder="Click Read UID, then tap replacement card"
                                    />
                                    <button
                                        type="button"
                                        className={ui.adminAction}
                                        disabled={busy || readingUid || isClosed}
                                        onClick={handleReadReplacementUid}
                                    >
                                        <FiCreditCard /> {readingUid ? 'Waiting...' : 'Read UID'}
                                    </button>
                                </div>
                                <p className="text-[0.74rem] text-text-muted">
                                    Click Read UID, then tap the replacement RFID card on the PN532 hardware. Assigning it reactivates the passenger account; the lost card stays unusable.
                                </p>
                                <button className={ui.adminActionPrimary} disabled={busy || readingUid || isClosed || cleanUid(newRfidUid).length < 4} onClick={handleReplaceRfidUid}><FiEdit3 /> Assign replacement & reactivate</button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-slate-100 p-5">
                            <button className={ui.adminAction} disabled={busy || readingUid || isClosed} onClick={() => runConfirmedAction(`Mark ${selected.ticketNumber} as in review?`, 'Marked in review', () => adminAPI.put(`/support-tickets/${selected.id}/status`, { status: 'IN_REVIEW' }), 'mark_in_review')}><FiEye /> Mark In Review</button>
                            <button className={ui.adminAction} disabled={busy || readingUid || isClosed} onClick={() => runConfirmedAction(`Freeze the passenger card for ${selected.ticketNumber}?`, 'Card frozen', () => adminAPI.post(`/support-tickets/${selected.id}/freeze-card`, { adminNotes: notes }), 'freeze_card')}><FiShield /> Freeze Card</button>
                            <button className={ui.adminActionPrimary} disabled={busy || readingUid || isClosed} onClick={() => runConfirmedAction(`Resolve ${selected.ticketNumber}? This sends the confirmation email to the passenger. For lost-card tickets, assign the replacement card first.`, 'Ticket resolved', () => adminAPI.post(`/support-tickets/${selected.id}/resolve`, { adminNotes: notes }), 'resolve')}><FiCheck /> Resolve & email passenger</button>
                            <button className="inline-flex items-center gap-[0.45rem] min-h-[2.45rem] px-[0.95rem] rounded-lg bg-white text-danger-muted border border-danger-muted/30 text-[0.86rem] font-black cursor-pointer hover:bg-danger-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || readingUid || isClosed} onClick={handleReject}><FiX /> Reject</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmation && (
                <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4" role="presentation">
                    <section
                        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ticket-confirmation-title"
                    >
                        <div className="h-1.5 bg-gold" />
                        <div className="p-6">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-maroon/10 text-maroon">
                                <FiShield size={21} />
                            </div>
                            <p className="mt-5 text-xs font-black uppercase tracking-[0.12em] text-[#b78a0e]">Premier Transport</p>
                            <h2 id="ticket-confirmation-title" className="mt-1 text-xl font-black text-text-main">Confirm ticket action</h2>
                            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-muted">{confirmation.confirmMessage}</p>
                            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Please verify the ticket details before continuing. This action will be recorded in the support ticket history.</p>
                        </div>
                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                className={ui.adminAction}
                                disabled={busy}
                                onClick={() => setConfirmation(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={ui.adminActionPrimary}
                                disabled={busy}
                                onClick={confirmAction}
                            >
                                <FiCheck /> {busy ? 'Processing...' : 'Confirm action'}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default SupportTicketsPage;
