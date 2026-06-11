package com.alcedo.personal.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

private const val TAG = "MemoSyncWorker"

class MemoSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val db = DbProvider.get(applicationContext)
        val dao = db.memoDao()
        val pending = dao.findPendingSync(limit = 100)

        if (pending.isEmpty()) {
            Log.d(TAG, "no pending memos to push")
            return Result.success()
        }

        Log.d(TAG, "pushing ${pending.size} memo(s)")
        val ids = pending.map { it.id }
        dao.updateSyncStatus(ids, SyncStatus.SYNCING)

        val client = MemoSyncApiClient(
            baseUrl = SyncConfig.getServerUrl(applicationContext),
            apiKey = SyncConfig.getApiKey(applicationContext)
        )

        return if (client.pushMemos(pending)) {
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
