export const POSTHOG_KEY =
  process.env.EXPO_PUBLIC_POSTHOG_KEY || '';

export const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ||
  'https://us.i.posthog.com';

export function captureMobileEvent(posthog, name, properties = {}) {
  posthog?.capture(name, {
    app: 'premier-users-mobile',
    ...properties,
  });
}

export function identifyMobileUser(posthog, userId) {
  if (!posthog || userId === null || userId === undefined || userId === '') return;
  posthog.identify(String(userId), { app: 'premier-users-mobile' });
}

export function resetMobileAnalytics(posthog) {
  posthog?.reset();
}
