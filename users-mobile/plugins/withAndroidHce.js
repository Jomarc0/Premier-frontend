const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');

const HCE_AID = 'F0010203040506';
const SERVICE_NAME = '.PremierHceService';
const SERVICE_CLASS_NAME = 'PremierHceService.kt';
const TOKEN_MODULE_CLASS_NAME = 'PremierHceTokenModule.kt';
const HCE_PACKAGE_CLASS_NAME = 'PremierHcePackage.kt';

function ensureManifestItem(items = [], androidName, createItem) {
  const list = Array.isArray(items) ? items : [];
  return list.some((item) => item?.$?.['android:name'] === androidName) ? list : [...list, createItem()];
}

function removeManifestItems(items = [], androidNames = []) {
  const blocked = new Set(androidNames);
  return (Array.isArray(items) ? items : []).filter((item) => !blocked.has(item?.$?.['android:name']));
}

function getPackageName(config, modConfig) {
  return (
    config.android?.package ||
    modConfig.android?.package ||
    modConfig.modResults.manifest.$?.package ||
    'com.togi012322.premier'
  );
}

function createHceServiceManifestItem() {
  return {
    $: {
      'android:name': SERVICE_NAME,
      'android:exported': 'true',
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
      },
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.nfc.cardemulation.host_apdu_service',
          'android:resource': '@xml/apduservice',
        },
      },
    ],
  };
}

function createApduServiceXml() {
  return `<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/app_name"
    android:requireDeviceUnlock="true">
  <!-- This AID must exactly match the ESP32 SELECT APDU payload: ${HCE_AID}. -->
  <aid-group android:category="other" android:description="@string/app_name">
    <aid-filter android:name="${HCE_AID}" />
  </aid-group>
</host-apdu-service>
`;
}

function readKotlinTemplate(name, packageName) {
  return fs.readFileSync(path.join(__dirname, 'android-hce', name), 'utf8').replaceAll('__PACKAGE__', packageName);
}
function createKotlinService(packageName) { return readKotlinTemplate('PremierHceService.kt', packageName); }
function createTokenModule(packageName) { return readKotlinTemplate('PremierHceTokenModule.kt', packageName); }

function createHcePackage(packageName) {
  return `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PremierHcePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(PremierHceTokenModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;
}

function ensurePremierPackageRegistered(mainApplicationPath) {
  if (!fs.existsSync(mainApplicationPath)) {
    return;
  }

  const source = fs.readFileSync(mainApplicationPath, 'utf8');
  if (source.includes('add(PremierHcePackage())')) {
    return;
  }

  const updated = source.replace(
    '// add(MyReactNativePackage())',
    '// add(MyReactNativePackage())\n              add(PremierHcePackage())',
  );

  fs.writeFileSync(mainApplicationPath, updated);
}

const releaseSigningBlock = "// PREMIER_RELEASE_SIGNING_BEGIN\nandroid.buildTypes.release.signingConfig = null\nandroid.buildTypes.release.debuggable = false\ndef premierSigning = [\n    store: System.getenv(\"PREMIER_UPLOAD_KEYSTORE\"),\n    password: System.getenv(\"PREMIER_UPLOAD_STORE_PASSWORD\"),\n    alias: System.getenv(\"PREMIER_UPLOAD_KEY_ALIAS\"),\n    keyPassword: System.getenv(\"PREMIER_UPLOAD_KEY_PASSWORD\")\n]\nif (premierSigning.values().every { it != null && !it.isBlank() }) {\n    android.signingConfigs.create(\"premierRelease\") {\n        storeFile file(premierSigning.store)\n        storePassword premierSigning.password\n        keyAlias premierSigning.alias\n        keyPassword premierSigning.keyPassword\n    }\n    android.buildTypes.release.signingConfig = android.signingConfigs.premierRelease\n}\ndef verifyPremierReleaseSigning = tasks.register(\"verifyPremierReleaseSigning\") {\n    doLast {\n        if (!premierSigning.values().every { it != null && !it.isBlank() } ||\n                !file(premierSigning.store).isFile() ||\n                file(premierSigning.store).name == \"debug.keystore\" || premierSigning.alias == \"androiddebugkey\") {\n            throw new GradleException(\"Release signing requires the approved Premier upload keystore and signing environment variables. Debug signing is forbidden.\")\n        }\n    }\n}\ntasks.configureEach { task ->\n    if (task.name.toLowerCase().contains(\"release\") &&\n            [\"assemble\", \"bundle\", \"package\", \"validatesigning\"].any { task.name.toLowerCase().startsWith(it) }) {\n        task.dependsOn(verifyPremierReleaseSigning)\n    }\n}\n// PREMIER_RELEASE_SIGNING_END\n";

const effectiveReleaseSigningBlock = releaseSigningBlock
  .replace(
    'android.buildTypes.release.signingConfig = null\n',
    '',
  )
  .replace(
    '        if (!premierSigning.values().every { it != null && !it.isBlank() } ||\n                !file(premierSigning.store).isFile() ||\n                file(premierSigning.store).name == "debug.keystore" || premierSigning.alias == "androiddebugkey") {',
    '        def releaseSigning = android.buildTypes.release.signingConfig\n        if (releaseSigning == null ||\n                releaseSigning.storeFile == null ||\n                !releaseSigning.storeFile.isFile() ||\n                releaseSigning.storeFile.name == "debug.keystore" ||\n                releaseSigning.keyAlias == "androiddebugkey") {',
  );

function withAndroidHce(config) {
  config = withAppBuildGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes('// PREMIER_RELEASE_SIGNING_BEGIN')) {
      modConfig.modResults.contents += '\n' + effectiveReleaseSigningBlock;
    }
    return modConfig;
  });
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
          'android:required': 'false',
        },
      }),
    );

    const application = manifest.application?.[0];
    if (!application) {
      return modConfig;
    }

    application.$['android:allowBackup'] = 'false';
    application.$['android:usesCleartextTraffic'] = 'false';
    application.service = removeManifestItems(application.service, [
      SERVICE_NAME,
      'com.reactnativehce.services.CardService',
    ]);
    application.service = [...application.service, createHceServiceManifestItem()];

    return modConfig;
  });

  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const packageName = getPackageName(config, modConfig);
      const packagePath = packageName.split('.').join(path.sep);
      const mainRoot = path.join(modConfig.modRequest.platformProjectRoot, 'app', 'src', 'main');
      const xmlDir = path.join(mainRoot, 'res', 'xml');
      const serviceDir = path.join(mainRoot, 'java', packagePath);

      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'apduservice.xml'), createApduServiceXml());

      fs.mkdirSync(serviceDir, { recursive: true });
      fs.writeFileSync(path.join(serviceDir, SERVICE_CLASS_NAME), createKotlinService(packageName));
      fs.writeFileSync(path.join(serviceDir, TOKEN_MODULE_CLASS_NAME), createTokenModule(packageName));
      fs.writeFileSync(path.join(serviceDir, 'PremierHceTokenStore.kt'), readKotlinTemplate('PremierHceTokenStore.kt', packageName));
      fs.writeFileSync(path.join(serviceDir, HCE_PACKAGE_CLASS_NAME), createHcePackage(packageName));
      ensurePremierPackageRegistered(path.join(serviceDir, 'MainApplication.kt'));

      return modConfig;
    },
  ]);
}

module.exports = withAndroidHce;
