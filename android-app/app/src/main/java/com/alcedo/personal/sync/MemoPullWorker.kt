package com.alcedo.personal.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.time.Instant
import java.time.temporal.ChronoUnit

class MemoPullWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val db = DbProvider.get(applicationContext)
        val dao = db.memoDao()

        // Pull memos updated in the last 24h as a safe default window
        val since = Instant.now().minus(24, ChronoUnit.HOURS).toString()

        val client = MemoSyncApiClient(
            baseUrl = SyncConfig.getServerUrl(applicationContext),
            apiKey = SyncConfig.getApiKey(applicationContext)
        )

        val pulled = client.pullMemos(since) ?: return Result.retry()

        for (remote in pulled) {
            val local = dao.findById(remote.id)
            if (local == null || remote.version > local.version ||
                (remote.version == local.version && remote.updatedAt > local.updatedAt)) {
                dao.upsert(remote.copy(syncStatus = SyncStatus.SYNCED))
            }
        }

        return Result.success()
    }
}
