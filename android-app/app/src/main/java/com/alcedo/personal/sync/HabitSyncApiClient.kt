package com.alcedo.personal.sync

import org.json.JSONArray
import org.json.JSONObject

class HabitSyncApiClient(private val http: ApiHttpClient) {

    fun fetchAll(): List<HabitEntity>? {
        val result = http.get("/api/v1/habits") as? ApiResult.Success ?: return null
        return runCatching {
            val arr = JSONObject(result.body).optJSONArray("habits") ?: JSONArray(result.body)
            (0 until arr.length()).map { parseHabitObject(arr.getJSONObject(it)) }
        }.getOrNull()
    }

    /** The server keeps the newer of the stored and sent updatedAt and returns what it stored. */
    fun upsert(habit: HabitEntity): PushOutcome<HabitEntity> {
        val body = JSONObject()
            .put("id", habit.id)
            .put("name", habit.name)
            .put("notifyTime", habit.notifyTime)
            .put("allowedMissDays", habit.allowedMissDays)
            .put("isActive", habit.isActive)
            .put("createdAt", habit.createdAt)
            .put("updatedAt", habit.updatedAt)
        val result = http.post("/api/v1/habits", body.toString())
        val stored = (result as? ApiResult.Success)?.let {
            runCatching {
                val resp = JSONObject(it.body)
                parseHabitObject(resp.optJSONObject("habit") ?: resp)
            }.getOrNull()
        }
        return PushOutcome(result.toPushResult(), stored)
    }

    /** Idempotent on the server: deleting an already deleted or unknown id also succeeds. */
    fun delete(id: String): PushResult = http.delete("/api/v1/habits/$id").toPushResult()

    /** See [toPushResult] for which failures are dropped rather than retried. */
    fun checkIn(habitId: String, doneDate: String): PushResult {
        val body = JSONObject().put("doneDate", doneDate)
        return http.post("/api/v1/habits/$habitId/logs", body.toString()).toPushResult()
    }

    /** GET /habits/logs?from&to → done dates as SYNCED log rows, or null on failure. */
    fun fetchLogs(from: String, to: String): List<HabitLogEntity>? {
        val result = http.get("/api/v1/habits/logs?from=$from&to=$to") as? ApiResult.Success ?: return null
        return runCatching {
            val arr = JSONArray(result.body)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                val doneDate = obj.getString("doneDate")
                HabitLogEntity(obj.getString("habitId"), doneDate, doneDate, SyncStatus.SYNCED)
            }
        }.getOrNull()
    }

    private fun parseHabitObject(obj: JSONObject) = HabitEntity(
        id = obj.getString("id"),
        name = obj.getString("name"),
        notifyTime = obj.nullableString("notifyTime"),
        isActive = obj.optBoolean("isActive", true),
        createdAt = obj.optString("createdAt", ""),
        updatedAt = obj.optString("updatedAt", ""),
        allowedMissDays = obj.optInt("allowedMissDays", 0)
    )
}
