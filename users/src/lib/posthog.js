import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const APP_NAME = 'premier-users-web';

let initialized = false;
let sdkReady = false;
let pendingPageViews = [];
let lastPageView;
let diagnosticSent = false;
const debugEnabled = import.meta.env.DEV && import.meta.env.VITE_POSTHOG_DEBUG === 'true';

const debug = (message) => {
  if (debugEnabled) console.info(`[PostHog] ${message}`);
};

function sendPageView(pageView) {
  const { path, route, title, key } = pageView;
  const currentUrl = `${window.location.origin}${path}`;
  try {
    posthog.capture('$pageview', {
      app: APP_NAME,
      route,
      $current_url: currentUrl,
      $pathname: path,
      $host: window.location.host,
      $title: title,
    });
    lastPageView = { key, at: Date.now() };
  } catch {
    // Analytics transport failures must never affect application behavior.
  }
}

export function initPostHog() {
  if (initialized) return true;
  if (!POSTHOG_KEY) {
    debug('disabled: VITE_POSTHOG_KEY is not configured');
    return false;
  }

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      person_profiles: 'identified_only',
      loaded: () => {
        sdkReady = true;
        const queuedPageViews = pendingPageViews;
        pendingPageViews = [];
        queuedPageViews.forEach(sendPageView);
        debug('ready');
      },
    });

    initialized = true;
    window.__premierPostHogDiagnostic = runPostHogDiagnostic;
    debug('initialized');
    return true;
  } catch {
    debug('initialization failed');
    return false;
  }
}

export function captureEvent(name, properties = {}) {
  if (!initialized) {
    debug(`skipped capture before initialization: ${name}`);
    return;
  }

  try {
    posthog.capture(name, { app: APP_NAME, ...properties });
  } catch {
    // Analytics transport failures must never affect application behavior.
  }
}

export function capturePageView({ path, route, title } = {}) {
  if (!initialized) return;

  const pagePath = path || window.location.pathname;
  const pageRoute = route || pagePath;
  const key = `${pagePath}|${pageRoute}`;
  const now = Date.now();
  if (lastPageView?.key === key && now - lastPageView.at < 1000) return;
  const pageView = { path: pagePath, route: pageRoute, title: title || document.title, key };
  if (!sdkReady) {
    if (pendingPageViews[pendingPageViews.length - 1]?.key !== key) pendingPageViews.push(pageView);
    return;
  }
  sendPageView(pageView);
}

export function runPostHogDiagnostic() {
  if (!initialized || !sdkReady || diagnosticSent) {
    debug('diagnostic unavailable or already sent');
    return false;
  }

  try {
    posthog.capture('posthog_diagnostic_test', {
      app: APP_NAME,
      diagnostic: true,
    });
    diagnosticSent = true;
    debug('diagnostic event queued');
    return true;
  } catch {
    debug('diagnostic failed');
    return false;
  }
}

export function identifyUser(userId, properties = {}) {
  if (!initialized || userId === null || userId === undefined || userId === '') return;
  try {
    // Keep non-identifying role context while retaining PostHog's anonymous distinct ID.
    posthog.register({ app: APP_NAME, ...properties });
    debug('registered anonymous context');
  } catch {
    // Analytics transport failures must never affect application behavior.
  }
}

export function resetAnalytics() {
  if (!initialized) return;
  try {
    posthog.reset();
    debug('reset');
  } catch {
    // Analytics transport failures must never affect application behavior.
  }
}
