export function buildAppVersionResponse(query = {}, env = process.env) {
  const platform = String(query.platform || 'android').toLowerCase();
  const currentVersionCode = Math.max(0, Math.round(Number(query.versionCode) || 0));
  const latestVersionCode = Math.max(1, Math.round(Number(env.APP_ANDROID_VERSION_CODE) || 1));
  const latestVersionName = String(env.APP_ANDROID_VERSION_NAME || '1.0');
  const apkUrl = String(env.APP_ANDROID_APK_URL || '').trim();
  const releaseNotes = String(env.APP_ANDROID_RELEASE_NOTES || '').trim();
  const minimumVersionCode = Math.max(0, Math.round(Number(env.APP_ANDROID_MIN_VERSION_CODE) || 0));

  if (platform !== 'android') {
    return {
      platform,
      updateAvailable: false,
      mandatory: false,
      latestVersionCode: 1,
      latestVersionName: '1.0',
      apkUrl: '',
      releaseNotes: '',
    };
  }

  return {
    platform: 'android',
    updateAvailable: Boolean(apkUrl) && latestVersionCode > currentVersionCode,
    mandatory: currentVersionCode > 0 && currentVersionCode < minimumVersionCode,
    latestVersionCode,
    latestVersionName,
    apkUrl,
    releaseNotes,
  };
}
