package com.alcedo.personal.sync

import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class MemoSyncApiClient(
    private val baseUrl: String,
    private val apiKey: String
) {
    fun pullMemos(since: String): List<MemoEntity>? = runCatching {
        val conn = (URL("$baseUrl/api/v1/memos?since=$since&limit=200").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("X-Api-Key", apiKey)
            connectTimeout = 5000; readTimeout = 10000
        }
        if (conn.responseCode !in 200..299) return null
        val json = conn.inputStream.bufferedReader().readText()
        conn.disconnect()
        val arr = JSONObject(json).optJSONArray("memos") ?: JSONArray()
        (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            MemoEntity(
                id = obj.getString("id"),
                body = obj.optString("body", ""),
                sourceUrl = obj.nullableString("sourceUrl"),
                sourceTitle = obj.nullableString("sourceTitle"),
                version = obj.optInt("version", 1),
                syncStatus = SyncStatus.SYNCED,
                createdAt = obj.optString("createdAt", ""),
                updatedAt = obj.optString("updatedAt", ""),
                deletedAt = obj.nullableString("deletedAt")
            )
        }
    }.getOrNull()

    fun pushMemos(memos: List<MemoEntity>): Boolean {
        if (memos.isEmpty()) return true

        val conn = (URL("$baseUrl/api/v1/sync/memos").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("X-Api-Key", apiKey)
            doOutput = true
            connectTimeout = 5000; readTimeout = 5000
        }

        val upserts = JSONArray()
        val deletions = JSONArray()

        for (memo in memos) {
            if (memo.deletedAt != null) {
                deletions.put(JSONObject().put("id", memo.id).put("updatedAt", memo.updatedAt).put("version", memo.version))
            } else {
                upserts.put(
                    JSONObject()
                        .put("id", memo.id)
                        .put("body", memo.body)
                        .put("sourceUrl", memo.sourceUrl)
                        .put("sourceTitle", memo.sourceTitle)
                        .put("version", memo.version)
                        .put("createdAt", memo.createdAt)
                        .put("updatedAt", memo.updatedAt)
                )
            }
        }

        val payload = JSONObject().put("upserts", upserts).put("deletions", deletions)
        OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()) }
        val ok = conn.responseCode in 200..299
        conn.disconnect()
        return ok
    }
}

private fun JSONObject.nullableString(key: String): String? {
    if (isNull(key)) return null
    return optString(key, "").takeIf { it.isNotEmpty() && it != "null" }
}
