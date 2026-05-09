import { useEffect, useState } from 'react';
import {
    FiFileText,
    FiCalendar,
    FiUser,
    FiRefreshCw,
} from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import { useAdminAuth } from '../context/AdminAuthContext';
import { toast } from 'react-toastify';
import * as ui from '../components/adminUI';

const actionColors = {
    LOGIN:               '#3498db',
    LOGOUT:              '#e74c3c',
    APPROVE_TRANSACTION: '#27ae60',
    REJECT_TRANSACTION:  '#e67e22',
    ADD_BALANCE:         '#9b59b6',
    CREATE_USER:         '#1abc9c',
    CREATE_ADMIN:        '#2980b9',
    UPDATE_ADMIN:        '#f39c12',
    DELETE_ADMIN:        '#e74c3c',
    RESET_PASSWORD:      '#8e44ad',
};

const ActivityLogsPage = () => {
    const auth = useAdminAuth();

    const [logs, setLogs]                   = useState([]);
    const [stats, setStats]                 = useState({});
    const [loading, setLoading]             = useState(true);
    const [search, setSearch]               = useState('');
    const [page, setPage]                   = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    useEffect(() => {
        if (auth.loading) return;
        fetchData();
    }, [page, auth.loading]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [logsRes, statsRes] = await Promise.all([
                adminAPI.get(`/logs?page=${page}&size=25`),
                adminAPI.get('/logs/stats'),
            ]);
            const data = logsRes.data.data;
            setLogs(data.content || []);
            setTotalElements(data.totalElements || 0);
            setStats(statsRes.data.data || {});
        } catch (err) {
            if (err.response?.status === 401) {
                toast.error('Session expired. Logging out...');
                auth.logout();
            } else {
                toast.error('Failed to load logs');
            }
        } finally {
            setLoading(false);
        }
    };

    if (auth.loading) {
        return <div className={ui.fullLoading}>Loading...</div>;
    }

    const filtered = logs.filter(log =>
        search === '' ||
        (log.action  || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.details || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.admin?.username || '').toLowerCase().includes(search.toLowerCase())
    );

    const formatDateTime = (d) => {
        if (!d) return { date: '—', time: '—' };
        const dt = new Date(d);
        return {
            date: dt.toLocaleDateString('en-PH', {
                year: 'numeric', month: '2-digit', day: '2-digit',
            }),
            time: dt.toLocaleTimeString('en-PH', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
            }),
        };
    };

    const formatIP = (ip) => {
        if (!ip) return '—';
        if (ip === '0:0:0:0:0:0:0:1' || ip === '::1' || ip === 'localhost')
            return '127.0.0.1';
        return ip;
    };

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>

                {/* Header */}
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Audit Trail</span>
                        <h1 className={ui.headerTitle}>Activity Logs</h1>
                    </div>
                    <button onClick={fetchData} className={ui.adminActionRefresh}>
                        <FiRefreshCw />
                        Refresh
                    </button>
                </header>

                {/* Stats */}
                <section className={ui.statsGrid} aria-label="Log statistics">
                    {[
                        { label: 'Total Logs',    value: stats.totalLogs    || 0, variant: 'maroon', Icon: FiFileText },
                        { label: "Today's Logs",  value: stats.todayLogs    || 0, variant: 'gold',   Icon: FiCalendar },
                        { label: 'Unique Admins', value: stats.uniqueAdmins || 0, variant: 'green',  Icon: FiUser },
                    ].map((c) => (
                        <article key={c.label} className={ui.statCardVariant[c.variant]}>
                            <div>
                                <span className={ui.statLabel}>{c.label}</span>
                                <span className={ui.statValue}>{c.value}</span>
                            </div>
                            <span className={ui.statIconVariant[c.variant]}><c.Icon /></span>
                        </article>
                    ))}
                </section>

                {/* Table */}
                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}>
                            <FiFileText />
                            Activity Logs
                            <span className={ui.countPill}>{totalElements} entries</span>
                        </span>
                        <label className={ui.searchControl}>
                            Search:
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Action, details, admin..."
                                className={ui.searchControlInput}
                            />
                        </label>
                    </div>

                    <div className={ui.tableWrap}>
                        <table className={ui.adminTable}>
                            <thead>
                                <tr>
                                    {['Log ID', 'Date', 'Time', 'Admin', 'Action', 'Details', 'IP Address'].map(h => (
                                        <th key={h} className={ui.tableTh}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className={ui.loadingRow}>Loading...</td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className={ui.emptyRow}>No logs found.</td>
                                    </tr>
                                ) : filtered.map((log) => {
                                    const dt       = formatDateTime(log.createdAt);
                                    const actionBg = actionColors[log.action] || '#666';
                                    return (
                                        <tr key={log.id} className={ui.tableRow}>
                                            <td className={ui.tableTd}><strong>{log.id}</strong></td>
                                            <td className={`${ui.tableTd} ${ui.mono} whitespace-nowrap`}>{dt.date}</td>
                                            <td className={`${ui.tableTd} ${ui.mono} whitespace-nowrap text-text-muted`}>{dt.time}</td>
                                            <td className={ui.tableTd}>
                                                <div className="font-black text-text-main">
                                                    {log.admin?.username || '—'}
                                                </div>
                                                <div className="text-[0.72rem] text-text-muted">
                                                    ID: {log.admin?.id || '—'}
                                                </div>
                                            </td>
                                            <td className={ui.tableTd}>
                                                <span className={ui.actionTag} style={{ background: actionBg }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className={`${ui.tableTd} max-w-56 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted`}>
                                                {log.details || '—'}
                                            </td>
                                            <td className={`${ui.tableTd} ${ui.mono} text-text-muted`}>
                                                {formatIP(log.ipAddress)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className={ui.paginationBar}>
                        <span>
                            Showing {Math.min(page * 25 + 1, totalElements)} to{' '}
                            {Math.min((page + 1) * 25, totalElements)} of {totalElements} entries
                        </span>
                        <div className={ui.paginationButtons}>
                            <button
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                                className={ui.pageBtn}
                            >
                                Previous
                            </button>
                            <button className={ui.pageBtnActive}>{page + 1}</button>
                            <button
                                disabled={(page + 1) * 25 >= totalElements}
                                onClick={() => setPage(p => p + 1)}
                                className={ui.pageBtn}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default ActivityLogsPage;
