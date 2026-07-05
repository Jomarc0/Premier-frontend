import { useEffect, useState } from 'react';
import {
    FiRefreshCw,
    FiSearch,
    FiTruck,
    FiCheckCircle,
    FiPauseCircle,
    FiTool,
    FiPlus,
    FiX,
    FiEdit2,
    FiTrash2,
    FiCpu,
    FiCopy,
    FiKey,
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
    status: 'INACTIVE',
};

const EMPTY_DEVICE_FORM = {
    deviceId: '',
    deviceName: '',
    deviceType: 'VEHICLE_TERMINAL',
};

const VehicleStatVariants = {
    '': { card: 'border-l-maroon', icon: 'bg-maroon/10 text-maroon', num: 'text-maroon' },
    active: { card: 'border-l-green-brand', icon: 'bg-green-brand/10 text-green-brand', num: 'text-green-brand' },
    inactive: { card: 'border-l-text-muted', icon: 'bg-text-muted/15 text-text-muted', num: 'text-text-muted' },
    maintenance: { card: 'border-l-gold', icon: 'bg-gold/20 text-[#b78a0e]', num: 'text-[#b78a0e]' },
};


const VehiclesPage = () => {
    const auth = useAdminAuth();
    const [vehicles, setVehicles] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [formErrors, setFormErrors] = useState({});
    const [deviceVehicle, setDeviceVehicle] = useState(null);
    const [deviceForm, setDeviceForm] = useState(EMPTY_DEVICE_FORM);
    const [deviceErrors, setDeviceErrors] = useState({});
    const [deviceSaving, setDeviceSaving] = useState(false);
    const [deviceToken, setDeviceToken] = useState('');
    const [copiedToken, setCopiedToken] = useState(false);

    useEffect(() => {
        if (auth.loading) return;
        fetchVehicles();
    }, [auth.loading]);

    const fetchVehicles = async () => {
        setLoading(true);
        try {
            const [vehiclesRes, devicesRes] = await Promise.all([
                adminAPI.get('/vehicles'),
                adminAPI.get('/devices'),
            ]);
            setVehicles(vehiclesRes.data.data || []);
            setDevices(devicesRes.data.data || []);
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

    const openAddModal = () => {
        setEditingVehicle(null);
        setDeviceVehicle(null);
        setDeviceForm(EMPTY_DEVICE_FORM);
        setDeviceErrors({});
        setDeviceToken('');
        setCopiedToken(false);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setShowModal(true);
    };

    const openEditModal = (vehicle) => {
        setEditingVehicle(vehicle);
        setForm({
            plateNumber: vehicle.plateNumber || '',
            totalCapacity: String(vehicle.totalCapacity || ''),
            status: vehicle.status || 'INACTIVE',
        });
        const normalizedPlate = String(vehicle.plateNumber || '').trim().toUpperCase();
        setDeviceVehicle(vehicle);
        setDeviceForm({
            deviceId: `bus-${vehicle.id}`,
            deviceName: `${normalizedPlate} ESP32 Terminal`,
            deviceType: 'VEHICLE_TERMINAL',
        });
        setDeviceErrors({});
        setDeviceToken('');
        setCopiedToken(false);
        setFormErrors({});
        setShowModal(true);
    };

    const validateForm = () => {
        const errors = {};
        if (!form.plateNumber.trim()) errors.plateNumber = 'Plate number is required';
        if (!form.totalCapacity || isNaN(form.totalCapacity) || Number(form.totalCapacity) < 1) {
            errors.totalCapacity = 'Valid capacity is required';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSaving(true);
        try {
            const payload = {
                plateNumber: form.plateNumber.trim().toUpperCase(),
                totalCapacity: Number(form.totalCapacity),
                status: form.status,
            };

            if (editingVehicle) {
                await adminAPI.put(`/vehicles/${editingVehicle.id}`, payload);
                toast.success('Vehicle updated');
            } else {
                await adminAPI.post('/vehicles', payload);
                toast.success(`Vehicle ${payload.plateNumber} added`);
            }

            handleClose();
            fetchVehicles();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save vehicle');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (vehicle) => {
        const confirmed = window.confirm(`Delete vehicle ${vehicle.plateNumber || vehicle.id}?`);
        if (!confirmed) return;

        setDeletingId(vehicle.id);
        try {
            await adminAPI.delete(`/vehicles/${vehicle.id}`);
            toast.success('Vehicle deleted');
            fetchVehicles();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete vehicle. It may still be used by shifts or assignments.');
        } finally {
            setDeletingId(null);
        }
    };

    const validateDeviceForm = () => {
        const errors = {};
        if (!deviceForm.deviceId.trim()) errors.deviceId = 'Device ID is required';
        if (!deviceForm.deviceName.trim()) errors.deviceName = 'Device name is required';
        setDeviceErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleRegisterDevice = async () => {
        if (!deviceVehicle || !validateDeviceForm()) return;

        setDeviceSaving(true);
        try {
            const payload = {
                deviceId: deviceForm.deviceId.trim(),
                deviceName: deviceForm.deviceName.trim(),
                deviceType: deviceForm.deviceType,
                vehicleId: deviceVehicle.id,
                status: 'ACTIVE',
            };
            const res = await adminAPI.post('/devices', payload);
            const token = res.data?.data?.oneTimeDeviceToken || '';
            setDeviceToken(token);
            toast.success('ESP32 device registered. Copy the token now.');
            fetchVehicles();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to register ESP32 device');
        } finally {
            setDeviceSaving(false);
        }
    };

    const handleRotateDeviceToken = async (device) => {
        if (!device?.id) return;
        const confirmed = window.confirm(`Rotate token for ${device.deviceId}? The old ESP32 token will stop working.`);
        if (!confirmed) return;

        setDeviceSaving(true);
        try {
            const res = await adminAPI.post(`/devices/${device.id}/rotate-token`);
            const token = res.data?.data?.oneTimeDeviceToken || '';
            setDeviceToken(token);
            setCopiedToken(false);
            toast.success('Device token rotated. Copy the new token now.');
            fetchVehicles();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to rotate device token');
        } finally {
            setDeviceSaving(false);
        }
    };

    const handleCopyToken = async () => {
        if (!deviceToken) return;
        try {
            await navigator.clipboard.writeText(deviceToken);
            setCopiedToken(true);
            window.setTimeout(() => setCopiedToken(false), 1500);
        } catch {
            toast.info('Select and copy the token manually.');
        }
    };

    const handleClose = () => {
        setShowModal(false);
        setEditingVehicle(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setDeviceVehicle(null);
        setDeviceForm(EMPTY_DEVICE_FORM);
        setDeviceErrors({});
        setDeviceToken('');
        setCopiedToken(false);
    };

    if (auth.loading) return <div className={ui.fullLoading}>Loading...</div>;

    const filtered = vehicles.filter(v =>
        v.plateNumber?.toLowerCase().includes(search.toLowerCase()) ||
        v.status?.toLowerCase().includes(search.toLowerCase())
    );

    const normalizePlate = (value) => String(value || '').trim().toUpperCase();

    const getLinkedDevice = (vehicle) => devices.find(device =>
        Number(device.vehicleId) === Number(vehicle.id) ||
        normalizePlate(device.plateNumber) === normalizePlate(vehicle.plateNumber)
    );

    const editingLinkedDevice = editingVehicle ? getLinkedDevice(editingVehicle) : null;

    const statusColor = (status) => ({
        ACTIVE: '#2f6b3d',
        INACTIVE: '#717680',
        MAINTENANCE: '#d97706',
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
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Fleet Management</span>
                        <h1 className={ui.headerTitle}>Vehicles</h1>
                        <p className="mt-1 mb-0 text-text-muted text-[0.82rem]">{vehicles.length} total vehicles</p>
                    </div>
                    <div className="flex gap-[0.65rem] items-center">
                        <button type="button" onClick={fetchVehicles} className={ui.adminActionRefresh}>
                            <FiRefreshCw /> Refresh
                        </button>
                        <button type="button" onClick={openAddModal} className={ui.adminActionPrimary}>
                            <FiPlus /> Add Vehicle
                        </button>
                    </div>
                </header>

                <section className="grid grid-cols-4 gap-[0.85rem] mb-[1.1rem] max-[860px]:grid-cols-2 max-[560px]:grid-cols-1" aria-label="Vehicle status summary">
                    {[
                        { label: 'Total', value: vehicles.length, variant: '', Icon: FiTruck },
                        { label: 'Active', value: vehicles.filter(v => v.status === 'ACTIVE').length, variant: 'active', Icon: FiCheckCircle },
                        { label: 'Inactive', value: vehicles.filter(v => v.status === 'INACTIVE').length, variant: 'inactive', Icon: FiPauseCircle },
                        { label: 'Maintenance', value: vehicles.filter(v => v.status === 'MAINTENANCE').length, variant: 'maintenance', Icon: FiTool },
                    ].map((s, i) => {
                        const v = VehicleStatVariants[s.variant];
                        return (
                            <article key={i} className={`bg-white rounded-lg px-[1.05rem] py-[0.95rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)] flex items-center gap-3 border-l-4 ${v.card}`}>
                                <div className={`w-[2.4rem] h-[2.4rem] rounded-lg grid place-items-center text-[1.05rem] ${v.icon}`}><s.Icon /></div>
                                <div>
                                    <div className={`text-[1.4rem] font-black leading-none ${v.num}`}>{s.value}</div>
                                    <div className="text-[0.72rem] text-text-muted font-extrabold uppercase tracking-[0.04em] mt-[0.15rem]">{s.label}</div>
                                </div>
                            </article>
                        );
                    })}
                </section>

                <section className={ui.dataPanel}>
                    <div className="px-5 py-4 border-b border-border-soft">
                        <div className={`${ui.fieldInput} mb-0`}>
                            <FiSearch />
                            <input type="text" placeholder="Search plate or status..." value={search} onChange={e => setSearch(e.target.value)} className={ui.fieldInputEl} />
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center p-10 text-text-muted italic">Loading vehicles...</div>
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4 p-5">
                            {filtered.length === 0 ? (
                                <div className="col-span-full text-center p-10 text-text-muted italic">No vehicles found</div>
                            ) : filtered.map(v => {
                                const linkedDevice = getLinkedDevice(v);
                                return (
                                    <div key={v.id} className="border-[1.5px] border-border-soft rounded-[10px] p-4 bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(44,36,41,0.10)] hover:border-gold">
                                        <div className="flex justify-between items-start mb-[0.85rem]">
                                            <div>
                                                <div className="text-[1.05rem] font-black text-maroon tracking-[0.04em] inline-flex items-center gap-[0.35rem]"><FiTruck />{v.plateNumber}</div>
                                                <div className="text-[0.7rem] text-text-muted mt-[0.15rem]">ID: {v.id}</div>
                                            </div>
                                            <span className={ui.statusPillColor} style={{ background: statusColor(v.status) }}>{v.status}</span>
                                        </div>
                                        <div className="mb-[0.7rem]">
                                            <div className="flex justify-between text-[0.72rem] text-text-muted mb-[0.3rem]">
                                                <span>Capacity</span><strong className="text-text-main font-black">{v.totalCapacity} pax</strong>
                                            </div>
                                            <div className="h-[0.4rem] bg-page-bg rounded-full overflow-hidden">
                                                <span className="block h-full bg-green-brand rounded-full transition-[width] duration-300" style={{ width: v.status === 'ACTIVE' ? '60%' : '0%' }} />
                                            </div>
                                        </div>
                                        <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-black ${linkedDevice ? 'bg-green-brand/10 text-green-brand' : 'bg-text-muted/10 text-text-muted'}`}>
                                            <FiCpu /> {linkedDevice ? `Device Activated: ${linkedDevice.deviceId}` : 'No device registered'}
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-border-soft flex flex-wrap gap-2">
                                            <button type="button" onClick={() => openEditModal(v)} className="inline-flex items-center gap-[0.35rem] min-h-8 px-3 rounded-md bg-gold text-maroon text-[0.78rem] font-black cursor-pointer hover:bg-[#d9ad35]"><FiEdit2 /> Edit</button>
                                            <button type="button" disabled={deletingId === v.id} onClick={() => handleDelete(v)} className="inline-flex items-center gap-[0.35rem] min-h-8 px-3 rounded-md bg-danger-muted text-white text-[0.78rem] font-black cursor-pointer hover:bg-[#9f283f] disabled:opacity-60 disabled:cursor-not-allowed"><FiTrash2 /> {deletingId === v.id ? 'Deleting...' : 'Delete'}</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>

            {showModal && (
                <div className="fixed inset-0 bg-[rgba(53,47,51,0.6)] flex items-center justify-center z-100 p-4 backdrop-blur-[2px]" onClick={handleClose}>
                    <div className="admin-modal-anim bg-white rounded-xl w-full max-w-140 max-h-[90vh] flex flex-col overflow-hidden shadow-[0_32px_80px_rgba(44,36,41,0.28)]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-[1.35rem] py-[1.1rem] bg-maroon shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="inline-grid place-items-center w-[2.2rem] h-[2.2rem] rounded-lg bg-white/20 text-white text-base shrink-0"><FiTruck /></span>
                                <h2 className="m-0 text-white text-[1.05rem] font-black">{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
                            </div>
                            <button className="grid place-items-center w-8 h-8 rounded-md bg-white/15 text-white text-[1.05rem] cursor-pointer transition-colors hover:bg-white/30" onClick={handleClose} aria-label="Close"><FiX /></button>
                        </div>

                        <form onSubmit={handleSubmit} noValidate className="overflow-y-auto px-[1.35rem] py-[1.4rem] flex flex-col gap-[0.95rem]">
                            <div className="grid grid-cols-2 gap-[0.85rem] max-[860px]:grid-cols-1">
                                <div className="flex flex-col gap-[0.32rem]">
                                    <label className="text-[0.86rem] font-extrabold text-[#343946]">Plate Number <span className="text-danger-muted">*</span></label>
                                    <input type="text" className={formInputCls(formErrors.plateNumber)} placeholder="e.g. ABC-1234" value={form.plateNumber} onChange={e => setForm(f => ({ ...f, plateNumber: e.target.value }))} />
                                    {formErrors.plateNumber && <span className="text-[0.76rem] text-danger-muted font-bold">{formErrors.plateNumber}</span>}
                                </div>
                                <div className="flex flex-col gap-[0.32rem]">
                                    <label className="text-[0.86rem] font-extrabold text-[#343946]">Capacity (pax) <span className="text-danger-muted">*</span></label>
                                    <input type="number" min="1" className={formInputCls(formErrors.totalCapacity)} placeholder="e.g. 30" value={form.totalCapacity} onChange={e => setForm(f => ({ ...f, totalCapacity: e.target.value }))} />
                                    {formErrors.totalCapacity && <span className="text-[0.76rem] text-danger-muted font-bold">{formErrors.totalCapacity}</span>}
                                </div>
                            </div>

                            <div className="flex flex-col gap-[0.32rem]">
                                <label className="text-[0.86rem] font-extrabold text-[#343946]">Status</label>
                                <select className={`${formInputCls(false)} select-arrow cursor-pointer`} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                    {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {editingVehicle && (
                                <section className="rounded-xl border border-border-soft bg-page-bg p-4">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <h3 className="m-0 text-[0.92rem] font-black text-maroon inline-flex items-center gap-2"><FiCpu /> ESP32 Device</h3>
                                            <p className="m-0 mt-1 text-xs font-semibold text-text-muted">
                                                This links the physical ESP32 terminal to this vehicle.
                                            </p>
                                        </div>
                                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-black ${editingLinkedDevice ? 'bg-green-brand/10 text-green-brand' : 'bg-text-muted/10 text-text-muted'}`}>
                                            {editingLinkedDevice ? 'Registered' : 'Not registered'}
                                        </span>
                                    </div>

                                    {editingLinkedDevice ? (
                                        <div className="flex flex-col gap-3">
                                            <div className="grid grid-cols-2 gap-[0.85rem] max-[860px]:grid-cols-1">
                                                <div className="flex flex-col gap-[0.32rem]">
                                                    <label className="text-[0.78rem] font-extrabold text-[#343946]">Device ID</label>
                                                    <input type="text" className={formInputCls(false)} value={editingLinkedDevice.deviceId || ''} disabled />
                                                </div>
                                                <div className="flex flex-col gap-[0.32rem]">
                                                    <label className="text-[0.78rem] font-extrabold text-[#343946]">Device Status</label>
                                                    <input type="text" className={formInputCls(false)} value={editingLinkedDevice.status || 'ACTIVE'} disabled />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-[0.32rem]">
                                                <label className="text-[0.78rem] font-extrabold text-[#343946]">Device Name</label>
                                                <input type="text" className={formInputCls(false)} value={editingLinkedDevice.deviceName || ''} disabled />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRotateDeviceToken(editingLinkedDevice)}
                                                disabled={deviceSaving}
                                                className="self-start inline-flex items-center justify-center gap-[0.4rem] min-h-[2.3rem] px-4 rounded-lg bg-maroon text-white text-[0.82rem] font-black cursor-pointer transition-colors hover:bg-maroon-dark disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                <FiKey /> {deviceSaving ? 'Rotating...' : 'Rotate Device Token'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <div className="rounded-lg border border-border-soft bg-white p-3 text-sm text-text-muted">
                                                Register this bus terminal here. The token will be shown once, then copied into the ESP32 <strong>secrets.h</strong>.
                                            </div>
                                            <div className="grid grid-cols-2 gap-[0.85rem] max-[860px]:grid-cols-1">
                                                <div className="flex flex-col gap-[0.32rem]">
                                                    <label className="text-[0.78rem] font-extrabold text-[#343946]">Device ID <span className="text-danger-muted">*</span></label>
                                                    <input
                                                        type="text"
                                                        className={formInputCls(deviceErrors.deviceId)}
                                                        value={deviceForm.deviceId}
                                                        disabled={Boolean(deviceToken)}
                                                        onChange={e => setDeviceForm(f => ({ ...f, deviceId: e.target.value }))}
                                                    />
                                                    {deviceErrors.deviceId && <span className="text-[0.76rem] text-danger-muted font-bold">{deviceErrors.deviceId}</span>}
                                                </div>
                                                <div className="flex flex-col gap-[0.32rem]">
                                                    <label className="text-[0.78rem] font-extrabold text-[#343946]">Device Type</label>
                                                    <input type="text" className={formInputCls(false)} value={deviceForm.deviceType} disabled />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-[0.32rem]">
                                                <label className="text-[0.78rem] font-extrabold text-[#343946]">Device Name <span className="text-danger-muted">*</span></label>
                                                <input
                                                    type="text"
                                                    className={formInputCls(deviceErrors.deviceName)}
                                                    value={deviceForm.deviceName}
                                                    disabled={Boolean(deviceToken)}
                                                    onChange={e => setDeviceForm(f => ({ ...f, deviceName: e.target.value }))}
                                                />
                                                {deviceErrors.deviceName && <span className="text-[0.76rem] text-danger-muted font-bold">{deviceErrors.deviceName}</span>}
                                            </div>
                                            {!deviceToken && (
                                                <button
                                                    type="button"
                                                    onClick={handleRegisterDevice}
                                                    disabled={deviceSaving}
                                                    className="self-start inline-flex items-center justify-center gap-[0.4rem] min-h-[2.3rem] px-4 rounded-lg bg-maroon text-white text-[0.82rem] font-black cursor-pointer transition-colors hover:bg-maroon-dark disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    <FiCpu /> {deviceSaving ? 'Registering...' : 'Register ESP32 Device'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {deviceToken && (
                                        <div className="mt-4 rounded-lg border-2 border-gold bg-[#fffbea] p-4">
                                            <p className="m-0 mb-2 text-[0.82rem] font-black uppercase tracking-[0.08em] text-maroon">One-time device token</p>
                                            <div className="flex items-center gap-2 rounded-lg bg-white p-3 border border-border-soft">
                                                <code className="min-w-0 flex-1 break-all text-[0.82rem] font-black text-text-main">{deviceToken}</code>
                                                <button type="button" onClick={handleCopyToken} className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-md bg-maroon text-white hover:bg-maroon-dark" aria-label="Copy token">
                                                    <FiCopy />
                                                </button>
                                            </div>
                                            <p className="m-0 mt-2 text-xs font-semibold text-text-muted">
                                                {copiedToken ? 'Copied.' : 'Copy this now. It will not be shown again after you close this modal.'}
                                            </p>
                                        </div>
                                    )}
                                </section>
                            )}

                            <div className="flex justify-end gap-[0.6rem] pt-2 border-t border-border-soft mt-[0.15rem] max-[560px]:flex-col-reverse">
                                <button type="button" onClick={handleClose} className="inline-flex items-center justify-center gap-[0.4rem] min-h-[2.55rem] px-5 rounded-lg bg-white border-[1.5px] border-border-soft text-text-muted text-[0.88rem] font-extrabold cursor-pointer transition-colors hover:border-maroon-soft hover:text-maroon max-[560px]:w-full">Cancel</button>
                                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-[0.45rem] min-h-[2.55rem] px-[1.4rem] rounded-lg bg-maroon text-white text-[0.88rem] font-black cursor-pointer transition-all hover:bg-maroon-dark hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(111,47,60,0.28)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:transform-none max-[560px]:w-full">
                                    {saving ? 'Saving...' : <><FiPlus /> {editingVehicle ? 'Save Vehicle' : 'Add Vehicle'}</>}
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
