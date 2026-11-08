package com.alcedo.personal.sync

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.alcedo.personal.ui.util.TimeUtils
import java.time.Instant
import java.util.UUID

private const val TAG = "HabitRepository"

/**
 * Habits and check-ins are saved on the device first (UNSENT) and pushed by HabitSyncWorker,
 * so creating, editing, deleting and checking in work offline. See LocalFirstSyncRules.
 */
class HabitRepository(private val context: Context, private val dao: HabitDao) {

    companion object {
        /** Days of check-in history mirrored from the server on each sync (covers streaks over a year). */
        const val LOG_PULL_DAYS = 400
    }

    fun observeAll() = dao.observeAllHabits()
    fun observeActive() = dao.observeActiveHabits()
    fun observeLogs() = dao.observeAllLogs()

    /** Pushes queued changes, then mirrors habits and recent check-ins without overwriting pending ones. */
    suspend fun syncFromServer() = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext
        pushPending(client)

        val remote = client.fetchAll() ?: return@withContext
        dao.applyServerMerge(LocalFirstSyncRules.planServerMerge(dao.getAll(), remote))

        val to = TimeUtils.effectiveLocalDateStr()
        val from = TimeUtils.effectiveDaysAgo(LOG_PULL_DAYS - 1)
        val logs = client.fetchLogs(from, to) ?: return@withContext
        dao.replaceSyncedLogs(from, to, logs)
    }

    suspend fun create(name: String, notifyTime: String? = null, allowedMissDays: Int = 0) {
        val now = Instant.now().toString()
        save(HabitEntity(UUID.randomUUID().toString(), name.trim(), notifyTime, true, now, now, allowedMissDays, SyncStatus.UNSENT))
    }

    suspend fun update(habit: HabitEntity) {
        save(habit.copy(updatedAt = Instant.now().toString(), syncStatus = SyncStatus.UNSENT))
    }

    /** Hides the habit at once; the tombstone and its check-ins are removed when the server accepts it. */
    suspend fun delete(habit: HabitEntity) {
        val now = Instant.now().toString()
        save(habit.copy(deletedAt = now, updatedAt = now, syncStatus = SyncStatus.UNSENT))
    }

    /**
     * Records today's check-in locally (UNSENT) and tries to push it right away.
     * Returns false when it is queued for retry by HabitSyncWorker instead.
     */
    suspend fun checkIn(habitId: String): Boolean = withContext(Dispatchers.IO) {
        val today = TimeUtils.effectiveLocalDateStr()
        dao.insertLog(HabitLogEntity(habitId, today, Instant.now().toString(), SyncStatus.UNSENT))
        val pushed = buildClient()?.let { pushPending(it) } ?: false
        if (!pushed) HabitSyncScheduler.enqueue(context)
        pushed
    }

    /** Sends queued habit changes, then queued check-ins. Returns true when nothing is left to retry. */
    suspend fun pushPending(): Boolean = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext true
        pushPending(client)
    }

    private suspend fun save(habit: HabitEntity) {
        dao.upsert(habit)
        HabitSyncScheduler.enqueue(context)
    }

    // Habits go first: a check-in for a habit the server doesn't know yet would be rejected (404).
    private suspend fun pushPending(client: HabitSyncApiClient): Boolean =
        pushPendingHabits(client) && pushPendingLogs(client)

    private suspend fun pushPendingHabits(client: HabitSyncApiClient): Boolean = pushLocalFirstRows(
        pending = dao.getPending(),
        push = { if (it.deletedAt != null) PushOutcome(client.delete(it.id)) else client.upsert(it) },
        applyServer = { sent, serverCopy ->
            dao.replaceIfUnchanged(sent, serverCopy ?: sent.copy(syncStatus = SyncStatus.SYNCED))
        },
        removeLocal = { sent ->
            if (sent.deletedAt == null) Log.w(TAG, "server rejected habit ${sent.id}; dropping the local change")
            dao.removeIfUnchanged(sent)
        }
    )

    private suspend fun pushPendingLogs(client: HabitSyncApiClient): Boolean {
        for (log in dao.getUnsentLogs()) {
            when (client.checkIn(log.habitId, log.doneDate)) {
                PushResult.OK ->
                    dao.updateLogSyncStatus(log.habitId, log.doneDate, SyncStatus.SYNCED)
                PushResult.REJECTED -> {
                    Log.w(TAG, "server rejected check-in ${log.habitId}@${log.doneDate}; dropping it")
                    dao.deleteLog(log.habitId, log.doneDate)
                }
                // Likely offline or server down: stop and let the worker retry the rest.
                PushResult.RETRYABLE -> return false
            }
        }
        return true
    }

    private fun buildClient(): HabitSyncApiClient? = SyncConfig.httpClient(context)?.let(::HabitSyncApiClient)
}
