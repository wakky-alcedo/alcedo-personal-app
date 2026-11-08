package com.alcedo.personal.sync

import org.json.JSONObject

class BeliefSyncApiClient(private val http: ApiHttpClient) {

    fun fetchAll(): List<BeliefEntity>? {
        val result = http.get("/api/v1/beliefs") as? ApiResult.Success ?: return null
        return runCatching {
            // サーバーは { "beliefs": [...] } を返す
            val arr = JSONObject(result.body).getJSONArray("beliefs")
            (0 until arr.length()).map { parseBeliefObject(arr.getJSONObject(it)) }
        }.getOrNull()
    }

    fun upsert(belief: BeliefEntity): BeliefEntity? {
        val body = JSONObject()
            .put("id", belief.id)
            .put("text", belief.text)
            .put("isActive", belief.isActive)
            .put("createdAt", belief.createdAt)
            .put("updatedAt", belief.updatedAt)
        val result = http.post("/api/v1/beliefs", body.toString()) as? ApiResult.Success ?: return null
        // サーバーは { "belief": {...} } を返す
        return runCatching { parseBeliefObject(JSONObject(result.body).getJSONObject("belief")) }.getOrNull()
    }

    fun delete(id: String): Boolean = http.delete("/api/v1/beliefs/$id") is ApiResult.Success

    private fun parseBeliefObject(obj: JSONObject) = BeliefEntity(
        id        = obj.getString("id"),
        text      = obj.getString("text"),
        isActive  = obj.optBoolean("isActive", true),
        createdAt = obj.optString("createdAt", ""),
        updatedAt = obj.optString("updatedAt", "")
    )
}
