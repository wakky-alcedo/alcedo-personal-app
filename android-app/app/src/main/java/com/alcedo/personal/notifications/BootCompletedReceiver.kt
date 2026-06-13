package com.alcedo.personal.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * 再起動でAlarmManagerに登録した正確なアラームは消えるため、
 * 起動完了時に期限チェックを再実行し、必要なアラームを再登録する。
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            TaskNotificationScheduler.runOnce(context)
        }
    }
}
