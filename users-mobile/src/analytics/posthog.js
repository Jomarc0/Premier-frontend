export const POSTHOG_KEY =
  process.env.EXPO_PUBLIC_POSTHOG_KEY || '';

export const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ||
  'https://us.i.posthog.com';

export function captureMobileEvent(posthog, name, properties = {}) {
  try {
    posthog?.capture(name, {
      app: 'premier-users-mobile',
      ...properties,
    });
  } catch {}
}

export function identifyMobileUser(posthog, userId) {
  if (!posthog || userId === null || userId === undefined || userId === '') return;
  try {
    posthog.identify(String(userId), { app: 'premier-users-mobile' });
  } catch {}
}

export function resetMobileAnalytics(posthog) {
  try {
    posthog?.reset();
  } catch {}
}
