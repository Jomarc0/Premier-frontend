import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const safeFilePart = (value) => {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return normalized || `Transaction_${Date.now()}`;
};

const detailRow = (label, value) => {
  if (value === null || value === undefined || value === '') return '';
  return `
    <div class="detail-row">
      <div class="detail-label">${escapeHtml(label)}</div>
      <div class="detail-value">${escapeHtml(value)}</div>
    </div>`;
};

const statusClass = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized.includes('FAIL') || normalized.includes('CANCEL')) return 'status-danger';
  if (normalized.includes('PEND')) return 'status-pending';
  return 'status-success';
};

function buildReceiptHtml(receipt) {
  const details = [
    ['Transaction ID', receipt.transactionId],
    ['Reference No.', receipt.referenceNumber],
    ['Payment Method', receipt.paymentMethod],
    ['Date & Time', receipt.dateTime],
    ['Card Number', receipt.cardNumber],
    ['Balance Before', receipt.balanceBefore],
    ['Balance After', receipt.balanceAfter],
    ['Payment Provider / Source', receipt.source],
    ['Bus Number', receipt.busNumber],
    ['Terminal', receipt.terminal],
  ].map(([label, value]) => detailRow(label, value)).join('');

  const optionalNotes = [
    receipt.description
      ? `<div class="note"><div class="detail-label">Description</div><div>${escapeHtml(receipt.description)}</div></div>`
      : '',
    receipt.notes
      ? `<div class="note"><div class="detail-label">Notes</div><div>${escapeHtml(receipt.notes)}</div></div>`
      : '',
  ].join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f3f5f8; color: #17233a; font-family: Arial, Helvetica, sans-serif; }
    .page { width: 100%; min-height: 100vh; padding: 46px; background: #ffffff; }
    .brand { color: #761b29; font-size: 22px; line-height: 1.1; font-weight: 800; letter-spacing: 1.4px; }
    .tagline { margin-top: 5px; color: #687b96; font-size: 10px; font-weight: 700; letter-spacing: 1.3px; }
    .receipt-heading { margin-top: 25px; color: #17233a; font-size: 13px; font-weight: 800; letter-spacing: 2px; }
    .summary { margin-top: 16px; padding: 22px; border: 1px solid #e3e8ef; border-left: 6px solid #761b29; border-radius: 12px; background: #f8fafc; }
    .type { color: #657994; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; }
    .amount { margin-top: 7px; color: #17233a; font-size: 30px; font-weight: 800; }
    .status { display: inline-block; margin-top: 12px; padding: 6px 11px; border: 1px solid currentColor; border-radius: 99px; font-size: 10px; font-weight: 800; letter-spacing: .7px; }
    .status-success { color: #137a43; background: #e9f8ef; }
    .status-danger { color: #ad2534; background: #fdecee; }
    .status-pending { color: #8a5a00; background: #fff5d8; }
    .details { margin-top: 24px; border-top: 1px solid #dfe5ec; }
    .detail-row { display: flex; width: 100%; padding: 11px 0; border-bottom: 1px solid #edf1f5; page-break-inside: avoid; }
    .detail-label { width: 34%; padding-right: 15px; color: #71829a; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
    .detail-value { width: 66%; color: #17233a; font-size: 11px; font-weight: 700; text-align: right; overflow-wrap: anywhere; word-break: break-word; }
    .note { padding: 12px 0; color: #43546b; font-size: 11px; line-height: 1.55; border-bottom: 1px solid #edf1f5; overflow-wrap: anywhere; }
    .note .detail-label { width: 100%; margin-bottom: 5px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid #761b29; text-align: center; color: #6b7d95; font-size: 9px; line-height: 1.6; }
    .footer strong { color: #761b29; letter-spacing: .7px; }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div class="brand">PREMIER TRANSPORT</div>
      <div class="tagline">RFID SMART FARE SYSTEM</div>
      <div class="receipt-heading">OFFICIAL TRANSACTION RECEIPT</div>
    </header>
    <section class="summary">
      <div class="type">${escapeHtml(receipt.transactionType)}</div>
      <div class="amount">${escapeHtml(receipt.amount)}</div>
      <div class="status ${statusClass(receipt.status)}">${escapeHtml(receipt.status)}</div>
    </section>
    <section class="details">${details}</section>
    ${optionalNotes}
    <footer class="footer">
      <strong>PREMIER TRANSPORT RFID SMART FARE SYSTEM</strong><br />
      This is a system-generated receipt.
    </footer>
  </main>
</body>
</html>`;
}

export async function generateTransactionReceiptPdf(receipt) {
  if (!receipt) throw new Error('A receipt is required.');
  let generatedUri;
  try {
    const generated = await Print.printToFileAsync({
      html: buildReceiptHtml(receipt),
      base64: false,
    });
    generatedUri = generated?.uri;
  } catch (error) {
    error.receiptStage = 'generate';
    throw error;
  }

  if (!generatedUri) {
    const error = new Error('The PDF generator did not return a file.');
    error.receiptStage = 'generate';
    throw error;
  }

  const fileName = `Premier_Transport_Receipt_${safeFilePart(
    receipt.referenceNumber || receipt.transactionId,
  )}.pdf`;
  const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!directory) return { uri: generatedUri, fileName };
  const uri = `${directory}${fileName}`;

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    await FileSystem.copyAsync({ from: generatedUri, to: uri });
    return { uri, fileName };
  } catch {
    // expo-print already created a valid PDF. A rename/copy failure must not
    // prevent Android from opening the save/share sheet for that PDF.
    return { uri: generatedUri, fileName };
  }
}

export async function saveTransactionReceiptPdf({ uri, fileName }) {
  const storage = FileSystem.StorageAccessFramework;
  if (
    Platform.OS !== 'android' ||
    !uri ||
    !storage?.requestDirectoryPermissionsAsync
  ) {
    return false;
  }

  const permission = await storage.requestDirectoryPermissionsAsync();
  if (!permission.granted) return false;

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const destinationUri = await storage.createFileAsync(
      permission.directoryUri,
      fileName,
      'application/pdf',
    );
    await storage.writeAsStringAsync(destinationUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return true;
  } catch (error) {
    error.receiptStage = 'save';
    throw error;
  }
}

export async function shareTransactionReceiptPdf({ uri, fileName }) {
  if (!await Sharing.isAvailableAsync()) return false;
  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Save or share ${fileName}`,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    error.receiptStage = 'share';
    throw error;
  }
  return true;
}
