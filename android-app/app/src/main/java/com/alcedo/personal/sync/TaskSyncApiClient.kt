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
