import { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiCopy, FiRefreshCw, FiShield } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import TotpInput from '../components/auth/TotpInput';
import * as ui from '../components/adminUI';

const AdminSecurityPage = () => {
    const [setup, setSetup] = useState(null);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const qrImageUrl = useMemo(() => {
        if (!setup?.qrCodeUrl) return '';
        return `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(setup.qrCodeUrl)}`;
    }, [setup]);

    const isEnabled = Boolean(setup?.is2FaEnabled ?? setup?.twoFactorEnabled ?? setup?.['2FaEnabled']);

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
        if (code.trim().length !== 6) {
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
                        <h1 className={ui.headerTitle}>Account Verification</h1>
                        <p className="mt-1 text-[0.82rem] text-text-muted">
                            Protect your own admin account with a 6-digit authenticator code.
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
                    ) : isEnabled ? (
                        <div className="mx-auto max-w-[42rem] rounded-lg border border-green-brand/20 bg-[#f0fbf3] p-6 text-center">
                            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-green-brand text-white">
                                <FiCheck />
                            </div>
                            <h2 className="m-0 text-xl font-black text-maroon">Authenticator is enabled</h2>
                            <p className="mx-auto mt-2 max-w-[32rem] text-sm leading-6 text-text-muted">
                                This admin account now requires a Google Authenticator code during login. If access is lost, a super admin can reset the setup from Manage Admins.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-[17rem_minmax(0,1fr)] gap-6 max-[960px]:grid-cols-1">
                            <aside className="rounded-lg border border-border-soft bg-page-bg p-5">
                                <div className="mb-4 inline-flex rounded-full bg-maroon/10 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-maroon">
                                    Not enabled
                                </div>
                                <h2 className="m-0 text-lg font-black text-maroon">Set up your authenticator</h2>
                                <p className="mt-2 text-sm leading-6 text-text-muted">
                                    This QR code belongs to the logged-in admin only. Do not let another admin scan it.
                                </p>
                                <div className="mt-4 space-y-3 text-sm text-text-main">
                                    <div><strong>1.</strong> Open Google Authenticator.</div>
                                    <div><strong>2.</strong> Scan the QR code or enter the setup key.</div>
                                    <div><strong>3.</strong> Enter the 6-digit code to enable protection.</div>
                                </div>
                            </aside>

                            <div className="min-w-0">
                                <div className="grid grid-cols-[14rem_minmax(0,1fr)] gap-4 max-[760px]:grid-cols-1">
                                    <div className="rounded-lg border border-border-soft bg-white p-4">
                                        <div className="mb-3 text-sm font-black text-text-main">Scan QR code</div>
                                        <div className="grid min-h-[13.5rem] place-items-center rounded-lg bg-page-bg p-3">
                                            {qrImageUrl ? (
                                                <img src={qrImageUrl} alt="Google Authenticator QR code" className="h-[190px] w-[190px]" />
                                            ) : (
                                                <div className="text-sm text-text-muted">No QR available</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border-soft bg-white p-4">
                                        <label className={ui.fieldLabel}>Manual setup key</label>
                                        <div className="flex gap-2 max-[560px]:flex-col">
                                            <code className="min-w-0 flex-1 rounded-lg border border-border-soft bg-page-bg px-3 py-3 text-sm font-black text-text-main break-all">
                                                {setup?.manualEntryKey || 'Unavailable'}
                                            </code>
                                            <button type="button" onClick={copySecret} className={ui.adminAction}>
                                                <FiCopy />
                                                Copy
                                            </button>
                                        </div>

                                        <div className="mt-5">
                                            <label className={ui.fieldLabel}>Authenticator code</label>
                                            <TotpInput value={code} onChange={setCode} />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={verifyCode}
                                            disabled={saving || code.length !== 6}
                                            className="mt-5 inline-flex min-h-[2.9rem] w-full items-center justify-center gap-2 rounded-lg bg-maroon px-6 text-sm font-black text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <FiCheck />
                                            {saving ? 'Verifying...' : 'Verify and enable'}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-lg border border-gold/50 bg-gold/10 px-4 py-3 text-sm leading-6 text-maroon">
                                    Super admins should only reset an admin&apos;s authenticator if they lose access. The admin must scan and verify their own setup.
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default AdminSecurityPage;
