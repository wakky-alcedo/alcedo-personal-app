package com.alcedo.personal.sync

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

private const val TAG = "TaskSyncApiClient"
private const val EPOCH = "1970-01-01T00:00:00.000Z"

class TaskSyncApiClient(private val http: ApiHttpClient) {
    /** PC サーバーから全タスクを取得する */
    fun pullTasks(): List<TaskEntity>? {
        val body = when (val result = http.get("/api/v1/tasks", HttpTimeouts.LONG_READ)) {
            is ApiResult.Success -> result.body
            is ApiResult.HttpError -> { Log.w(TAG, "pullTasks failed: HTTP ${result.status}"); return null }
            is ApiResult.NetworkError -> { Log.e(TAG, "pullTasks error", result.cause); return null }
        }
        return runCatching {
            val arr = if (body.trimStart().startsWith("[")) JSONArray(body)
                      else JSONObject(body).optJSONArray("tasks") ?: JSONArray()
            (0 until arr.length()).map { i -> parseTask(arr.getJSONObject(i)) }
        }.onSuccess { Log.d(TAG, "pullTasks ok: ${it.size} task(s)") }
         .onFailure { Log.e(TAG, "pullTasks parse error", it) }
         .getOrNull()
    }

    data class TaskTombstone(val id: String, val updatedAt: String, val version: Int)

    /**
     * Tasks deleted on the server (GET /sync/changes). GET /tasks omits deleted rows, so
     * without this, deletions made on the web never reached the Android cache.
     */
    fun pullDeletions(): List<TaskTombstone>? {
        val body = when (val result = http.get("/api/v1/sync/changes?since=$EPOCH", HttpTimeouts.LONG_READ)) {
            is ApiResult.Success -> result.body
            is ApiResult.HttpError -> { Log.w(TAG, "pullDeletions failed: HTTP ${result.status}"); return null }
            is ApiResult.NetworkError -> { Log.e(TAG, "pullDeletions error", result.cause); return null }
        }
        return runCatching {
            val arr = JSONObject(body).optJSONArray("deletions") ?: JSONArray()
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                TaskTombstone(obj.getString("id"), obj.optString("updatedAt", ""), obj.optInt("version", 1))
            }
        }.onFailure { Log.e(TAG, "pullDeletions parse error", it) }.getOrNull()
    }

    fun pushTasks(tasks: List<TaskEntity>): Boolean {
        if (tasks.isEmpty()) return true

        val upserts = JSONArray()
        val deletions = JSONArray()
        for (task in tasks) {
            if (task.deletedAt != null) {
                deletions.put(
                    JSONObject()
                        .put("id", task.id)
                        .put("updatedAt", task.updatedAt)
                        .put("version", task.version)
                )
            } else {
                upserts.put(
                    JSONObject()
                        .put("id", task.id)
                        .put("title", task.title)
                        .put("description", task.description)
                        .put("categoryType", task.categoryType)
                        .put("categoryName", task.categoryName)
                        .put("priority", task.priority)
                        .put("dueAt", task.dueAt)
                        .put("dueTime", task.dueTime)
                        .put("status", task.status)
                        .put("updatedAt", task.updatedAt)
                        .put("version", task.version)
                )
            }
        }
        val payload = JSONObject().put("upserts", upserts).put("deletions", deletions)
        val counts = "${upserts.length()} upsert(s), ${deletions.length()} deletion(s)"

        return when (val result = http.post("/api/v1/sync/tasks", payload.toString())) {
            is ApiResult.Success -> { Log.d(TAG, "pushTasks ok: $counts"); true }
            is ApiResult.HttpError -> { Log.w(TAG, "pushTasks failed: HTTP ${result.status} ($counts)"); false }
            is ApiResult.NetworkError -> { Log.e(TAG, "pushTasks error", result.cause); false }
        }
    }

    private fun parseTask(obj: JSONObject) = TaskEntity(
        id           = obj.getString("id"),
        title        = obj.optString("title", ""),
        description  = obj.nullableString("description"),
        categoryType = obj.optString("categoryType", "short_term"),
        categoryName = obj.optString("categoryName", "today"),
        priority     = obj.optString("priority", "medium"),
        dueAt        = obj.nullableString("dueAt"),
        dueTime      = obj.nullableString("dueTime"),
        status       = obj.optString("status", "todo"),
        syncStatus   = SyncStatus.SYNCED,
        deletedAt    = null,
        updatedAt    = obj.optString("updatedAt", ""),
        version      = obj.optInt("version", 1),
        subtasks     = obj.nullableString("subtasks") ?: "[]"
    )
}
