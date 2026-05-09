import { useEffect, useState } from 'react';
import {
    FiRefreshCw,
    FiSearch,
    FiTruck,
    FiCheckCircle,
    FiPauseCircle,
    FiTool,
    FiMapPin,
    FiNavigation,
    FiPlus,
    FiX,
} from 'react-icons/fi';
import AdminSidebar from '../components/AdminSidebar';
import adminAPI from '../api/adminAxios';
import { useAdminAuth } from '../context/AdminAuthContext';
import { toast } from 'react-toastify';

const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE'];

const EMPTY_FORM = {
    plateNumber: '',
    totalCapacity: '',
    route: '',
    status: 'INACTIVE',
};

const VehiclesPage = () => {
    const auth = useAdminAuth();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState('');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm]           = useState(EMPTY_FORM);
    const [saving, setSaving]       = useState(false);
    const [formErrors, setFormErrors] = useState({});

    useEffect(() => {
        if (auth.loading) return;
        fetchVehicles();
    }, [auth.loading]);

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const res = await adminAPI.get('/vehicles');
            setVehicles(res.data.data || []);
        } catch (err) {
            console.error('Vehicles fetch error:', err);
            if (err.response?.status === 401) {
                toast.error('Session expired. Logging out...');
                auth.logout();
            } else {
                toast.error('Failed to load vehicles');
            }
        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        const errors = {};
        if (!form.plateNumber.trim()) errors.plateNumber = 'Plate number is required';
        if (!form.totalCapacity || isNaN(form.totalCapacity) || Number(form.totalCapacity) < 1)
            errors.totalCapacity = 'Valid capacity is required';
        if (!form.route.trim()) errors.route = 'Route is required';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSaving(true);
        try {
            const payload = {
                plateNumber:   form.plateNumber.trim().toUpperCase(),
                totalCapacity: Number(form.totalCapacity),
                route:         form.route.trim(),
                status:        form.status,
            };
            await adminAPI.post('/vehicles', payload);
            toast.success(`Vehicle ${payload.plateNumber} added!`);
            setShowModal(false);
            setForm(EMPTY_FORM);
            setFormErrors({});
            fetchVehicles();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add vehicle');
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

    const filtered = vehicles.filter(v =>
        v.plateNumber?.toLowerCase().includes(search.toLowerCase()) ||
        v.route?.toLowerCase().includes(search.toLowerCase())
    );

    const statusColor = (status) => ({
        ACTIVE:         '#2f6b3d',
        INACTIVE:       '#717680',
        MAINTENANCE:    '#d97706',
        OUT_OF_SERVICE: '#b24a52',
    }[status] || '#717680');

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-workspace">

                {/* Header */}
                <header className="admin-header admin-plain-header">
                    <div>
                        <span className="eyebrow">Fleet Management</span>
                        <h1>Vehicles</h1>
                        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            {vehicles.length} total vehicles
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                        <button type="button" onClick={fetchVehicles} className="admin-action refresh">
                            <FiRefreshCw />
                            Refresh
                        </button>
                        <button type="button" onClick={() => setShowModal(true)} className="admin-action primary">
                            <FiPlus />
                            Add Vehicle
                        </button>
                    </div>
                </header>

                {/* Stats */}
                <section className="vehicle-stats" aria-label="Vehicle status summary">
                    {[
                        { label: 'Total',       value: vehicles.length,                                              variant: '',            Icon: FiTruck },
                        { label: 'Active',      value: vehicles.filter(v => v.status === 'ACTIVE').length,           variant: 'active',      Icon: FiCheckCircle },
                        { label: 'Inactive',    value: vehicles.filter(v => v.status === 'INACTIVE').length,         variant: 'inactive',    Icon: FiPauseCircle },
                        { label: 'Maintenance', value: vehicles.filter(v => v.status === 'MAINTENANCE').length,      variant: 'maintenance', Icon: FiTool },
                    ].map((s, i) => (
                        <article key={i} className={`vehicle-stat ${s.variant}`}>
                            <div className="icon-wrap-sm"><s.Icon /></div>
                            <div>
                                <div className="num">{s.value}</div>
                                <div className="lbl">{s.label}</div>
                            </div>
                        </article>
                    ))}
                </section>

                {/* Vehicle Cards Container */}
                <section className="data-panel">
                    <div className="search-bar-row">
                        <div className="field-input" style={{ marginBottom: 0 }}>
                            <FiSearch />
                            <input
                                type="text"
                                placeholder="Search plate number or route..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="empty-row" style={{ padding: '2.5rem' }}>Loading vehicles...</div>
                    ) : (
                        <div className="vehicle-grid">
                            {filtered.length === 0 ? (
                                <div style={{
                                    gridColumn: '1/-1',
                                    textAlign: 'center',
                                    padding: '2.5rem',
                                    color: 'var(--text-muted)',
                                    fontStyle: 'italic',
                                }}>
                                    No vehicles found
                                </div>
                            ) : filtered.map(v => (
                                <div key={v.id} className="vehicle-card">
                                    <div className="vehicle-head">
                                        <div>
                                            <div className="vehicle-plate">
                                                <FiTruck />
                                                {v.plateNumber}
                                            </div>
                                            <div className="vehicle-id">ID: {v.id}</div>
                                        </div>
                                        <span className="status-pill-color" style={{ background: statusColor(v.status) }}>
                                            {v.status}
                                        </span>
                                    </div>
                                    <div className="vehicle-route">
                                        <FiNavigation />
                                        {v.route || '—'}
                                    </div>
                                    <div className="capacity-block">
                                        <div className="capacity-row">
                                            <span>Capacity</span>
                                            <strong>{v.totalCapacity} pax</strong>
                                        </div>
                                        <div className="capacity-bar">
                                            <span style={{ width: v.status === 'ACTIVE' ? '60%' : '0%' }} />
                                        </div>
                                    </div>
                                    {v.latitude && v.longitude ? (
                                        <div className="gps-line has">
                                            <FiMapPin />
                                            GPS: {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                                        </div>
                                    ) : (
                                        <div className="gps-line none">
                                            <FiMapPin />
                                            No GPS data
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* ── Add Vehicle Modal ── */}
            {showModal && (
                <div className="modal-overlay" onClick={handleClose}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>

                        <div className="admin-modal-header">
                            <div className="admin-modal-title">
                                <span className="section-icon"><FiTruck /></span>
                                <h2>Add New Vehicle</h2>
                            </div>
                            <button className="modal-close-btn" onClick={handleClose} aria-label="Close">
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="admin-modal-body" noValidate>

                            {/* Row 1: Plate + Capacity */}
                            <div className="form-row-2">
                                <div className="form-group">
                                    <label className="form-label">
                                        Plate Number <span className="required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className={`form-input ${formErrors.plateNumber ? 'error' : ''}`}
                                        placeholder="e.g. ABC-1234"
                                        value={form.plateNumber}
                                        onChange={e => setForm(f => ({ ...f, plateNumber: e.target.value }))}
                                    />
                                    {formErrors.plateNumber && (
                                        <span className="form-error">{formErrors.plateNumber}</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Capacity (pax) <span className="required">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        className={`form-input ${formErrors.totalCapacity ? 'error' : ''}`}
                                        placeholder="e.g. 30"
                                        value={form.totalCapacity}
                                        onChange={e => setForm(f => ({ ...f, totalCapacity: e.target.value }))}
                                    />
                                    {formErrors.totalCapacity && (
                                        <span className="form-error">{formErrors.totalCapacity}</span>
                                    )}
                                </div>
                            </div>

                            {/* Row 2: Route + Status */}
                            <div className="form-row-2">
                                <div className="form-group">
                                    <label className="form-label">
                                        Route <span className="required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className={`form-input ${formErrors.route ? 'error' : ''}`}
                                        placeholder="e.g. SM Batanga → SM Lipa"
                                        value={form.route}
                                        onChange={e => setForm(f => ({ ...f, route: e.target.value }))}
                                    />
                                    {formErrors.route && (
                                        <span className="form-error">{formErrors.route}</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select
                                        className="form-input form-select"
                                        value={form.status}
                                        onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                    >
                                        {VEHICLE_STATUSES.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
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
                                            Add Vehicle
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

export default VehiclesPage;