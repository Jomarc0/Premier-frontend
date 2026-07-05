const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const HCE_AID = 'F05052454D494552';

function ensureManifestItem(items = [], androidName, createItem) {
  const exists = items.some((item) => item?.$?.['android:name'] === androidName);
  return exists ? items : [...items, createItem()];
}

function withAndroidHce(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    manifest['uses-permission'] = ensureManifestItem(
      manifest['uses-permission'],
      'android.permission.NFC',
      () => ({ $: { 'android:name': 'android.permission.NFC' } }),
    );

    manifest['uses-feature'] = ensureManifestItem(
      manifest['uses-feature'],
      'android.hardware.nfc.hce',
      () => ({
        $: {
          'android:name': 'android.hardware.nfc.hce',
          'android:required': 'true',
        },
      }),
    );

    const application = manifest.application?.[0];
    if (!application) {
      return modConfig;
    }

    application.service = ensureManifestItem(
      application.service,
      'com.reactnativehce.services.CardService',
      () => ({
        $: {
          'android:name': 'com.reactnativehce.services.CardService',
          'android:exported': 'true',
          'android:enabled': 'false',
          'android:permission': 'android.permission.BIND_NFC_SERVICE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.nfc.cardemulation.action.HOST_APDU_SERVICE',
                },
              },
            ],
            category: [
              {
                $: {
                  'android:name': 'android.intent.category.DEFAULT',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.nfc.cardemulation.host_apdu_service',
              'android:resource': '@xml/aid_list',
            },
          },
        ],
      }),
    );

    return modConfig;
  });

  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const xmlDir = path.join(modConfig.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'aid_list.xml'),
        `<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/app_name"
    android:requireDeviceUnlock="true">
  <aid-group android:category="other" android:description="@string/app_name">
    <aid-filter android:name="${HCE_AID}" />
  </aid-group>
</host-apdu-service>
`,
      );

      return modConfig;
    },
  ]);
}

module.exports = withAndroidHce;
