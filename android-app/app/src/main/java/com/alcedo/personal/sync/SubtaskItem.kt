package com.alcedo.personal.sync

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class SubtaskItem(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val done: Boolean = false
)

fun String?.toSubtasks(): List<SubtaskItem> {
    if (isNullOrBlank()) return emptyList()
    return try {
        val arr = JSONArray(this)
        (0 until arr.length()).mapNotNull { i ->
            val obj = arr.getJSONObject(i)
            val title = obj.optString("title", "").trim()
            if (title.isEmpty()) null
            else SubtaskItem(
                id = obj.optString("id", UUID.randomUUID().toString()),
                title = title,
                done = obj.optBoolean("done", false)
            )
        }
    } catch (e: Exception) { emptyList() }
}

fun List<SubtaskItem>.toJsonString(): String {
    val arr = JSONArray()
    forEach { s ->
        arr.put(JSONObject()
            .put("id", s.id)
            .put("title", s.title)
            .put("done", s.done)
            .put("subtasks", JSONArray())
        )
    }
    return arr.toString()
}
