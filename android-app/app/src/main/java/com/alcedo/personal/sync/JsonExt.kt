package com.alcedo.personal.sync

import org.json.JSONObject

/** optString returns JSON null as the string "null", so check isNull() first. */
internal fun JSONObject.nullableString(key: String): String? {
    if (isNull(key)) return null
    return optString(key, "").takeIf { it.isNotEmpty() && it != "null" }
}
