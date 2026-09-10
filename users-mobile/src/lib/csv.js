// Spreadsheet programs interpret formulas even inside properly quoted CSV cells.
export function safeSpreadsheetText(value) {
  const text = value == null ? '' : String(value);
  return /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(text) ? "'" + text : text;
}
export function csvEscape(value) {
  return `"${safeSpreadsheetText(value).replace(/"/g, '""')}"`;
}
