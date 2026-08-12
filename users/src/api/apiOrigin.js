// During local development the Vite proxy forwards /api to Spring Boot. This
// keeps browser requests same-origin and avoids local CORS configuration drift.
export const apiOrigin = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');
