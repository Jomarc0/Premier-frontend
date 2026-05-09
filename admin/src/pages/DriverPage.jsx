import { useEffect, useState, useCallback } from 'react';
import {
    FiRefreshCw,
    FiSearch,
    FiUsers,
    FiPlus,
    FiX,
    FiUser,
} from 'react-icons/fi';
import AdminSidebar from '../components/AdminSidebar';
import adminAPI from '../api/adminAxios';
import { useAdminAuth } from '../context/AdminAuthContext';
import { toast } from 'react-toastify';

const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_BREAK', 'OFF_DUTY'];

const EMPTY_FORM = {
    fullName:      '',
    licenseNumber: '',
    phoneNumber:   '',
    status:        'INACTIVE',
};

const DriversPage = () => {
    const auth = useAdminAuth();
    const [drivers, setDrivers]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState('');
    const [showModal, setShowModal]   = useState(false);
    const [form, setForm]             = useState(EMPTY_FORM);
    const [saving, setSaving]         = useState(false);
    const [formErrors, setFormErrors] = useState({});

    const fetchDrivers = useCallback(async () => {
        const token = auth.admin?.token || localStorage.getItem('adminToken');
        if (!token) return;

        setLoading(true);
        try {
            const res = await adminAPI.get('/drivers?page=0&size=50');
            setDrivers(res.data.data || []);
        } catch (err) {
            console.error('Drivers fetch error:', err);
            if (err.response?.status === 401) {
                toast.error('Session expired. Logging out...');
                auth.logout();
            } else {
                toast.error('Failed to load drivers');
            }
        } finally {
            setLoading(false);
        }
    }, [auth]);

    useEffect(() => {
        if (auth.loading) return;
        fetchDrivers();
    }, [auth.loading, fetchDrivers]);

    const validateForm = () => {
        const errors = {};
        if (!form.fullName.trim())      errors.fullName      = 'Full name is required';
        if (!form.licenseNumber.trim()) errors.licenseNumber = 'License number is required';
        if (!form.phoneNumber.trim())   errors.phoneNumber   = 'Phone number is required';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSaving(true);
        try {
            const payload = {
                fullName:      form.fullName.trim(),
                licenseNumber: form.licenseNumber.trim().toUpperCase(),
                phoneNumber:   form.phoneNumber.trim(),
                status:        form.status,
            };
            await adminAPI.post('/drivers', payload);
            toast.success(`Driver ${payload.fullName} added!`);
            setShowModal(false);
            setForm(EMPTY_FORM);
            setFormErrors({});
            fetchDrivers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add driver');
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        setShowModal(false);
        setForm(EMPTY_FORM);
        setFormErrors({});
    };

    if (auth.loading) {
        return <div className="full-loading">Loading...</div>;
    }

    const filteredDrivers = drivers.filter(driver =>
        driver.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        driver.licenseNumber?.toLowerCase().includes(search.toLowerCase()) ||
        driver.phoneNumber?.includes(search)
    );

    const statusColor = (status) => ({
        ACTIVE:   '#2f6b3d',
        INACTIVE: '#717680',
        ON_BREAK: '#d97706',
        OFF_DUTY: '#b24a52',
    }[status] || '#717680');

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-workspace">

                {/* Header */}
                <header className="admin-header admin-plain-header">
                    <div>
                        <span className="eyebrow">Fleet Management</span>
                        <h1>Drivers ({filteredDrivers.length})</h1>
                        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            {drivers.length} total drivers
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                        <button type="button" onClick={fetchDrivers} className="admin-action refresh">
                            <FiRefreshCw />
                            Refresh
                        </button>
                        <button type="button" onClick={() => setShowModal(true)} className="admin-action primary">
                            <FiPlus />
                            Add Driver
                        </button>
                    </div>
                </header>

                {/* Search */}
                <div className="search-panel">
                    <div className="field-input" style={{ marginBottom: 0, flex: 1 }}>
                        <FiSearch />
                        <input
                            type="text"
                            placeholder="Search name, license, phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Drivers Table */}
                <section className="data-panel">
                    <div className="data-panel-header">
                        <span className="data-panel-title">
                            <FiUsers />
                            Driver Roster
                            <span className="count-pill">{filteredDrivers.length} shown</span>
                        </span>
                    </div>

                    <div className="admin-table-wrap">
                        {loading ? (
                            <div className="empty-row" style={{ padding: '2.5rem' }}>Loading drivers...</div>
                        ) : filteredDrivers.length === 0 ? (
                            <div className="empty-row" style={{ padding: '2.5rem' }}>No drivers found</div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        {['#', 'Driver', 'License', 'Phone', 'Status', 'Joined'].map(header => (
                                            <th key={header}>{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDrivers.map((driver, index) => (
                                        <tr key={driver.id}>
                                            <td style={{ color: 'var(--text-muted)' }}>{index + 1}</td>
                                            <td>
                                                <div className="driver-cell">
                                                    <div className="driver-avatar">
                                                        {driver.fullName?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <div className="driver-name">{driver.fullName || 'N/A'}</div>
                                                        <div className="driver-sub">ID: {driver.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="mono">{driver.licenseNumber || '—'}</td>
                                            <td className="mono">{driver.phoneNumber || '—'}</td>
                                            <td>
                                                <span
                                                    className="status-pill-color"
                                                    style={{ background: statusColor(driver.status) }}
                                                >
                                                    {driver.status || 'UNKNOWN'}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {driver.createdAt
                                                    ? new Date(driver.createdAt).toLocaleDateString('en-US', {
                                                        year: 'numeric', month: 'short', day: 'numeric',
                                                    })
                                                    : '—'
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </main>

            {/* ── Add Driver Modal ── */}
            {showModal && (
                <div className="modal-overlay" onClick={handleClose}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>

                        <div className="admin-modal-header">
                            <div className="admin-modal-title">
                                <span className="section-icon"><FiUser /></span>
                                <h2>Add New Driver</h2>
                            </div>
                            <button className="modal-close-btn" onClick={handleClose} aria-label="Close">
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="admin-modal-body" noValidate>

                            {/* Full Name */}
                            <div className="form-group">
                                <label className="form-label">
                                    Full Name <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`form-input ${formErrors.fullName ? 'error' : ''}`}
                                    placeholder="e.g. Juan dela Cruz"
                                    value={form.fullName}
                                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                                />
                                {formErrors.fullName && (
                                    <span className="form-error">{formErrors.fullName}</span>
                                )}
                            </div>

                            {/* License + Phone */}
                            <div className="form-row-2">
                                <div className="form-group">
                                    <label className="form-label">
                                        License Number <span className="required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className={`form-input ${formErrors.licenseNumber ? 'error' : ''}`}
                                        placeholder="e.g. N01-12-345678"
                                        value={form.licenseNumber}
                                        onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))}
                                    />
                                    {formErrors.licenseNumber && (
                                        <span className="form-error">{formErrors.licenseNumber}</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Phone Number <span className="required">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        className={`form-input ${formErrors.phoneNumber ? 'error' : ''}`}
                                        placeholder="e.g. 09171234567"
                                        value={form.phoneNumber}
                                        onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                                    />
                                    {formErrors.phoneNumber && (
                                        <span className="form-error">{formErrors.phoneNumber}</span>
                                    )}
                                </div>
                            </div>

                            {/* Status */}
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select
                                    className="form-input form-select"
                                    value={form.status}
                                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                >
                                    {DRIVER_STATUSES.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Actions */}
                            <div className="admin-modal-actions">
                                <button type="button" className="admin-btn-cancel" onClick={handleClose}>
                                    Cancel
                                </button>
                                <button type="submit" className="admin-btn-submit" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <span className="btn-spinner" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <FiPlus />
                                            Add Driver
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriversPage;