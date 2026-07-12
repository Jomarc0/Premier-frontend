import posthog from 'posthog-js';

const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY ||
  'phc_tzBnafXT2VMeaXeDgC6wDxmpfWeekRjLo5GUVeYuSAf4';

const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST ||
  'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: 'identified_only',
  });

  initialized = true;
}

export function captureEvent(name, properties = {}) {
  if (!initialized) return;

  posthog.capture(name, {
    app: 'premier-users-web',
    ...properties,
  });
}
