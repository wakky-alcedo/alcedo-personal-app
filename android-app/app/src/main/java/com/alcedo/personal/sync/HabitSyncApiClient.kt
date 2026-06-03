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

    fun checkIn(habitId: String, doneDate: String): Boolean = runCatching {
        val conn = openPost("$baseUrl/api/v1/habits/$habitId/logs")
        val body = JSONObject().put("doneDate", doneDate)
        conn.outputStream.bufferedWriter().use { it.write(body.toString()) }
        val ok = conn.responseCode in 200..299
        conn.disconnect()
        ok
    }.getOrElse { false }

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
        notifyTime = obj.optString("notifyTime").takeIf { it.isNotEmpty() },
        isActive = obj.optBoolean("isActive", true),
        createdAt = obj.optString("createdAt", ""),
        updatedAt = obj.optString("updatedAt", "")
    )
}
