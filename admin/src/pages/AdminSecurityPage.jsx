import { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiCopy, FiRefreshCw, FiShield } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';

const AdminSecurityPage = () => {
    const [setup, setSetup] = useState(null);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const qrImageUrl = useMemo(() => {
        if (!setup?.qrCodeUrl) return '';
        return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(setup.qrCodeUrl)}`;
    }, [setup]);

    const loadSetup = async () => {
        setLoading(true);
        try {
            const res = await adminAPI.get('/auth/totp/setup');
            setSetup(res.data.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load Google Authenticator setup');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSetup(); }, []);

    const copySecret = async () => {
        try {
            await navigator.clipboard.writeText(setup?.manualEntryKey || '');
            toast.success('Manual key copied');
        } catch (_) {
            toast.info('Copy failed. Select and copy the key manually.');
        }
    };

    const verifyCode = async () => {
        if (!code.trim()) {
            toast.warning('Enter the 6-digit Google Authenticator code');
            return;
        }
        setSaving(true);
        try {
            await adminAPI.post('/auth/totp/verify', { totpCode: code.trim() });
            toast.success('Google Authenticator enabled');
            setCode('');
            loadSetup();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Invalid Google Authenticator code');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Security</span>
                        <h1 className={ui.headerTitle}>Google Authenticator</h1>
                        <p className="mt-1 text-[0.82rem] text-text-muted">
                            Protect admin access with a 6-digit TOTP code.
                        </p>
                    </div>
                    <button type="button" onClick={loadSetup} className={ui.adminActionRefresh}>
                        <FiRefreshCw />
                        Refresh
                    </button>
                </header>

                <section className="bg-white rounded-lg p-6 shadow-[0_10px_26px_rgba(44,36,41,0.08)] border-t-4 border-maroon">
                    {loading ? (
                        <p className={ui.loadingRow}>Loading security setup...</p>
                    ) : (
                        <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-6 max-[860px]:grid-cols-1">
                            <div className="grid place-items-center rounded-lg border border-border-soft bg-page-bg p-4">
                                {qrImageUrl ? (
                                    <img src={qrImageUrl} alt="Google Authenticator QR code" className="h-[220px] w-[220px]" />
                                ) : (
                                    <div className="grid h-[220px] w-[220px] place-items-center text-text-muted">No QR available</div>
                                )}
                            </div>

                            <div>
                                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-maroon/10 px-3 py-1 text-sm font-black text-maroon">
                                    <FiShield />
                                    {setup?.is2FaEnabled ? 'Enabled' : 'Not enabled'}
                                </div>

                                <h2 className="m-0 text-xl font-black text-maroon">Set up Google Authenticator</h2>
                                <p className="mt-2 text-sm leading-6 text-text-muted">
                                    Scan the QR code using Google Authenticator. If scanning is not available, add the manual key below.
                                </p>

                                <label className={ui.fieldLabel}>Manual entry key</label>
                                <div className="flex gap-2 max-[560px]:flex-col">
                                    <code className="flex-1 rounded-lg border border-border-soft bg-page-bg px-3 py-3 text-sm font-black text-text-main break-all">
                                        {setup?.manualEntryKey || 'Unavailable'}
                                    </code>
                                    <button type="button" onClick={copySecret} className={ui.adminAction}>
                                        <FiCopy />
                                        Copy
                                    </button>
                                </div>

                                <div className="mt-5">
                                    <label className={ui.fieldLabel}>6-digit code</label>
                                    <div className={ui.fieldInput}>
                                        <FiShield />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="123456"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                            className={ui.fieldInputEl}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={verifyCode}
                                    disabled={saving}
                                    className="mt-4 inline-flex min-h-[2.65rem] items-center justify-center gap-2 rounded-lg bg-maroon px-6 text-sm font-black text-white transition hover:bg-maroon-dark disabled:opacity-60"
                                >
                                    <FiCheck />
                                    {saving ? 'Verifying...' : 'Verify and enable'}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default AdminSecurityPage;
