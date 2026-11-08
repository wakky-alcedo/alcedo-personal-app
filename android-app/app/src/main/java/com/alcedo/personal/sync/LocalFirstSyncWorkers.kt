package com.alcedo.personal.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/** Habits first, then check-ins: a check-in for a habit the server doesn't know yet would get 404. */
class HabitSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val repo = HabitRepository(applicationContext, DbProvider.get(applicationContext).habitDao())
        return if (repo.pushPending()) Result.success() else Result.retry()
    }
}

class BeliefSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val repo = BeliefRepository(applicationContext, DbProvider.get(applicationContext).beliefDao())
        return if (repo.pushPending()) Result.success() else Result.retry()
    }
}
