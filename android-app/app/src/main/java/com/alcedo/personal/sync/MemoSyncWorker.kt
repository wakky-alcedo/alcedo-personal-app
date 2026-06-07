package com.alcedo.personal.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class MemoSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val db = DbProvider.get(applicationContext)
        val dao = db.memoDao()
        val pending = dao.findPendingSync(limit = 100)

        if (pending.isEmpty()) return Result.success()

        val ids = pending.map { it.id }
        dao.updateSyncStatus(ids, SyncStatus.SYNCING)

        val client = MemoSyncApiClient(
            baseUrl = SyncConfig.getServerUrl(applicationContext),
            apiKey = SyncConfig.getApiKey(applicationContext)
        )

        return if (client.pushMemos(pending)) {
            dao.updateSyncStatus(ids, SyncStatus.SYNCED)
            Result.success()
        } else {
            dao.updateSyncStatus(ids, SyncStatus.RETRYING)
            Result.retry()
        }
    }
}
