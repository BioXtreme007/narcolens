import Constants from 'expo-constants';

/**
 * Where the APK calls Prahari. Set this once, before the Android build,
 * to the public host that holds the Sarvam key. Officers never type it.
 * EXPO_PUBLIC_API_URL overrides app.json for a local build.
 * Empty means Prahari stays on the device.
 */
const fromEnv = process.env.EXPO_PUBLIC_API_URL ?? '';
const fromApp = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? '';

export const API_URL = (fromEnv || fromApp).trim().replace(/\/$/, '');
