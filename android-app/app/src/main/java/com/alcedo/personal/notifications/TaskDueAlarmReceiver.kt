package com.alcedo.personal.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

/**
 * [TaskAlarmScheduler] が登録した正確なアラームの発火を受け取り、
 * 対象タスク1件分の期限チェック・通知表示を [TaskDueCheckWorker] に委譲する。
 */
class TaskDueAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return

        val request = OneTimeWorkRequestBuilder<TaskDueCheckWorker>()
            .setInputData(Data.Builder().putString(TaskDueCheckWorker.KEY_TASK_ID, taskId).build())
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "task-due-check-$taskId",
            ExistingWorkPolicy.REPLACE,
            request
        )
    }
}
