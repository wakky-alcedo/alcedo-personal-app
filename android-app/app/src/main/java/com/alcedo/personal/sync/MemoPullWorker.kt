package com.alcedo.personal.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.time.Instant
import java.time.temporal.ChronoUnit

private const val TAG = "MemoPullWorker"

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

        val pulled = client.pullMemos(since) ?: run {
            Log.w(TAG, "pull failed, will retry")
            return Result.retry()
        }

        var applied = 0
        for (remote in pulled) {
            val local = dao.findById(remote.id)
            if (local == null || remote.version > local.version ||
                (remote.version == local.version && remote.updatedAt > local.updatedAt)) {
                dao.upsert(remote.copy(syncStatus = SyncStatus.SYNCED))
                applied++
            }
        }

        Log.d(TAG, "pulled ${pulled.size} memo(s), applied $applied")
        return Result.success()
    }
}
