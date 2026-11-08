package com.alcedo.personal.sync

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.alcedo.personal.ui.util.TimeUtils
import java.time.Instant
import java.util.UUID

private const val TAG = "HabitRepository"

class HabitRepository(private val context: Context, private val dao: HabitDao) {

    companion object {
        /** Days of check-in history mirrored from the server on each sync (covers streaks over a year). */
        const val LOG_PULL_DAYS = 400
    }

    fun observeAll() = dao.observeAllHabits()
    fun observeActive() = dao.observeActiveHabits()
    fun observeLogs() = dao.observeAllLogs()

    /** Pushes queued check-ins, then mirrors habits and recent check-ins from the server. */
    suspend fun syncFromServer() = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext
        pushPendingLogs(client)

        val remote = client.fetchAll() ?: return@withContext
        dao.insertAll(remote)
        if (remote.isEmpty()) dao.deleteAll() else dao.deleteNotIn(remote.map { it.id })
        dao.deleteOrphanLogs()

        val to = TimeUtils.effectiveLocalDateStr()
        val from = TimeUtils.effectiveDaysAgo(LOG_PULL_DAYS - 1)
        val logs = client.fetchLogs(from, to) ?: return@withContext
        dao.replaceSyncedLogs(from, to, logs)
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

    /**
     * Records today's check-in locally (UNSENT) and tries to push it right away.
     * Returns false when it is queued for retry by HabitLogSyncWorker instead.
     */
    suspend fun checkIn(habitId: String): Boolean = withContext(Dispatchers.IO) {
        val today = TimeUtils.effectiveLocalDateStr()
        dao.insertLog(HabitLogEntity(habitId, today, Instant.now().toString(), SyncStatus.UNSENT))
        val pushed = buildClient()?.let { pushPendingLogs(it) } ?: false
        if (!pushed) HabitLogSyncScheduler.enqueue(context)
        pushed
    }

    /** Sends every queued check-in. Returns true when nothing is left to retry. */
    suspend fun pushPendingLogs(): Boolean = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext true
        pushPendingLogs(client)
    }

    private suspend fun pushPendingLogs(client: HabitSyncApiClient): Boolean {
        for (log in dao.getUnsentLogs()) {
            when (client.checkIn(log.habitId, log.doneDate)) {
                HabitSyncApiClient.PushResult.OK ->
                    dao.updateLogSyncStatus(log.habitId, log.doneDate, SyncStatus.SYNCED)
                HabitSyncApiClient.PushResult.REJECTED -> {
                    Log.w(TAG, "server rejected check-in ${log.habitId}@${log.doneDate}; dropping it")
                    dao.deleteLog(log.habitId, log.doneDate)
                }
                // Likely offline or server down: stop and let the worker retry the rest.
                HabitSyncApiClient.PushResult.RETRYABLE -> return false
            }
        }
        return true
    }

    private fun buildClient(): HabitSyncApiClient? {
        val url = SyncConfig.getServerUrl(context).takeIf { it.isNotBlank() } ?: return null
        val key = SyncConfig.getApiKey(context)
        return HabitSyncApiClient(url, key)
    }
}
