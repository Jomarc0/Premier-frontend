import { useEffect, useState, useCallback } from 'react';
import {
    FiRefreshCw,
    FiSearch,
    FiUsers,
    FiPlus,
    FiX,
    FiUser,
    FiEdit2,
    FiTrash2,
} from 'react-icons/fi';
import AdminSidebar from '../components/AdminSidebar';
import adminAPI from '../api/adminAxios';
import { useAdminAuth } from '../context/AdminAuthContext';
import { toast } from 'react-toastify';
import * as ui from '../components/adminUI';

const DRIVER_STATUSES = ['ACTIVE', 'INACTIVE', 'ON_BREAK', 'OFF_DUTY'];

const EMPTY_FORM = {
    fullName: '',
    licenseNumber: '',
    phoneNumber: '',
    status: 'INACTIVE',
    vehicleId: '',
};

const DriversPage = () => {
    const auth = useAdminAuth();
    const [drivers, setDrivers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingDriver, setEditingDriver] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [formErrors, setFormErrors] = useState({});

    const fetchDrivers = useCallback(async () => {
        const token = auth.admin?.token || localStorage.getItem('adminToken');
        if (!token) return;

        setLoading(true);
        try {
            const [driversRes, vehiclesRes, assignmentsRes] = await Promise.all([
                adminAPI.get('/drivers?page=0&size=50'),
                adminAPI.get('/vehicles'),
                adminAPI.get('/fleet-assignments'),
            ]);
            setDrivers(driversRes.data.data || []);
            setVehicles(vehiclesRes.data.data || []);
            setAssignments(assignmentsRes.data.data || []);
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

    const openAddModal = () => {
        setEditingDriver(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
        setShowModal(true);
    };

    const openEditModal = (driver) => {
        const assignment = assignments.find(item => item.driverId === driver.id);
        setEditingDriver(driver);
        setForm({
            fullName: driver.fullName || '',
            licenseNumber: driver.licenseNumber || '',
            phoneNumber: driver.phoneNumber || '',
            status: driver.status || 'INACTIVE',
            vehicleId: assignment ? String(assignment.vehicleId) : '',
        });
        setFormErrors({});
        setShowModal(true);
    };

    const validateForm = () => {
        const errors = {};
        if (!form.fullName.trim()) errors.fullName = 'Full name is required';
        if (!form.licenseNumber.trim()) errors.licenseNumber = 'License number is required';
        if (!form.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSaving(true);
        try {
            const payload = {
                fullName: form.fullName.trim(),
                licenseNumber: form.licenseNumber.trim().toUpperCase(),
                phoneNumber: form.phoneNumber.trim(),
                status: form.status,
            };

            let savedDriverId;
            if (editingDriver) {
                await adminAPI.put(`/drivers/${editingDriver.id}`, payload);
                savedDriverId = editingDriver.id;
                toast.success('Driver updated');
            } else {
                const response = await adminAPI.post('/drivers', payload);
                savedDriverId = response.data?.data?.id;
                toast.success(`Driver ${payload.fullName} added`);
            }

            const currentAssignment = assignments.find(item => item.driverId === savedDriverId);
            if (form.vehicleId) {
                await adminAPI.post('/fleet-assignments', {
                    driverId: savedDriverId,
                    vehicleId: Number(form.vehicleId),
                });
            } else if (currentAssignment) {
                await adminAPI.delete(`/fleet-assignments/${currentAssignment.id}`);
            }

            handleClose();
            fetchDrivers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save driver');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (driver) => {
        const confirmed = window.confirm(`Delete driver ${driver.fullName || driver.id}?`);
        if (!confirmed) return;

        setDeletingId(driver.id);
        try {
            await adminAPI.delete(`/drivers/${driver.id}`);
            toast.success('Driver deleted');
            fetchDrivers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete driver. It may still be used by shifts or assignments.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleClose = () => {
        setShowModal(false);
        setEditingDriver(null);
        setForm(EMPTY_FORM);
        setFormErrors({});
    };

    if (auth.loading) {
        return <div className={ui.fullLoading}>Loading...</div>;
    }

    const filteredDrivers = drivers.filter(driver =>
        driver.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        driver.licenseNumber?.toLowerCase().includes(search.toLowerCase()) ||
        driver.phoneNumber?.includes(search)
    );

    const statusColor = (status) => ({
        ACTIVE: '#2f6b3d',
        INACTIVE: '#717680',
        ON_BREAK: '#d97706',
        OFF_DUTY: '#b24a52',
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
                        <h1 className={ui.headerTitle}>Drivers ({filteredDrivers.length})</h1>
                        <p className="mt-1 mb-0 text-text-muted text-[0.82rem]">{drivers.length} total drivers</p>
                    </div>
                    <div className="flex gap-[0.65rem] items-center">
                        <button type="button" onClick={fetchDrivers} className={ui.adminActionRefresh}>
                            <FiRefreshCw /> Refresh
                        </button>
                        <button type="button" onClick={openAddModal} className={ui.adminActionPrimary}>
                            <FiPlus /> Add Driver
                        </button>
                    </div>
                </header>

                <div className="bg-white rounded-lg p-4 mb-[1.1rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)] flex items-center gap-[0.65rem]">
                    <div className={`${ui.fieldInput} flex-1 mb-0 min-h-[2.6rem]`}>
                        <FiSearch />
                        <input
                            type="text"
                            placeholder="Search name, license, phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={ui.fieldInputEl}
                        />
                    </div>
                </div>

                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}>
                            <FiUsers /> Driver Roster <span className={ui.countPill}>{filteredDrivers.length} shown</span>
                        </span>
                    </div>

                    <div className={ui.tableWrap}>
                        {loading ? (
                            <div className="text-center p-10 text-text-muted italic">Loading drivers...</div>
                        ) : filteredDrivers.length === 0 ? (
                            <div className="text-center p-10 text-text-muted italic">No drivers found</div>
                        ) : (
                            <table className={ui.adminTable}>
                                <thead>
                                    <tr>
                                        {['#', 'Driver', 'License', 'Phone', 'Status', 'Joined', 'Actions'].map(header => (
                                            <th key={header} className={ui.tableTh}>{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDrivers.map((driver, index) => (
                                        <tr key={driver.id} className={ui.tableRow}>
                                            <td className={`${ui.tableTd} text-text-muted`}>{index + 1}</td>
                                            <td className={ui.tableTd}>
                                                <div className="flex items-center gap-[0.7rem]">
                                                    <div className="w-[2.4rem] h-[2.4rem] rounded-full bg-maroon text-white grid place-items-center font-black text-[0.95rem] shrink-0">
                                                        {driver.fullName?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <div className="font-extrabold text-text-main">{driver.fullName || 'N/A'}</div>
                                                        <div className="text-[0.72rem] text-text-muted">ID: {driver.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`${ui.tableTd} ${ui.mono}`}>{driver.licenseNumber || '-'}</td>
                                            <td className={`${ui.tableTd} ${ui.mono}`}>{driver.phoneNumber || '-'}</td>
                                            <td className={ui.tableTd}>
                                                <span className={ui.statusPillColor} style={{ background: statusColor(driver.status) }}>
                                                    {driver.status || 'UNKNOWN'}
                                                </span>
                                            </td>
                                            <td className={`${ui.tableTd} text-text-muted whitespace-nowrap`}>
                                                {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                                            </td>
                                            <td className={ui.tableTd}>
                                                <div className="inline-flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(driver)}
                                                        className="inline-flex items-center gap-[0.35rem] min-h-8 px-3 rounded-md bg-gold text-maroon text-[0.78rem] font-black cursor-pointer hover:bg-[#d9ad35]"
                                                    >
                                                        <FiEdit2 /> Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={deletingId === driver.id}
                                                        onClick={() => handleDelete(driver)}
                                                        className="inline-flex items-center gap-[0.35rem] min-h-8 px-3 rounded-md bg-danger-muted text-white text-[0.78rem] font-black cursor-pointer hover:bg-[#9f283f] disabled:opacity-60 disabled:cursor-not-allowed"
                                                    >
                                                        <FiTrash2 /> {deletingId === driver.id ? 'Deleting...' : 'Delete'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </main>

            {showModal && (
                <div className="fixed inset-0 bg-[rgba(53,47,51,0.6)] flex items-center justify-center z-100 p-4 backdrop-blur-[2px]" onClick={handleClose}>
                    <div className="admin-modal-anim bg-white rounded-xl w-full max-w-140 max-h-[90vh] flex flex-col overflow-hidden shadow-[0_32px_80px_rgba(44,36,41,0.28)]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-[1.35rem] py-[1.1rem] bg-maroon shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="inline-grid place-items-center w-[2.2rem] h-[2.2rem] rounded-lg bg-white/20 text-white text-base shrink-0"><FiUser /></span>
                                <h2 className="m-0 text-white text-[1.05rem] font-black">{editingDriver ? 'Edit Driver' : 'Add New Driver'}</h2>
                            </div>
                            <button className="grid place-items-center w-8 h-8 rounded-md bg-white/15 text-white text-[1.05rem] cursor-pointer transition-colors hover:bg-white/30" onClick={handleClose} aria-label="Close"><FiX /></button>
                        </div>

                        <form onSubmit={handleSubmit} noValidate className="overflow-y-auto px-[1.35rem] py-[1.4rem] flex flex-col gap-[0.95rem]">
                            <div className="flex flex-col gap-[0.32rem]">
                                <label className="text-[0.86rem] font-extrabold text-[#343946]">Full Name <span className="text-danger-muted">*</span></label>
                                <input type="text" className={formInputCls(formErrors.fullName)} placeholder="e.g. Juan dela Cruz" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
                                {formErrors.fullName && <span className="text-[0.76rem] text-danger-muted font-bold">{formErrors.fullName}</span>}
                            </div>

                            <div className="grid grid-cols-2 gap-[0.85rem] max-[860px]:grid-cols-1">
                                <div className="flex flex-col gap-[0.32rem]">
                                    <label className="text-[0.86rem] font-extrabold text-[#343946]">License Number <span className="text-danger-muted">*</span></label>
                                    <input type="text" className={formInputCls(formErrors.licenseNumber)} placeholder="e.g. N01-12-345678" value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} />
                                    {formErrors.licenseNumber && <span className="text-[0.76rem] text-danger-muted font-bold">{formErrors.licenseNumber}</span>}
                                </div>
                                <div className="flex flex-col gap-[0.32rem]">
                                    <label className="text-[0.86rem] font-extrabold text-[#343946]">Phone Number <span className="text-danger-muted">*</span></label>
                                    <input type="tel" className={formInputCls(formErrors.phoneNumber)} placeholder="e.g. 09171234567" value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
                                    {formErrors.phoneNumber && <span className="text-[0.76rem] text-danger-muted font-bold">{formErrors.phoneNumber}</span>}
                                </div>
                            </div>

                            <div className="flex flex-col gap-[0.32rem]">
                                <label className="text-[0.86rem] font-extrabold text-[#343946]">Status</label>
                                <select className={`${formInputCls(false)} select-arrow cursor-pointer`} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                    {DRIVER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-[0.32rem]">
                                <label className="text-[0.86rem] font-extrabold text-[#343946]">Assigned Vehicle</label>
                                <select className={`${formInputCls(false)} select-arrow cursor-pointer`} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                                    <option value="">No vehicle assigned</option>
                                    {vehicles.map(vehicle => (
                                        <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber}</option>
                                    ))}
                                </select>
                                <span className="text-[0.74rem] font-semibold text-text-muted">A vehicle can have only one active driver assignment.</span>
                            </div>

                            <div className="flex justify-end gap-[0.6rem] pt-2 border-t border-border-soft mt-[0.15rem] max-[560px]:flex-col-reverse">
                                <button type="button" onClick={handleClose} className="inline-flex items-center justify-center gap-[0.4rem] min-h-[2.55rem] px-5 rounded-lg bg-white border-[1.5px] border-border-soft text-text-muted text-[0.88rem] font-extrabold cursor-pointer transition-colors hover:border-maroon-soft hover:text-maroon max-[560px]:w-full">Cancel</button>
                                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-[0.45rem] min-h-[2.55rem] px-[1.4rem] rounded-lg bg-maroon text-white text-[0.88rem] font-black cursor-pointer transition-all hover:bg-maroon-dark hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(111,47,60,0.28)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:transform-none max-[560px]:w-full">
                                    {saving ? 'Saving...' : <><FiPlus /> {editingDriver ? 'Save Driver' : 'Add Driver'}</>}
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
