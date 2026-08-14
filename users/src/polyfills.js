// Browser compatibility shim required by a dependency that expects Node's global.
// Keeping it in the module bundle avoids an inline script and preserves the strict CSP.
window.global = window.global || window;
