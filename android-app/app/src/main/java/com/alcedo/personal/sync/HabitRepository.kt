package com.alcedo.personal.sync

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.alcedo.personal.ui.util.TimeUtils
import java.time.Instant
import java.util.UUID

class HabitRepository(private val context: Context, private val dao: HabitDao) {

    fun observeAll() = dao.observeAllHabits()
    fun observeActive() = dao.observeActiveHabits()

    suspend fun syncFromServer() = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext
        val remote = client.fetchAll() ?: return@withContext
        dao.insertAll(remote)
        if (remote.isNotEmpty()) dao.deleteNotIn(remote.map { it.id })
    }

    suspend fun create(name: String, notifyTime: String? = null, allowedMissDays: Int = 0): Boolean = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext false
        val now = Instant.now().toString()
        val entity = HabitEntity(UUID.randomUUID().toString(), name.trim(), notifyTime, true, now, now, allowedMissDays)
        val result = client.upsert(entity)
        if (result != null) { dao.upsert(result); true } else false
    }

    suspend fun update(habit: HabitEntity): Boolean = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext false
        val updated = habit.copy(updatedAt = Instant.now().toString())
        val result = client.upsert(updated)
        if (result != null) { dao.upsert(result); true } else false
    }

    suspend fun delete(habit: HabitEntity): Boolean = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext false
        if (client.delete(habit.id)) {
            dao.deleteLogsForHabit(habit.id)
            dao.delete(habit)
            true
        } else false
    }

    suspend fun checkIn(habitId: String): Boolean = withContext(Dispatchers.IO) {
        val today = TimeUtils.effectiveLocalDateStr()
        val client = buildClient()
        // optimistically insert locally
        dao.insertLog(HabitLogEntity(habitId, today, Instant.now().toString()))
        client?.checkIn(habitId, today) ?: true
    }

    private fun buildClient(): HabitSyncApiClient? {
        val url = SyncConfig.getServerUrl(context).takeIf { it.isNotBlank() } ?: return null
        val key = SyncConfig.getApiKey(context)
        return HabitSyncApiClient(url, key)
    }
}
