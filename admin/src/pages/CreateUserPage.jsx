import { useMemo, useState } from 'react';
import {
    FiCheckCircle,
    FiCreditCard,
    FiLayers,
    FiPrinter,
    FiRefreshCw,
    FiSave,
} from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import { toast } from 'react-toastify';
import * as ui from '../components/adminUI';

const CARD_CATEGORIES = [
    { value: 'REGULAR', label: 'Regular', help: 'No discount eligibility' },
    { value: 'STUDENT', label: 'Student', help: 'Student discount eligible' },
    { value: 'SENIOR_CITIZEN', label: 'Senior Citizen', help: 'Senior discount eligible' },
    { value: 'PWD', label: 'PWD', help: 'PWD discount eligible' },
];

const cleanUid = (value) =>
    value.trim().replace(/[^a-fA-F0-9]/g, '').toUpperCase();

const normalizeReaderUid = (value) => {
    if (!value) return '';
    const cleaned = String(value)
        .toUpperCase()
        .replace(/RFID|CARD|UID|TAG|ID|HEX|:/g, ' ')
        .replace(/[^A-F0-9]/g, '');
    return cleaned.length >= 4 && cleaned.length <= 20 ? cleaned : '';
};

const formatCategory = (value) =>
    CARD_CATEGORIES.find((category) => category.value === value)?.label || value;

const modeButtonClass = (active) =>
    [
        'inline-flex min-h-[2.85rem] items-center justify-center gap-2 rounded-md border px-4 text-sm font-black transition-colors',
        active
            ? 'border-maroon bg-maroon text-white'
            : 'border-slate-200 bg-white text-maroon hover:border-maroon/30 hover:bg-maroon/5',
    ].join(' ');

