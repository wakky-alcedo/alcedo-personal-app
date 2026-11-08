package com.alcedo.personal.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class HabitLogSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val repo = HabitRepository(applicationContext, DbProvider.get(applicationContext).habitDao())
        return if (repo.pushPendingLogs()) Result.success() else Result.retry()
    }
}
