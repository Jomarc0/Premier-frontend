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
import * as ui from '../components/adminUI';

const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE'];

const EMPTY_FORM = {
    plateNumber: '',
    totalCapacity: '',
    route: '',
    status: 'INACTIVE',
};

const VehicleStatVariants = {
    '':            { card: 'border-l-maroon',      icon: 'bg-maroon/10 text-maroon',           num: 'text-maroon'      },
    active:        { card: 'border-l-green-brand', icon: 'bg-green-brand/10 text-green-brand', num: 'text-green-brand' },
    inactive:      { card: 'border-l-text-muted',  icon: 'bg-text-muted/15 text-text-muted',   num: 'text-text-muted'  },
    maintenance:   { card: 'border-l-gold',        icon: 'bg-gold/20 text-[#b78a0e]',          num: 'text-[#b78a0e]'   },
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
        return <div className={ui.fullLoading}>Loading...</div>;
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

    const formInputCls = (hasError) =>
        `w-full px-[0.9rem] py-[0.68rem] border-2 rounded-lg text-[0.92rem] text-text-main outline-none bg-white transition-all box-border ${
            hasError
                ? 'border-danger-muted focus:shadow-[0_0_0_3px_rgba(178,74,82,0.12)]'
                : 'border-[#d9dce2] focus:border-gold focus:shadow-[0_0_0_3px_rgba(232,189,71,0.18)]'
        }`;

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>

                {/* Header */}
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Fleet Management</span>
                        <h1 className={ui.headerTitle}>Vehicles</h1>
                        <p className="mt-1 mb-0 text-text-muted text-[0.82rem]">
                            {vehicles.length} total vehicles
                        </p>
                    </div>
                    <div className="flex gap-[0.65rem] items-center">
                        <button type="button" onClick={fetchVehicles} className={ui.adminActionRefresh}>
                            <FiRefreshCw />
                            Refresh
                        </button>
                        <button type="button" onClick={() => setShowModal(true)} className={ui.adminActionPrimary}>
                            <FiPlus />
                            Add Vehicle
                        </button>
                    </div>
                </header>

                {/* Stats */}
                <section className="grid grid-cols-4 gap-[0.85rem] mb-[1.1rem] max-[860px]:grid-cols-2 max-[560px]:grid-cols-1" aria-label="Vehicle status summary">
                    {[
                        { label: 'Total',       value: vehicles.length,                                         variant: '',            Icon: FiTruck       },
                        { label: 'Active',      value: vehicles.filter(v => v.status === 'ACTIVE').length,      variant: 'active',      Icon: FiCheckCircle },
                        { label: 'Inactive',    value: vehicles.filter(v => v.status === 'INACTIVE').length,    variant: 'inactive',    Icon: FiPauseCircle },
                        { label: 'Maintenance', value: vehicles.filter(v => v.status === 'MAINTENANCE').length, variant: 'maintenance', Icon: FiTool        },
                    ].map((s, i) => {
                        const v = VehicleStatVariants[s.variant];
                        return (
                            <article
                                key={i}
                                className={`bg-white rounded-lg px-[1.05rem] py-[0.95rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)] flex items-center gap-3 border-l-4 ${v.card}`}
                            >
                                <div className={`w-[2.4rem] h-[2.4rem] rounded-lg grid place-items-center text-[1.05rem] ${v.icon}`}>
                                    <s.Icon />
                                </div>
                                <div>
                                    <div className={`text-[1.4rem] font-black leading-none ${v.num}`}>{s.value}</div>
                                    <div className="text-[0.72rem] text-text-muted font-extrabold uppercase tracking-[0.04em] mt-[0.15rem]">{s.label}</div>
                                </div>
                            </article>
                        );
                    })}
                </section>

                {/* Vehicle Cards Container */}
                <section className={ui.dataPanel}>
                    <div className="px-5 py-4 border-b border-border-soft">
                        <div className={`${ui.fieldInput} mb-0`}>
                            <FiSearch />
                            <input
                                type="text"
                                placeholder="Search plate number or route..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={ui.fieldInputEl}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center p-10 text-text-muted italic">Loading vehicles...</div>
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4 p-5">
                            {filtered.length === 0 ? (
                                <div className="col-span-full text-center p-10 text-text-muted italic">
                                    No vehicles found
                                </div>
                            ) : filtered.map(v => (
                                <div
                                    key={v.id}
                                    className="border-[1.5px] border-border-soft rounded-[10px] p-4 bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(44,36,41,0.10)] hover:border-gold"
                                >
                                    <div className="flex justify-between items-start mb-[0.85rem]">
                                        <div>
                                            <div className="text-[1.05rem] font-black text-maroon tracking-[0.04em] inline-flex items-center gap-[0.35rem]">
                                                <FiTruck />
                                                {v.plateNumber}
                                            </div>
                                            <div className="text-[0.7rem] text-text-muted mt-[0.15rem]">ID: {v.id}</div>
                                        </div>
                                        <span className={ui.statusPillColor} style={{ background: statusColor(v.status) }}>
                                            {v.status}
                                        </span>
                                    </div>
                                    <div className="text-[0.8rem] text-text-main mb-[0.85rem] inline-flex items-center gap-[0.35rem]">
                                        <FiNavigation />
                                        {v.route || '—'}
                                    </div>
                                    <div className="mb-[0.7rem]">
                                        <div className="flex justify-between text-[0.72rem] text-text-muted mb-[0.3rem]">
                                            <span>Capacity</span>
                                            <strong className="text-text-main font-black">{v.totalCapacity} pax</strong>
                                        </div>
                                        <div className="h-[0.4rem] bg-page-bg rounded-full overflow-hidden">
                                            <span
                                                className="block h-full bg-green-brand rounded-full transition-[width] duration-300"
                                                style={{ width: v.status === 'ACTIVE' ? '60%' : '0%' }}
                                            />
                                        </div>
                                    </div>
                                    {v.latitude && v.longitude ? (
                                        <div className="text-[0.74rem] font-extrabold inline-flex items-center gap-[0.35rem] text-green-brand">
                                            <FiMapPin />
                                            GPS: {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                                        </div>
                                    ) : (
                                        <div className="text-[0.74rem] font-extrabold inline-flex items-center gap-[0.35rem] text-text-muted">
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
                <div
                    className="fixed inset-0 bg-[rgba(53,47,51,0.6)] flex items-center justify-center z-100 p-4 backdrop-blur-[2px]"
                    onClick={handleClose}
                >
                    <div
                        className="admin-modal-anim bg-white rounded-xl w-full max-w-140 max-h-[90vh] flex flex-col overflow-hidden shadow-[0_32px_80px_rgba(44,36,41,0.28)]"
                        onClick={e => e.stopPropagation()}
                    >

                        <div className="flex items-center justify-between px-[1.35rem] py-[1.1rem] bg-maroon shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="inline-grid place-items-center w-[2.2rem] h-[2.2rem] rounded-lg bg-white/20 text-white text-base shrink-0">
                                    <FiTruck />
                                </span>
                                <h2 className="m-0 text-white text-[1.05rem] font-black">Add New Vehicle</h2>
                            </div>
                            <button
                                className="grid place-items-center w-8 h-8 rounded-md bg-white/15 text-white text-[1.05rem] cursor-pointer transition-colors hover:bg-white/30"
                                onClick={handleClose}
                                aria-label="Close"
                            >
                                <FiX />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} noValidate className="overflow-y-auto px-[1.35rem] py-[1.4rem] flex flex-col gap-[0.95rem]">

                            {/* Row 1: Plate + Capacity */}
                            <div className="grid grid-cols-2 gap-[0.85rem] max-[860px]:grid-cols-1">
                                <div className="flex flex-col gap-[0.32rem]">
                                    <label className="text-[0.86rem] font-extrabold text-[#343946]">
                                        Plate Number <span className="text-danger-muted">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className={formInputCls(formErrors.plateNumber)}
                                        placeholder="e.g. ABC-1234"
                                        value={form.plateNumber}
                                        onChange={e => setForm(f => ({ ...f, plateNumber: e.target.value }))}
                                    />
                                    {formErrors.plateNumber && (
                                        <span className="text-[0.76rem] text-danger-muted font-bold">{formErrors.plateNumber}</span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-[0.32rem]">
                                    <label className="text-[0.86rem] font-extrabold text-[#343946]">
                                        Capacity (pax) <span className="text-danger-muted">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        className={formInputCls(formErrors.totalCapacity)}
                                        placeholder="e.g. 30"
                                        value={form.totalCapacity}
                                        onChange={e => setForm(f => ({ ...f, totalCapacity: e.target.value }))}
                                    />
                                    {formErrors.totalCapacity && (
                                        <span className="text-[0.76rem] text-danger-muted font-bold">{formErrors.totalCapacity}</span>
                                    )}
                                </div>
                            </div>

                            {/* Row 2: Route + Status */}
                            <div className="grid grid-cols-2 gap-[0.85rem] max-[860px]:grid-cols-1">
                                <div className="flex flex-col gap-[0.32rem]">
                                    <label className="text-[0.86rem] font-extrabold text-[#343946]">
                                        Route <span className="text-danger-muted">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className={formInputCls(formErrors.route)}
                                        placeholder="e.g. SM Batanga → SM Lipa"
                                        value={form.route}
                                        onChange={e => setForm(f => ({ ...f, route: e.target.value }))}
                                    />
                                    {formErrors.route && (
                                        <span className="text-[0.76rem] text-danger-muted font-bold">{formErrors.route}</span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-[0.32rem]">
                                    <label className="text-[0.86rem] font-extrabold text-[#343946]">Status</label>
                                    <select
                                        className={`${formInputCls(false)} select-arrow cursor-pointer`}
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
                            <div className="flex justify-end gap-[0.6rem] pt-2 border-t border-border-soft mt-[0.15rem] max-[560px]:flex-col-reverse">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="inline-flex items-center justify-center gap-[0.4rem] min-h-[2.55rem] px-5 rounded-lg bg-white border-[1.5px] border-border-soft text-text-muted text-[0.88rem] font-extrabold cursor-pointer transition-colors hover:border-maroon-soft hover:text-maroon max-[560px]:w-full"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-[0.45rem] min-h-[2.55rem] px-[1.4rem] rounded-lg bg-maroon text-white text-[0.88rem] font-black cursor-pointer transition-all hover:bg-maroon-dark hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(111,47,60,0.28)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:transform-none max-[560px]:w-full"
                                >
                                    {saving ? (
                                        <>
                                            <span className="btn-spinner-anim inline-block w-[0.9rem] h-[0.9rem] border-2 border-white/35 border-t-white rounded-full shrink-0" />
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
