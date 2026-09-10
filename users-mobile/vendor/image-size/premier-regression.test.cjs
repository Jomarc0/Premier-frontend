const { ICNS } = require('./dist/types/icns');
const { JXL } = require('./dist/types/jxl');

function assertFast(label, action, maxMs = 100) {
  const startedAt = Date.now();
  try {
    action();
  } catch {
    // Malformed parser inputs may throw; the regression is that they must not loop.
  }
  const elapsed = Date.now() - startedAt;
  if (elapsed > maxMs) {
    throw new Error(`${label} parser took ${elapsed}ms`);
  }
}

const icnsZeroEntryLength = Buffer.from([
  0x69, 0x63, 0x6e, 0x73,
  0x00, 0x00, 0x00, 0x10,
  0x69, 0x63, 0x30, 0x37,
  0x00, 0x00, 0x00, 0x00,
]);

assertFast('ICNS zero entry length', () => {
  if (ICNS.validate(icnsZeroEntryLength)) {
    ICNS.calculate(icnsZeroEntryLength);
  }
});

const jxlZeroPartialBoxSize = Buffer.from([
  0x00, 0x00, 0x00, 0x0c,
  0x4a, 0x58, 0x4c, 0x20,
  0x0d, 0x0a, 0x87, 0x0a,
  0x00, 0x00, 0x00, 0x14,
  0x66, 0x74, 0x79, 0x70,
  0x6a, 0x78, 0x6c, 0x20,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x6a, 0x78, 0x6c, 0x70,
]);

assertFast('JXL zero partial box size', () => {
  if (JXL.validate(jxlZeroPartialBoxSize)) {
    JXL.calculate(jxlZeroPartialBoxSize);
  }
});

console.log('image-size parser regressions passed');
