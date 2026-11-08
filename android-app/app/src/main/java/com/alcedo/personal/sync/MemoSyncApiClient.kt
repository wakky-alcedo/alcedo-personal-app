package com.alcedo.personal.sync

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

private const val TAG = "MemoSyncApiClient"

class MemoSyncApiClient(private val http: ApiHttpClient) {
    fun pullMemos(since: String): List<MemoEntity>? {
        val body = when (val result = http.get("/api/v1/memos?since=$since&limit=200", HttpTimeouts.LONG_READ)) {
            is ApiResult.Success -> result.body
            is ApiResult.HttpError -> { Log.w(TAG, "pullMemos failed: HTTP ${result.status}"); return null }
            is ApiResult.NetworkError -> { Log.e(TAG, "pullMemos error", result.cause); return null }
        }
        return runCatching {
            val arr = JSONObject(body).optJSONArray("memos") ?: JSONArray()
            Log.d(TAG, "pullMemos ok: ${arr.length()} memo(s)")
            (0 until arr.length()).map { i -> parseMemo(arr.getJSONObject(i)) }
        }.onFailure { Log.e(TAG, "pullMemos parse error", it) }.getOrNull()
    }

    fun pushMemos(memos: List<MemoEntity>): Boolean {
        if (memos.isEmpty()) return true

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
        val counts = "${upserts.length()} upsert(s), ${deletions.length()} deletion(s)"

        return when (val result = http.post("/api/v1/sync/memos", payload.toString())) {
            is ApiResult.Success -> { Log.d(TAG, "pushMemos ok: $counts"); true }
            is ApiResult.HttpError -> { Log.w(TAG, "pushMemos failed: HTTP ${result.status} ($counts)"); false }
            is ApiResult.NetworkError -> { Log.e(TAG, "pushMemos error", result.cause); false }
        }
    }

    private fun parseMemo(obj: JSONObject) = MemoEntity(
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
