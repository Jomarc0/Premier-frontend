// Browser compatibility shim required by a dependency that expects Node's global.
// Bundling this as a module keeps the app compatible with a strict CSP.
window.global = window.global || window;
