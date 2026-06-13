package com.alcedo.personal.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/** [TaskDueAlarmReceiver] へ渡すタスクIDのIntent extraキー */
const val EXTRA_TASK_ID = "task_id"

/**
 * タスク期限通知を誤差1分程度の正確なタイミングで表示するためのAlarmManagerスケジューラ。
 * WorkManagerの15分周期チェックでは取りこぼす「通知ウィンドウに入る瞬間」を、
 * タスクごとの正確なアラームで補う。
 */
object TaskAlarmScheduler {

    /** Android 12+ で「正確なアラーム」権限(SCHEDULE_EXACT_ALARM)が許可されているか */
    fun canScheduleExactAlarms(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val alarmManager = context.getSystemService(AlarmManager::class.java)
        return alarmManager.canScheduleExactAlarms()
    }

    /** 指定タスクが通知ウィンドウに入る時刻(triggerAtMillis)に正確なアラームを登録する */
    fun schedule(context: Context, taskId: String, triggerAtMillis: Long) {
        if (!canScheduleExactAlarms(context)) return

        val alarmManager = context.getSystemService(AlarmManager::class.java)
        val intent = Intent(context, TaskDueAlarmReceiver::class.java).apply {
            putExtra(EXTRA_TASK_ID, taskId)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, taskId.hashCode(), intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
    }
}
