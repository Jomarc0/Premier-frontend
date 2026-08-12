import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;

const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST ||
  'https://us.i.posthog.com';

let initialized = false;
let lastPageView;
const debugEnabled = import.meta.env.DEV && import.meta.env.VITE_POSTHOG_DEBUG === 'true';
const debug = (message, value) => {
  if (debugEnabled) console.info(`[PostHog] ${message}`, value ?? '');
};

export function initPostHog() {
  if (initialized) return true;
  if (!POSTHOG_KEY) {
    debug('disabled: VITE_POSTHOG_KEY is not configured');
    return false;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: 'identified_only',
  });

  initialized = true;
  debug('initialized');
  return true;
}

export function captureEvent(name, properties = {}) {
  if (!initialized) {
    debug(`skipped capture before initialization: ${name}`);
    return;
  }

  posthog.capture(name, {
    app: 'premier-admin',
    ...properties,
  });
  debug(`capture: ${name}`);
}

export function capturePageView({ path, route, title }) {
  const pagePath = path || window.location.pathname;
  const key = `${pagePath}|${route || ''}`;
  const now = Date.now();
  if (lastPageView?.key === key && now - lastPageView.at < 1000) return;
  lastPageView = { key, at: now };
  captureEvent('page_view', { path: pagePath, route: route || pagePath, title: title || document.title });
}

export function identifyUser(userId, properties = {}) {
  if (!initialized || userId === null || userId === undefined || userId === '') return;
  posthog.identify(String(userId), { app: 'premier-admin', ...properties });
  debug('identify user');
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
  debug('reset');
}
