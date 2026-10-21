package dev.dsh.mobile.protocol

import kotlinx.serialization.json.*

/** Each projection unit can finish at a different durable sequence. A newer
 * title must not discard a slower permissions/statistics update. Full
 * baselines clear omitted keys unless a newer field update superseded them. */
data class SessionProjections(val values: JsonObject = JsonObject(emptyMap()), val versions: Map<String, Long> = emptyMap()) {
    fun apply(key: String, value: JsonElement, seq: Long): SessionProjections {
        if (seq < -1 || key.isBlank()) throw GatewayFailure("invalid-response")
        if (seq <= (versions[key] ?: -2)) return this
        return copy(values = JsonObject(values + (key to value)), versions = versions + (key to seq))
    }
    fun seed(incoming: JsonObject, seq: Long): SessionProjections {
        if (seq < -1) throw GatewayFailure("invalid-response")
        var merged = this
        incoming.forEach { (key, value) -> merged = merged.apply(key, value, seq) }
        val removed = merged.values.keys.filter { it !in incoming && (merged.versions[it] ?: -2) <= seq }
        return merged.copy(values = JsonObject(merged.values.filterKeys { it !in removed }),
            versions = merged.versions.filterKeys { it !in removed })
    }
}
