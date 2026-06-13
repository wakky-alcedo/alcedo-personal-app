package com.alcedo.personal.notifications

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object TaskNotificationScheduler {
    private const val WORK_NAME = "task-due-check"
    private const val ONE_TIME_WORK_NAME = "task-due-check-once"

    /** WorkManagerのPeriodicWorkRequestが許容する最小間隔（15分未満は自動的に15分にクランプされる） */
    const val INTERVAL_MINUTES = 15L

    fun enqueue(context: Context) {
        val request = PeriodicWorkRequestBuilder<TaskDueCheckWorker>(INTERVAL_MINUTES, TimeUnit.MINUTES).build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    /** 設定変更時やアプリ起動時に即時チェックを行う（15分周期の初回実行を待たない） */
    fun runOnce(context: Context) {
        val request = OneTimeWorkRequestBuilder<TaskDueCheckWorker>().build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            ONE_TIME_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            request
        )
    }
}
