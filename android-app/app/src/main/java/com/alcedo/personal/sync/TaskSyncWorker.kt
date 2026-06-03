package com.alcedo.personal.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class TaskSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val db = DbProvider.get(applicationContext)
        val dao = db.taskDao()
        val pending = dao.findPendingSync(limit = 100)

        if (pending.isEmpty()) {
            return Result.success()
        }

        val ids = pending.map { it.id }
        dao.updateSyncStatus(ids, SyncStatus.SYNCING)

        val client = TaskSyncApiClient(
            baseUrl = SyncConfig.getServerUrl(applicationContext),
            apiKey = SyncConfig.getApiKey(applicationContext)
        )

        return if (client.pushTasks(pending)) {
            dao.updateSyncStatus(ids, SyncStatus.SYNCED)
            Result.success()
        } else {
            dao.updateSyncStatus(ids, SyncStatus.RETRYING)
            Result.retry()
        }
    }
}