const CreateUserPage = () => {
    const [mode, setMode] = useState('single');
    const [category, setCategory] = useState('REGULAR');
    const [singleUid, setSingleUid] = useState('');
    const [bulkUids, setBulkUids] = useState('');
    const [recentCards, setRecentCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [readingUid, setReadingUid] = useState(false);
    const [bulkProgress, setBulkProgress] = useState(null);

    const parsedBulkUids = useMemo(() => {
        const unique = new Set();
        return bulkUids
            .split(/\r?\n/)
            .map(cleanUid)
            .filter((uid) => {
                if (uid.length < 4 || unique.has(uid)) return false;
                unique.add(uid);
                return true;
            });
    }, [bulkUids]);

    const createCard = async (rfidUid) => {
        const res = await adminAPI.post('/users/create', {
            rfidUid,
            category,
        });
        return res.data.data;
    };

    const handleReadSingleUid = async () => {
        if (!('serial' in navigator)) {
            toast.info('USB RFID reading needs Chrome or Edge with Web Serial support.');
            return;
        }

        setReadingUid(true);
        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });

            const decoder = new TextDecoderStream();
            const readableClosed = port.readable.pipeTo(decoder.writable);
            const reader = decoder.readable.getReader();

            let buffer = '';
            let foundUid = '';

            while (!foundUid) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += value || '';

                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const uid = normalizeReaderUid(line);
                    if (uid) {
                        foundUid = uid;
                        break;
                    }
                }
            }

            if (foundUid) {
                setSingleUid(foundUid);
                toast.success(`RFID UID captured: ${foundUid}`);
            } else {
                toast.info('No RFID UID was read. Tap the card again.');
            }

            try { await reader.cancel(); } catch { /* already closed */ }
            try { await readableClosed; } catch { /* cancel closes pipe */ }
            await port.close();
        } catch (err) {
            if (err.name !== 'NotFoundError') {
                toast.error(err.message || 'Failed to read RFID UID.');
            }
        } finally {
            setReadingUid(false);
        }
    };

    const handleSingleCreate = async () => {
        const rfidUid = cleanUid(singleUid);
        if (rfidUid.length < 4) {
            toast.warning('Enter a valid RFID UID.');
            return;
        }

        setLoading(true);
        try {
            const card = await createCard(rfidUid);
            setRecentCards((prev) => [card, ...prev]);
            setSingleUid('');
            toast.success(`Card created. Print card number ${card.cardNumber || ''}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create RFID card.');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkCreate = async () => {
        if (parsedBulkUids.length === 0) {
            toast.warning('Paste at least one valid RFID UID.');
            return;
        }

        setLoading(true);
        setBulkProgress({ completed: 0, total: parsedBulkUids.length });
        const created = [];
        const failed = [];

        for (const uid of parsedBulkUids) {
            try {
                const card = await createCard(uid);
                created.push(card);
                setRecentCards((prev) => [card, ...prev]);
            } catch (err) {
                failed.push({
                    uid,
                    reason: err.response?.data?.message || 'Failed to create card',
                });
            } finally {
                setBulkProgress((prev) => ({
                    completed: (prev?.completed || 0) + 1,
                    total: parsedBulkUids.length,
                }));
            }
        }

        if (created.length > 0) {
            toast.success(`${created.length} RFID card${created.length === 1 ? '' : 's'} created.`);
        }
        if (failed.length > 0) {
            toast.warning(`${failed.length} RFID UID${failed.length === 1 ? '' : 's'} skipped.`);
        }
        setLoading(false);
    };

    const resetForm = () => {
        setSingleUid('');
        setBulkUids('');
        setBulkProgress(null);
    };

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>
                <div className="mx-auto w-full max-w-[48rem]">
                    <header className="mb-5 rounded-lg border border-border-soft bg-white px-6 py-5">
                        <div>
                            <span className={ui.eyebrow}>RFID Card Stock</span>
                            <h1 className={ui.headerTitle}>Create RFID Cards</h1>
                            <p className="mt-2 max-w-[38rem] text-sm text-text-muted">
                                Register blank RFID cards, then print or write the generated card number on the physical card.
                            </p>
                        </div>
                    </header>

                    <div className="rounded-lg border border-border-soft bg-white p-6 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-page-bg p-1 max-[620px]:grid-cols-1">
                            <button
                                type="button"
                                onClick={() => setMode('single')}
                                className={modeButtonClass(mode === 'single')}
                            >
                                <FiCreditCard className="inline mr-2" />
                                Single Card
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('bulk')}
                                className={modeButtonClass(mode === 'bulk')}
                            >
                                <FiLayers className="inline mr-2" />
                                Bulk Cards
                            </button>
                        </div>

                        <div className="mb-[1.05rem]">
                            <label className={ui.fieldLabel}>Card Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-sm font-black text-text-main outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/15"
                            >
                                {CARD_CATEGORIES.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label} - {item.help}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {mode === 'single' ? (
                            <div className="mb-[1.05rem]">
                                <label className={ui.fieldLabel} htmlFor="rfid-uid">
                                    Blank RFID UID
                                </label>
                                <div className="grid grid-cols-[1fr_10rem] items-start gap-2 max-[620px]:grid-cols-1">
                                    <div className={ui.fieldInput}>
                                        <FiCreditCard />
                                        <input
                                            id="rfid-uid"
                                            type="text"
                                            placeholder="Tap blank card, read UID, or type UID"
                                            value={singleUid}
                                            onChange={(e) => setSingleUid(e.target.value)}
                                            className={ui.fieldInputEl}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleReadSingleUid}
                                        disabled={loading || readingUid}
                                        className="inline-flex min-h-[3.1rem] items-center justify-center rounded-lg border border-maroon bg-white px-4 text-sm font-black text-maroon transition-colors hover:bg-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {readingUid ? 'Waiting...' : 'Read UID'}
                                    </button>
                                </div>
                                <div className="mt-[0.35rem] text-[0.74rem] text-text-muted">
                                    Use the reader button in Chrome/Edge, or type/paste the UID manually. The backend generates the 10-digit card number for printing.
                                </div>
                            </div>
                        ) : (
                            <div className="mb-[1.05rem]">
                                <label className={ui.fieldLabel} htmlFor="bulk-uids">
                                    Blank RFID UIDs, one per line
                                </label>
                                <textarea
                                    id="bulk-uids"
                                    rows={8}
                                    placeholder={'A1B2C3D4\n5E6F7788\n09AABBCC'}
                                    value={bulkUids}
                                    onChange={(e) => setBulkUids(e.target.value)}
                                    className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-sm font-mono outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/15"
                                />
                                <div className="mt-[0.35rem] text-[0.74rem] text-text-muted">
                                    Ready to create {parsedBulkUids.length} unique {formatCategory(category)} card{parsedBulkUids.length === 1 ? '' : 's'}.
                                </div>
                            </div>
                        )}

                        {bulkProgress && (
                            <div className="mb-4 rounded-lg border border-gold/50 bg-gold/10 px-4 py-3 text-sm font-bold text-maroon">
                                Bulk progress: {bulkProgress.completed} of {bulkProgress.total}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={mode === 'single' ? handleSingleCreate : handleBulkCreate}
                            disabled={loading}
                            className={ui.primaryButton}
                        >
                            <FiSave />
                            {loading ? 'Creating...' : mode === 'single' ? 'Create Available RFID Card' : 'Create Bulk RFID Cards'}
                        </button>

                        <button
                            type="button"
                            onClick={resetForm}
                            disabled={loading}
                            className={ui.secondaryButton}
                        >
                            <FiRefreshCw />
                            Reset Form
                        </button>

                        {recentCards.length > 0 && (
                            <div className="mt-6 border-t border-border-soft pt-5">
                                <div className="mb-3 font-black text-[0.92rem] text-maroon">Recently Created Cards</div>
                                <div className="space-y-3">
                                    {recentCards.map((card, index) => (
                                        <div key={`${card.id}-${index}`} className="rounded-lg border border-slate-200 bg-page-bg p-4 text-[0.82rem]">
                                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                <div className="inline-flex items-center gap-2 font-black text-green-brand">
                                                    <FiCheckCircle />
                                                    Card Created
                                                </div>
                                                <span className="rounded-full bg-white px-3 py-1 text-[0.7rem] font-black text-maroon">
                                                    {card.status || 'AVAILABLE'}
                                                </span>
                                            </div>
                                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                                                <div className="inline-flex items-center gap-2 text-[0.72rem] font-black uppercase tracking-[0.08em] text-maroon">
                                                    <FiPrinter />
                                                    Card number to print
                                                </div>
                                                <div className="mt-1 font-mono text-[clamp(1.3rem,3vw,1.9rem)] font-black tracking-[0.12em] text-text-main">
                                                    {card.cardNumber || 'N/A'}
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-2 text-text-main max-[620px]:grid-cols-1">
                                                <div>RFID UID: <strong>{card.rfidUid || 'N/A'}</strong></div>
                                                <div>Type: <strong>{formatCategory(card.cardCategory || category)}</strong></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CreateUserPage;
