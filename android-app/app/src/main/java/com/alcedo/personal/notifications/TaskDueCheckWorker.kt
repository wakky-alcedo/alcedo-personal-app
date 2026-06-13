package com.alcedo.personal.notifications

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.alcedo.personal.MainActivity
import com.alcedo.personal.R
import com.alcedo.personal.sync.DbProvider
import com.alcedo.personal.sync.TaskEntity
import java.time.Instant

private const val TAG = "TaskDueCheckWorker"

/**
 * 期限が近いタスクを定期チェックし、設定に応じて通知/アラームを表示する。
 * まだ通知ウィンドウに入っていないタスクは、ウィンドウに入る時刻に
 * [TaskAlarmScheduler] で正確なアラームを登録し、誤差1分程度での通知を実現する。
 */
class TaskDueCheckWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        /** [androidx.work.Data] に設定すると、その1タスクのみをチェック対象にする（アラーム発火時用） */
        const val KEY_TASK_ID = "task_id"
    }

    override suspend fun doWork(): Result {
        if (!NotificationPrefs.isNotificationsEnabled(applicationContext)) {
            Log.d(TAG, "notifications disabled, skip")
            return Result.success()
        }
        if (!hasNotificationPermission()) {
            Log.d(TAG, "POST_NOTIFICATIONS not granted, skip")
            return Result.success()
        }

        val dao = DbProvider.get(applicationContext).taskDao()
        val allTasks = dao.findTasksWithDueDate()

        val targetTaskId = inputData.getString(KEY_TASK_ID)
        val tasks = if (targetTaskId != null) allTasks.filter { it.id == targetTaskId } else allTasks

        val notifiedKeys = NotificationPrefs.getNotifiedKeys(applicationContext)
        val pruned = TaskDueNotifier.pruneNotifiedKeys(allTasks, notifiedKeys)

        val reminderMinutes = NotificationPrefs.getReminderMinutes(applicationContext)
        val windowMs = reminderMinutes * 60_000L
        val now = Instant.now()
        val due = TaskDueNotifier.selectTasksToNotify(tasks, now, reminderMinutes, pruned)

        Log.d(
            TAG,
            "checked ${tasks.size} task(s) with due date at $now (reminderMinutes=$reminderMinutes), " +
                "due=${due.size}, dueDates=${tasks.map { it.title to TaskDueNotifier.getTaskDueDateTime(it) }}"
        )

        if (due.isNotEmpty()) {
            val alarmEnabled = NotificationPrefs.isAlarmEnabled(applicationContext)
            due.forEach { showNotification(it, alarmEnabled) }
        }

        // 未通知かつウィンドウ未到達のタスクは、ウィンドウに入る時刻に正確なアラームを登録する
        tasks.forEach { task ->
            val taskDue = TaskDueNotifier.getTaskDueDateTime(task) ?: return@forEach
            if (TaskDueNotifier.buildNotifiedKey(task) in pruned) return@forEach
            val diffMs = taskDue.toEpochMilli() - now.toEpochMilli()
            if (diffMs > windowMs) {
                TaskAlarmScheduler.schedule(applicationContext, task.id, taskDue.toEpochMilli() - windowMs)
            }
        }

        if (due.isNotEmpty() || pruned.size != notifiedKeys.size) {
            val next = pruned + due.map { TaskDueNotifier.buildNotifiedKey(it) }
            NotificationPrefs.setNotifiedKeys(applicationContext, next)
        }

        return Result.success()
    }

    private fun hasNotificationPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun showNotification(task: TaskEntity, alarmEnabled: Boolean) {
        if (alarmEnabled) {
            AlarmRingingService.start(applicationContext, task.id, task.title, task.dueTime)
            return
        }
        showReminderNotification(task)
    }

    @SuppressLint("MissingPermission")
    private fun showReminderNotification(task: TaskEntity) {
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            applicationContext, task.id.hashCode(), intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(applicationContext, TaskNotificationChannels.CHANNEL_REMINDER)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("タスク期限通知")
            .setContentText("「${task.title}」の期限が近づいています(${task.dueTime})")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(applicationContext).notify(task.id.hashCode(), notification)
    }
}
