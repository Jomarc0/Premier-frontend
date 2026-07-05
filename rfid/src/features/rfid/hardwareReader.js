export const DEFAULT_SERIAL_BAUD_RATE = 115200;

export const isSerialReaderSupported = () =>
    typeof navigator !== 'undefined' && 'serial' in navigator;

export const normalizeRfidUid = (value) => {
    if (!value) return '';

    const cleaned = String(value)
        .toUpperCase()
        .replace(/RFID|CARD|UID|TAG|ID|HEX|:/g, ' ')
        .replace(/[^A-F0-9]/g, '');

    return cleaned.length >= 4 && cleaned.length <= 20 ? cleaned : '';
};

export const createSerialRfidReader = async ({ onUid, onStatus, signal }) => {
    if (!isSerialReaderSupported()) {
        throw new Error('This browser cannot connect to USB serial RFID hardware. Use Chrome or Edge.');
    }

    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: DEFAULT_SERIAL_BAUD_RATE });

    const decoder = new TextDecoderStream();
    const readableClosed = port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();

    let buffer = '';
    let closed = false;

    const close = async () => {
        if (closed) return;
        closed = true;

        try { await reader.cancel(); } catch { /* reader may already be closed */ }
        try { await readableClosed; } catch { /* cancel rejects the pipe */ }
        try { await port.close(); } catch { /* port may already be closed */ }
    };

    signal?.addEventListener('abort', close, { once: true });
    onStatus?.('CONNECTED');

    const readLoop = async () => {
        try {
            while (!closed) {
                const { value, done } = await reader.read();
                if (done) break;
                if (!value) continue;

                buffer += value;
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const uid = normalizeRfidUid(line);
                    if (uid) await onUid(uid);
                }
            }
        } finally {
            onStatus?.('DISCONNECTED');
            await close();
        }
    };

    readLoop();

    return { close };
};
