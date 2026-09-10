package __PACKAGE__

/** No persistence. Generations fence late HTTP/native callbacks after clear, blur or logout. */
object PremierHceTokenStore {
    private var generation = 0L
    private var armed = false
    private var value: String? = null
    private var deadline = 0L

    @Synchronized fun begin(): Long {
        clear()
        armed = true
        return generation
    }

    @Synchronized fun set(token: String, ttlMs: Long, ownerGeneration: Long, nowMs: Long): Boolean {
        if (!armed || ownerGeneration != generation || ttlMs !in 1..120000 ||
            !token.startsWith("PREMIER-NFC:") || token.length > 1024) return false
        value = token
        deadline = nowMs + ttlMs
        return true
    }

    @Synchronized fun current(nowMs: Long): String? {
        if (!armed || nowMs >= deadline) { clear(); return null }
        return value
    }

    @Synchronized fun clear() {
        generation++
        armed = false
        value = null
        deadline = 0L
    }
}
