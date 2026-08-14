// Browser compatibility shim required by a dependency that expects Node's global.
// Bundled as a module so it remains compatible with the strict Vercel CSP.
window.global = window.global || window;
