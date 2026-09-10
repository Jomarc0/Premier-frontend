import { useCallback, useEffect, useRef, useState } from 'react';
export function safeCheckoutUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export default function useOwnedPendingTopups(api, ownerId) {
  const [pendingPayment, setPendingPayment] = useState(null);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState('');
  const [morePending, setMorePending] = useState(false);
  const sequence = useRef(0);
  const page = useRef(0);
  const entries = useRef([]);
  const lastPage = useRef(true);
  const mounted = useRef(false);
  const refreshPending = useCallback(async (requestedPage = 0) => {
    const version = ++sequence.current;
    if (!ownerId) { setPendingPayment(null); setPendingLoading(false); return; }
    setPendingLoading(true); setPendingError('');
    try {
      const response = await api.get('/topup/pending', { params: { page: requestedPage } });
      if (!mounted.current || version !== sequence.current) return;
      const data = response.data?.data;
      if (response.data?.success !== true || !Array.isArray(data?.content)) throw new Error('Pending payments could not be recovered.');
      const rows = data.content.filter(row => typeof row.referenceNumber === 'string');
      page.current = requestedPage; entries.current = rows; lastPage.current = data.last !== false;
      setMorePending(rows.length > 1 || data.last === false || requestedPage > 0);
      setPendingPayment(previous => rows.find(row => row.referenceNumber === previous?.referenceNumber) || rows[0] || null);
    } catch {
      if (mounted.current && version === sequence.current) setPendingError('Unable to recover pending payments. Retry before starting another top-up.');
    } finally { if (mounted.current && version === sequence.current) setPendingLoading(false); }
  }, [api, ownerId]);
  const nextPending = useCallback(() => {
    const index = entries.current.findIndex(row => row.referenceNumber === pendingPayment?.referenceNumber);
    if (index >= 0 && index + 1 < entries.current.length) setPendingPayment(entries.current[index + 1]);
    else void refreshPending(lastPage.current ? 0 : page.current + 1);
  }, [pendingPayment, refreshPending]);
  useEffect(() => {
    mounted.current = true; setPendingPayment(null); entries.current = [];
    void refreshPending();
    return () => { mounted.current = false; sequence.current += 1; entries.current = []; };
  }, [refreshPending]);
  return { pendingPayment, setPendingPayment, pendingLoading, pendingError, morePending, refreshPending, nextPending };
}
