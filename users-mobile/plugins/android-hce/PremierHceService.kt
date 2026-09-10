package __PACKAGE__

import android.app.KeyguardManager
import android.content.Context
import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.os.PowerManager
import android.os.SystemClock
import java.nio.charset.StandardCharsets

class PremierHceService : HostApduService() {
    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        if (commandApdu == null || !commandApdu.contentEquals(SELECT_PREMIER_AID)) return NOT_FOUND
        val locked = (getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked
        val awake = (getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive
        if (locked || !awake) { PremierHceTokenStore.clear(); return NOT_READY }
        val token = PremierHceTokenStore.current(SystemClock.elapsedRealtime()) ?: return NOT_READY
        return token.toByteArray(StandardCharsets.UTF_8) + SUCCESS
    }

    override fun onDeactivated(reason: Int) { PremierHceTokenStore.clear() }
    override fun onDestroy() { PremierHceTokenStore.clear(); super.onDestroy() }

    companion object {
        private val SELECT_PREMIER_AID = byteArrayOf(0x00,0xA4.toByte(),0x04,0x00,0x07,0xF0.toByte(),0x01,0x02,0x03,0x04,0x05,0x06,0x00)
        private val SUCCESS = byteArrayOf(0x90.toByte(),0x00)
        private val NOT_FOUND = byteArrayOf(0x6A,0x82.toByte())
        private val NOT_READY = byteArrayOf(0x69,0x85.toByte())
    }
}
