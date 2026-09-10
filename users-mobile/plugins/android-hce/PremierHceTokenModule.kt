package __PACKAGE__

import android.app.KeyguardManager
import android.content.Context
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.os.PowerManager
import android.os.SystemClock
import com.facebook.react.bridge.*
import com.facebook.react.common.LifecycleState

class PremierHceTokenModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
    init {
        PremierHceTokenStore.clear()
        reactContext.addLifecycleEventListener(this)
    }
    override fun getName() = "PremierHceTokenModule"
    private fun hceSupported(): Boolean =
        reactContext.packageManager.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION) &&
            NfcAdapter.getDefaultAdapter(reactContext) != null

    private fun available(): Boolean = reactContext.lifecycleState == LifecycleState.RESUMED &&
        reactContext.currentActivity != null &&
        !(reactContext.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked &&
        (reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive

    @ReactMethod fun beginSession(promise: Promise) {
        // Remove any legacy on-disk bearer token before acknowledging readiness.
        val removed = reactContext.getSharedPreferences("premier_hce",Context.MODE_PRIVATE).edit().clear().commit()
        if (!removed || !available()) { PremierHceTokenStore.clear(); promise.resolve(-1); return }
        promise.resolve(PremierHceTokenStore.begin().toDouble())
    }
    @ReactMethod fun setToken(token: String, ttlMs: Double, generation: Double, promise: Promise) {
        if (!available() || !ttlMs.isFinite() || !generation.isFinite()) {
            PremierHceTokenStore.clear(); promise.resolve(false); return
        }
        promise.resolve(PremierHceTokenStore.set(token,ttlMs.toLong(),generation.toLong(),SystemClock.elapsedRealtime()))
    }
    @ReactMethod fun clearToken(promise: Promise) { PremierHceTokenStore.clear(); promise.resolve(true) }
    @ReactMethod fun getStatus(promise: Promise) {
        val adapter = NfcAdapter.getDefaultAdapter(reactContext)
        val status = Arguments.createMap().apply {
            putBoolean("supported", hceSupported())
            putBoolean("enabled", adapter?.isEnabled == true)
        }
        promise.resolve(status)
    }
    @ReactMethod fun isReady(promise: Promise) {
        if (!available()) PremierHceTokenStore.clear()
        promise.resolve(available() && PremierHceTokenStore.current(SystemClock.elapsedRealtime()) != null)
    }
    override fun onHostResume() {}
    override fun onHostPause() { PremierHceTokenStore.clear() }
    override fun onHostDestroy() { PremierHceTokenStore.clear() }
    override fun invalidate() {
        PremierHceTokenStore.clear()
        reactContext.removeLifecycleEventListener(this)
        super.invalidate()
    }
}
