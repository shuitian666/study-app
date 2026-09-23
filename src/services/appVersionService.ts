import { Capacitor } from '@capacitor/core';
import { API_BASE, apiFetch } from '@/services/aiClient';

export const ANDROID_VERSION_CODE = 1;
export const ANDROID_VERSION_NAME = '1.0';

export interface AppVersionResponse {
  platform: string;
  updateAvailable: boolean;
  mandatory: boolean;
  latestVersionCode: number;
  latestVersionName: string;
  apkUrl: string;
  releaseNotes: string;
}

export function canCheckNativeAndroidUpdate(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function fetchAndroidAppVersion(): Promise<AppVersionResponse | null> {
  if (!canCheckNativeAndroidUpdate()) return null;
  const params = new URLSearchParams({
    platform: 'android',
    versionCode: String(ANDROID_VERSION_CODE),
    versionName: ANDROID_VERSION_NAME,
  });
  const response = await apiFetch(`${API_BASE}/app-version?${params.toString()}`);
  if (!response.ok) return null;
  return response.json();
}
