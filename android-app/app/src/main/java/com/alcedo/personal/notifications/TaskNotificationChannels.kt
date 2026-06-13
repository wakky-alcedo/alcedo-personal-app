package com.alcedo.personal.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/** タスク期限通知用の通知チャンネル（通常通知/アラーム通知の2系統）を作成する */
object TaskNotificationChannels {
    const val CHANNEL_REMINDER = "task_due_reminder"
    const val CHANNEL_ALARM = "task_due_alarm"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)

        val reminder = NotificationChannel(
            CHANNEL_REMINDER, "タスク期限通知", NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "タスクの期限が近づいたときの通知"
            setSound(null, null)
            enableVibration(false)
        }

        val alarm = NotificationChannel(
            CHANNEL_ALARM, "タスク期限アラーム", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "タスクの期限が近づいたときのアラーム通知（音・バイブ）"
            enableVibration(true)
        }

        manager.createNotificationChannel(reminder)
        manager.createNotificationChannel(alarm)
    }
}
