package com.alcedo.personal.sync

import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class TaskSyncApiClient(
    private val baseUrl: String,
    private val apiKey: String
) {
    /** PC サーバーから全タスクを取得する */
    fun pullTasks(): List<TaskEntity>? = runCatching {
        val conn = (URL("$baseUrl/api/v1/tasks").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("X-Api-Key", apiKey)
            connectTimeout = 5000; readTimeout = 10000
        }
        if (conn.responseCode !in 200..299) return null
        val json = conn.inputStream.bufferedReader().readText()
        conn.disconnect()
        val arr = org.json.JSONArray(
            if (json.trimStart().startsWith("[")) json
            else org.json.JSONObject(json).optJSONArray("tasks")?.toString() ?: "[]"
        )
        (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            TaskEntity(
                id           = obj.getString("id"),
                title        = obj.optString("title", ""),
                description  = obj.nullableString("description"),
                categoryType = obj.optString("categoryType", "short_term"),
                categoryName = obj.optString("categoryName", "today"),
                priority     = obj.optString("priority", "medium"),
                dueAt        = obj.nullableString("dueAt"),
                status       = obj.optString("status", "todo"),
                syncStatus   = SyncStatus.SYNCED,
                deletedAt    = null,
                updatedAt    = obj.optString("updatedAt", ""),
                version      = obj.optInt("version", 1),
                subtasks     = obj.nullableString("subtasks") ?: "[]"
            )
        }
    }.getOrNull()

    fun pushTasks(tasks: List<TaskEntity>): Boolean {
        if (tasks.isEmpty()) return true

        val url = URL("$baseUrl/api/v1/sync/tasks")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("X-Api-Key", apiKey)
            doOutput = true
            connectTimeout = 5000
            readTimeout = 5000
        }

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
                        .put("status", task.status)
                        .put("updatedAt", task.updatedAt)
                        .put("version", task.version)
                )
            }
        }

        val payload = JSONObject()
            .put("upserts", upserts)
            .put("deletions", deletions)

        OutputStreamWriter(connection.outputStream).use { writer ->
            writer.write(payload.toString())
        }

        val ok = connection.responseCode in 200..299
        connection.disconnect()
        return ok
    }
}

/** optString は JSON null を文字列 "null" として返すため、isNull() で先にチェックする */
private fun JSONObject.nullableString(key: String): String? {
    if (isNull(key)) return null
    return optString(key, "").takeIf { it.isNotEmpty() && it != "null" }
}
