package com.alcedo.personal.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/** Initial delay of the exponential backoff between push retries. */
private const val PUSH_BACKOFF_INITIAL_SECONDS = 10L

/** Queues a one-off push of locally saved changes, retried with backoff until it succeeds. */
private fun enqueuePush(context: Context, uniqueName: String, worker: Class<out CoroutineWorker>) {
    val request = OneTimeWorkRequest.Builder(worker)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, PUSH_BACKOFF_INITIAL_SECONDS, TimeUnit.SECONDS)
        .build()
    WorkManager.getInstance(context).enqueueUniqueWork(uniqueName, ExistingWorkPolicy.KEEP, request)
}

/** Pushes queued habit changes, then queued check-ins (HabitSyncWorker). */
object HabitSyncScheduler {
    private const val WORK_NAME = "habit-sync"
    fun enqueue(context: Context) = enqueuePush(context, WORK_NAME, HabitSyncWorker::class.java)
}

object BeliefSyncScheduler {
    private const val WORK_NAME = "belief-sync"
    fun enqueue(context: Context) = enqueuePush(context, WORK_NAME, BeliefSyncWorker::class.java)
}
