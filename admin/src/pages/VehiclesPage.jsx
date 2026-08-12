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
import { useRealtime } from '../context/RealtimeContext';

const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE'];

const EMPTY_FORM = {
    plateNumber: '',
    totalCapacity: '',
    status: 'INACTIVE',
    driverId: '',
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
    const { subscribe } = useRealtime();
    const [vehicles, setVehicles] = useState([]);
    const [devices, setDevices] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
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
            const [vehiclesRes, devicesRes, driversRes, assignmentsRes] = await Promise.all([
                adminAPI.get('/vehicles'),
                adminAPI.get('/devices'),
                adminAPI.get('/drivers'),
                adminAPI.get('/fleet-assignments'),
            ]);
            setVehicles(vehiclesRes.data.data || []);
            setDevices(devicesRes.data.data || []);
            setDrivers(driversRes.data.data || []);
            setAssignments(assignmentsRes.data.data || []);
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

    useEffect(() => subscribe((event) => {
        if (['VEHICLE', 'DRIVER', 'DEVICE', 'FLEET_ASSIGNMENT'].includes(event.entity)) fetchVehicles();
    }), [subscribe]);

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
        const assignment = assignments.find(item => item.vehicleId === vehicle.id);
        setEditingVehicle(vehicle);
        setForm({
            plateNumber: vehicle.plateNumber || '',
            totalCapacity: String(vehicle.totalCapacity || ''),
            status: vehicle.status || 'INACTIVE',
            driverId: assignment ? String(assignment.driverId) : '',
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

            let savedVehicleId;
            if (editingVehicle) {
                await adminAPI.put(`/vehicles/${editingVehicle.id}`, payload);
                savedVehicleId = editingVehicle.id;
                toast.success('Vehicle updated');
            } else {
                const response = await adminAPI.post('/vehicles', payload);
                savedVehicleId = response.data?.data?.id;
                toast.success(`Vehicle ${payload.plateNumber} added`);
            }

            const currentAssignment = assignments.find(item => item.vehicleId === savedVehicleId);
            if (form.driverId) {
                await adminAPI.post('/fleet-assignments', {
                    driverId: Number(form.driverId),
                    vehicleId: savedVehicleId,
                });
            } else if (currentAssignment) {
                await adminAPI.delete(`/fleet-assignments/${currentAssignment.id}`);
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

    const filtered = vehicles.filter(v => {
        const query = search.trim().toLowerCase();
        const matchesSearch = !query || [v.plateNumber, v.status, v.id, v.totalCapacity]
            .some(value => String(value ?? '').toLowerCase().includes(query));
        return matchesSearch && (statusFilter === 'ALL' || v.status === statusFilter);
    });

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

                <section className={ui.filterPanel}>
                    <h2 className={ui.filterPanelTitle}>Filter Vehicles</h2>
                    <div className={ui.filterBar}>
                        <label className={`${ui.filterGroup} flex-[1_1_18rem]`}>
                            <span className={ui.filterLabel}>Search</span>
                            <div className="relative"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input type="search" placeholder="Plate number, ID, capacity..." value={search} onChange={e => setSearch(e.target.value)} className={`${ui.filterSearch} w-full pl-9`} /></div>
                        </label>
                        <label className={ui.filterGroup}><span className={ui.filterLabel}>Status</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={ui.filterField}><option value="ALL">All Statuses</option>{VEHICLE_STATUSES.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
                        <button type="button" onClick={() => { setSearch(''); setStatusFilter('ALL'); }} className={ui.filterReset}>Reset</button>
                    </div>
                </section>

                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}><span className={ui.dataPanelTitle}><FiTruck /> Vehicles <span className={ui.countPill}>{filtered.length} shown</span></span></div>

                    <div className={ui.tableWrap}>
                        <table className={`${ui.adminTable} min-w-[800px]`}>
                            <thead><tr>{['ID', 'Plate Number', 'Capacity', 'Device', 'Status', 'Actions'].map(header => <th key={header} className={ui.tableTh}>{header}</th>)}</tr></thead>
                            <tbody>{loading ? <tr><td colSpan={6} className={ui.loadingRow}>Loading vehicles...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className={ui.emptyRow}>No vehicles found.</td></tr> : filtered.map(v => {
                                const linkedDevice = getLinkedDevice(v);
                                return <tr key={v.id} className={ui.tableRow}>
                                    <td className={`${ui.tableTd} font-black`}>{v.id}</td>
                                    <td className={`${ui.tableTd} font-black text-maroon`}><span className="inline-flex items-center gap-2"><FiTruck />{v.plateNumber}</span></td>
                                    <td className={ui.tableTd}>{v.totalCapacity} pax</td>
                                    <td className={ui.tableTd}><span className={`inline-flex items-center gap-1.5 ${linkedDevice ? 'text-green-brand' : 'text-text-muted'}`}><FiCpu />{linkedDevice ? linkedDevice.deviceId : 'No device registered'}</span></td>
                                    <td className={ui.tableTd}><span className={ui.statusPillColor} style={{ background: statusColor(v.status) }}>{v.status}</span></td>
                                    <td className={ui.tableTd}><div className="inline-flex gap-2"><button type="button" onClick={() => openEditModal(v)} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-gold px-3 text-[0.78rem] font-black text-maroon hover:bg-[#d9ad35]"><FiEdit2 /> Edit</button><button type="button" disabled={deletingId === v.id} onClick={() => handleDelete(v)} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-danger-muted px-3 text-[0.78rem] font-black text-white hover:bg-[#9f283f] disabled:cursor-not-allowed disabled:opacity-60"><FiTrash2 /> {deletingId === v.id ? 'Deleting...' : 'Delete'}</button></div></td>
                                </tr>;
                            })}</tbody>
                        </table>
                    </div>
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

                            <div className="flex flex-col gap-[0.32rem]">
                                <label className="text-[0.86rem] font-extrabold text-[#343946]">Assigned Driver</label>
                                <select className={`${formInputCls(false)} select-arrow cursor-pointer`} value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                                    <option value="">No driver assigned</option>
                                    {drivers.map(driver => (
                                        <option key={driver.id} value={driver.id}>{driver.fullName} ({driver.licenseNumber})</option>
                                    ))}
                                </select>
                                <span className="text-[0.74rem] font-semibold text-text-muted">A driver can have only one active vehicle assignment.</span>
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
