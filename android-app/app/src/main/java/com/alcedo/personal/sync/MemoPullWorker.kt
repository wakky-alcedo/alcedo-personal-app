package com.alcedo.personal.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

private const val TAG = "MemoPullWorker"

class MemoPullWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val db = DbProvider.get(applicationContext)
        val repo = MemoRepository(applicationContext, db.memoDao())

        return if (repo.syncFromServer()) {
            Log.d(TAG, "pull succeeded")
            Result.success()
        } else {
            Log.w(TAG, "pull failed, will retry")
            Result.retry()
        }
    }
}
