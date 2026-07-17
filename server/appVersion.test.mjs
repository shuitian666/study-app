import assert from 'node:assert/strict';
import test from 'node:test';

const { buildAppVersionResponse } = await import('./appVersion.js');

test('app version response reports no update without an APK URL', () => {
  const result = buildAppVersionResponse(
    { platform: 'android', versionCode: '1' },
    { APP_ANDROID_VERSION_CODE: '2', APP_ANDROID_VERSION_NAME: '1.1' },
  );

  assert.equal(result.updateAvailable, false);
  assert.equal(result.latestVersionCode, 2);
});

test('app version response reports optional and mandatory Android updates', () => {
  const optional = buildAppVersionResponse(
    { platform: 'android', versionCode: '1' },
    {
      APP_ANDROID_VERSION_CODE: '2',
      APP_ANDROID_VERSION_NAME: '1.1',
      APP_ANDROID_APK_URL: 'https://zhixueassistant.cn/download/app-release.apk',
      APP_ANDROID_RELEASE_NOTES: 'Fix login.',
    },
  );
  const mandatory = buildAppVersionResponse(
    { platform: 'android', versionCode: '1' },
    {
      APP_ANDROID_VERSION_CODE: '3',
      APP_ANDROID_MIN_VERSION_CODE: '2',
      APP_ANDROID_APK_URL: 'https://zhixueassistant.cn/download/app-release.apk',
    },
  );

  assert.equal(optional.updateAvailable, true);
  assert.equal(optional.mandatory, false);
  assert.equal(optional.releaseNotes, 'Fix login.');
  assert.equal(mandatory.updateAvailable, true);
  assert.equal(mandatory.mandatory, true);
});
