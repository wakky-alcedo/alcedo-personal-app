package com.alcedo.personal.sync

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class BeliefSyncApiClient(private val baseUrl: String, private val apiKey: String) {

    fun fetchAll(): List<BeliefEntity>? = runCatching {
        val conn = openGet("$baseUrl/api/v1/beliefs")
        if (conn.responseCode !in 200..299) return null
        val json = conn.inputStream.bufferedReader().readText()
        conn.disconnect()
        // サーバーは { "beliefs": [...] } を返す
        val arr = JSONObject(json).getJSONArray("beliefs")
        (0 until arr.length()).map { parseBeliefObject(arr.getJSONObject(it)) }
    }.getOrNull()

    fun upsert(belief: BeliefEntity): BeliefEntity? = runCatching {
        val conn = openPost("$baseUrl/api/v1/beliefs")
        val body = JSONObject()
            .put("id", belief.id)
            .put("text", belief.text)
            .put("isActive", belief.isActive)
            .put("createdAt", belief.createdAt)
            .put("updatedAt", belief.updatedAt)
        conn.outputStream.bufferedWriter().use { it.write(body.toString()) }
        if (conn.responseCode !in 200..299) return null
        val resp = conn.inputStream.bufferedReader().readText()
        conn.disconnect()
        // サーバーは { "belief": {...} } を返す
        parseBeliefObject(JSONObject(resp).getJSONObject("belief"))
    }.getOrNull()

    fun delete(id: String): Boolean = runCatching {
        val conn = (URL("$baseUrl/api/v1/beliefs/$id").openConnection() as HttpURLConnection).apply {
            requestMethod = "DELETE"
            setRequestProperty("X-Api-Key", apiKey)
            connectTimeout = 5000; readTimeout = 5000
        }
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

    private fun parseBeliefObject(obj: JSONObject) = BeliefEntity(
        id        = obj.getString("id"),
        text      = obj.getString("text"),
        isActive  = obj.optBoolean("isActive", true),
        createdAt = obj.optString("createdAt", ""),
        updatedAt = obj.optString("updatedAt", "")
    )
}
