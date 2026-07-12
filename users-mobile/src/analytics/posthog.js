export const POSTHOG_KEY =
  process.env.EXPO_PUBLIC_POSTHOG_KEY ||
  'phc_tzBnafXT2VMeaXeDgC6wDxmpfWeekRjLo5GUVeYuSAf4';

export const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ||
  'https://us.i.posthog.com';

export function captureMobileEvent(posthog, name, properties = {}) {
  posthog?.capture(name, {
    app: 'premier-users-mobile',
    ...properties,
  });
}
