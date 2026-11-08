package com.alcedo.personal.sync

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

private const val TAG = "MemoSyncApiClient"

class MemoSyncApiClient(private val http: ApiHttpClient) {
    /** One page of GET /memos?since=; [nextCursor] is null on the last page. */
    data class MemoPage(val memos: List<MemoEntity>, val nextCursor: String?)

    fun pullPage(since: String, cursor: String?, limit: Int): MemoPage? {
        val query = buildString {
            append("since=").append(URLEncoder.encode(since, "UTF-8"))
            append("&limit=").append(limit)
            if (cursor != null) append("&cursor=").append(URLEncoder.encode(cursor, "UTF-8"))
        }
        val body = when (val result = http.get("/api/v1/memos?$query", HttpTimeouts.LONG_READ)) {
            is ApiResult.Success -> result.body
            is ApiResult.HttpError -> { Log.w(TAG, "pullMemos failed: HTTP ${result.status}"); return null }
            is ApiResult.NetworkError -> { Log.e(TAG, "pullMemos error", result.cause); return null }
        }
        return runCatching {
            val obj = JSONObject(body)
            val arr = obj.optJSONArray("memos") ?: JSONArray()
            Log.d(TAG, "pullMemos ok: ${arr.length()} memo(s)")
            MemoPage((0 until arr.length()).map { i -> parseMemo(arr.getJSONObject(i)) }, obj.nullableString("nextCursor"))
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
