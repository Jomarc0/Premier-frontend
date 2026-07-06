const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

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
    android:requireDeviceUnlock="false">
  <!-- This AID must exactly match the ESP32 SELECT APDU payload: ${HCE_AID}. -->
  <aid-group android:category="other" android:description="@string/app_name">
    <aid-filter android:name="${HCE_AID}" />
  </aid-group>
</host-apdu-service>
`;
}

function createKotlinService(packageName) {
  return `package ${packageName}

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log
import java.nio.charset.StandardCharsets

class PremierHceService : HostApduService() {
    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        val command = commandApdu ?: return STATUS_AID_NOT_FOUND
        Log.d(TAG, "Received APDU: \${command.toHex()}")

        // The AID must exactly match the ESP32 SELECT APDU:
        // 00 A4 04 00 07 F0 01 02 03 04 05 06 00.
        if (!command.contentEquals(SELECT_PREMIER_AID)) {
            Log.w(TAG, "AID not recognized for APDU: \${command.toHex()}")
            return STATUS_AID_NOT_FOUND
        }

        Log.i(TAG, "Premier HCE service selected successfully")

        val token = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .getString(KEY_MOBILE_NFC_TOKEN, null)
            ?.takeIf { it.isNotBlank() }

        if (token == null) {
            Log.w(TAG, "No mobile NFC token saved. Open Mobile NFC Payment first.")
            return STATUS_CONDITIONS_NOT_SATISFIED
        }

        return token.toByteArray(StandardCharsets.UTF_8) + STATUS_SUCCESS
    }

    override fun onDeactivated(reason: Int) {
        Log.i(TAG, "Premier HCE deactivated from NFC field. reason=$reason")
    }

    private fun ByteArray.toHex(): String = joinToString("") { "%02X".format(it) }

    companion object {
        private const val TAG = "PremierHceService"
        private const val PREFS_NAME = "premier_hce"
        private const val KEY_MOBILE_NFC_TOKEN = "mobile_nfc_token"
        private val SELECT_PREMIER_AID = byteArrayOf(
            0x00.toByte(),
            0xA4.toByte(),
            0x04.toByte(),
            0x00.toByte(),
            0x07.toByte(),
            0xF0.toByte(),
            0x01.toByte(),
            0x02.toByte(),
            0x03.toByte(),
            0x04.toByte(),
            0x05.toByte(),
            0x06.toByte(),
            0x00.toByte(),
        )
        private val STATUS_SUCCESS = byteArrayOf(0x90.toByte(), 0x00.toByte())
        private val STATUS_AID_NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())
        private val STATUS_CONDITIONS_NOT_SATISFIED = byteArrayOf(0x69.toByte(), 0x85.toByte())
    }
}
`;
}

function createTokenModule(packageName) {
  return `package ${packageName}

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PremierHceTokenModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PremierHceTokenModule"

    @ReactMethod
    fun setToken(token: String, promise: Promise) {
        reactContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_MOBILE_NFC_TOKEN, token)
            .apply()
        promise.resolve(true)
    }

    @ReactMethod
    fun clearToken(promise: Promise) {
        reactContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_MOBILE_NFC_TOKEN)
            .apply()
        promise.resolve(true)
    }

    companion object {
        private const val PREFS_NAME = "premier_hce"
        private const val KEY_MOBILE_NFC_TOKEN = "mobile_nfc_token"
    }
}
`;
}

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
      fs.writeFileSync(path.join(serviceDir, HCE_PACKAGE_CLASS_NAME), createHcePackage(packageName));
      ensurePremierPackageRegistered(path.join(serviceDir, 'MainApplication.kt'));

      return modConfig;
    },
  ]);
}

module.exports = withAndroidHce;
