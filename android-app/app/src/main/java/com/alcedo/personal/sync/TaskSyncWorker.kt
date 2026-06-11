package com.alcedo.personal.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

private const val TAG = "TaskSyncWorker"

class TaskSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val db = DbProvider.get(applicationContext)
        val dao = db.taskDao()
        val pending = dao.findPendingSync(limit = 100)

        if (pending.isEmpty()) {
            Log.d(TAG, "no pending tasks to push")
            return Result.success()
        }

        Log.d(TAG, "pushing ${pending.size} task(s)")
        val ids = pending.map { it.id }
        dao.updateSyncStatus(ids, SyncStatus.SYNCING)

        val client = TaskSyncApiClient(
            baseUrl = SyncConfig.getServerUrl(applicationContext),
            apiKey = SyncConfig.getApiKey(applicationContext)
        )

        return if (client.pushTasks(pending)) {
            dao.updateSyncStatus(ids, SyncStatus.SYNCED)
            Log.d(TAG, "push succeeded")
            Result.success()
        } else {
            dao.updateSyncStatus(ids, SyncStatus.RETRYING)
            Log.w(TAG, "push failed, will retry")
            Result.retry()
        }
    }
}
