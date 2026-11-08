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

    /** The server keeps the newer of the stored and sent updatedAt and returns what it stored. */
    fun upsert(belief: BeliefEntity): PushOutcome<BeliefEntity> {
        val body = JSONObject()
            .put("id", belief.id)
            .put("text", belief.text)
            .put("isActive", belief.isActive)
            .put("createdAt", belief.createdAt)
            .put("updatedAt", belief.updatedAt)
        val result = http.post("/api/v1/beliefs", body.toString())
        // サーバーは { "belief": {...} } を返す
        val stored = (result as? ApiResult.Success)?.let {
            runCatching { parseBeliefObject(JSONObject(it.body).getJSONObject("belief")) }.getOrNull()
        }
        return PushOutcome(result.toPushResult(), stored)
    }

    /** Idempotent on the server: deleting an already deleted or unknown id also succeeds. */
    fun delete(id: String): PushResult = http.delete("/api/v1/beliefs/$id").toPushResult()

    private fun parseBeliefObject(obj: JSONObject) = BeliefEntity(
        id        = obj.getString("id"),
        text      = obj.getString("text"),
        isActive  = obj.optBoolean("isActive", true),
        createdAt = obj.optString("createdAt", ""),
        updatedAt = obj.optString("updatedAt", "")
    )
}
