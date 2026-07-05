const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-hce',
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativehce',
  'apps',
  'nfc',
  'NFCTagType4.java',
);

const oldApdu = '00A4040007D276000085010100';
const premierApdu = '00A4040008F05052454D49455200';

if (!fs.existsSync(target)) {
  console.warn('[patch-hce-aid] react-native-hce NFCTagType4.java not found; skipping.');
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');

if (source.includes(premierApdu)) {
  console.log('[patch-hce-aid] Premier HCE AID already patched.');
  process.exit(0);
}

if (!source.includes(oldApdu)) {
  console.warn('[patch-hce-aid] Expected default HCE APDU not found; skipping.');
  process.exit(0);
}

fs.writeFileSync(target, source.replace(oldApdu, premierApdu));
console.log('[patch-hce-aid] Patched react-native-hce to Premier HCE AID.');
