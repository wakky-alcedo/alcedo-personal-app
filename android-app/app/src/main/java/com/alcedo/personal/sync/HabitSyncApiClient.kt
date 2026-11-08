package com.alcedo.personal.sync

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class HabitSyncApiClient(private val baseUrl: String, private val apiKey: String) {

    fun fetchAll(): List<HabitEntity>? = runCatching {
        val conn = openGet("$baseUrl/api/v1/habits")
        if (conn.responseCode !in 200..299) return null
        val json = conn.inputStream.bufferedReader().readText()
        conn.disconnect()
        val obj = JSONObject(json)
        val arr = obj.optJSONArray("habits") ?: JSONArray(json)
        (0 until arr.length()).map { parseHabitObject(arr.getJSONObject(it)) }
    }.getOrNull()

    fun upsert(habit: HabitEntity): HabitEntity? = runCatching {
        val conn = openPost("$baseUrl/api/v1/habits")
        val body = JSONObject()
            .put("id", habit.id)
            .put("name", habit.name)
            .put("notifyTime", habit.notifyTime)
            .put("allowedMissDays", habit.allowedMissDays)
            .put("isActive", habit.isActive)
            .put("createdAt", habit.createdAt)
            .put("updatedAt", habit.updatedAt)
        conn.outputStream.bufferedWriter().use { it.write(body.toString()) }
        if (conn.responseCode !in 200..299) return null
        val resp = JSONObject(conn.inputStream.bufferedReader().readText())
        conn.disconnect()
        parseHabitObject(resp.optJSONObject("habit") ?: resp)
    }.getOrNull()

    fun delete(id: String): Boolean = runCatching {
        val conn = (URL("$baseUrl/api/v1/habits/$id").openConnection() as HttpURLConnection).apply {
            requestMethod = "DELETE"
            setRequestProperty("X-Api-Key", apiKey)
            connectTimeout = 5000; readTimeout = 5000
        }
        val ok = conn.responseCode in 200..299
        conn.disconnect()
        ok
    }.getOrElse { false }

    enum class PushResult { OK, RETRYABLE, REJECTED }

    /**
     * REJECTED means the server will never accept this check-in (habit deleted, invalid date),
     * so the caller should drop it instead of retrying forever. Auth/server errors stay RETRYABLE.
     */
    fun checkIn(habitId: String, doneDate: String): PushResult = runCatching {
        val conn = openPost("$baseUrl/api/v1/habits/$habitId/logs")
        try {
            val body = JSONObject().put("doneDate", doneDate)
            conn.outputStream.bufferedWriter().use { it.write(body.toString()) }
            when (conn.responseCode) {
                in 200..299 -> PushResult.OK
                400, 404 -> PushResult.REJECTED
                else -> PushResult.RETRYABLE
            }
        } finally {
            conn.disconnect()
        }
    }.getOrElse { PushResult.RETRYABLE }

    /** GET /habits/logs?from&to → done dates as SYNCED log rows, or null on failure. */
    fun fetchLogs(from: String, to: String): List<HabitLogEntity>? = runCatching {
        val conn = openGet("$baseUrl/api/v1/habits/logs?from=$from&to=$to")
        try {
            if (conn.responseCode !in 200..299) return null
            val arr = JSONArray(conn.inputStream.bufferedReader().readText())
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                val doneDate = obj.getString("doneDate")
                HabitLogEntity(obj.getString("habitId"), doneDate, doneDate, SyncStatus.SYNCED)
            }
        } finally {
            conn.disconnect()
        }
    }.getOrNull()

    private fun openGet(url: String) = (URL(url).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        setRequestProperty("X-Api-Key", apiKey)
        connectTimeout = 5000; readTimeout = 5000
    }

    private fun openPost(url: String) = (URL(url).openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("X-Api-Key", apiKey)
        doOutput = true
        connectTimeout = 5000; readTimeout = 5000
    }

    private fun parseHabitObject(obj: JSONObject) = HabitEntity(
        id = obj.getString("id"),
        name = obj.getString("name"),
        notifyTime = if (obj.isNull("notifyTime")) null
                     else obj.optString("notifyTime", "").takeIf { it.isNotEmpty() && it != "null" },
        isActive = obj.optBoolean("isActive", true),
        createdAt = obj.optString("createdAt", ""),
        updatedAt = obj.optString("updatedAt", ""),
        allowedMissDays = obj.optInt("allowedMissDays", 0)
    )
}
