package com.alcedo.personal.notifications

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.alcedo.personal.R
import com.alcedo.personal.ui.alarm.AlarmActivity

private const val TAG = "AlarmRingingService"

/**
 * タスク期限アラームをアラーム音量(USAGE_ALARM)でループ再生し、
 * 全画面の [AlarmActivity] と「停止」操作付きの通知を表示するフォアグラウンドサービス。
 */
class AlarmRingingService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var isRinging = false

    companion object {
        const val EXTRA_TASK_ID = "task_id"
        const val EXTRA_TASK_TITLE = "task_title"
        const val EXTRA_TASK_DUE_TIME = "task_due_time"
        const val ACTION_STOP = "com.alcedo.personal.action.ALARM_STOP"
        private const val NOTIFICATION_ID = 9001

        /** アラーム鳴動を開始する(既に鳴動中なら通知の表示内容のみ更新) */
        fun start(context: android.content.Context, taskId: String, taskTitle: String, dueTime: String?) {
            val intent = Intent(context, AlarmRingingService::class.java).apply {
                putExtra(EXTRA_TASK_ID, taskId)
                putExtra(EXTRA_TASK_TITLE, taskTitle)
                putExtra(EXTRA_TASK_DUE_TIME, dueTime)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        /** アラーム鳴動を停止する(AlarmActivityの停止ボタン・通知の停止アクションから呼ばれる) */
        fun stop(context: android.content.Context) {
            val intent = Intent(context, AlarmRingingService::class.java).apply {
                action = ACTION_STOP
            }
            ContextCompat.startForegroundService(context, intent)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopRinging()
            stopSelf()
            return START_NOT_STICKY
        }

        val taskId = intent?.getStringExtra(EXTRA_TASK_ID)
        val taskTitle = intent?.getStringExtra(EXTRA_TASK_TITLE) ?: "タスク"
        val dueTime = intent?.getStringExtra(EXTRA_TASK_DUE_TIME)

        startForeground(NOTIFICATION_ID, buildNotification(taskTitle, dueTime))

        if (!isRinging) {
            startMediaPlayer()
            startVibration()
            isRinging = true
            maybeLaunchAlarmActivity(taskId, taskTitle, dueTime)
        }

        return START_STICKY
    }

    private fun buildNotification(title: String, dueTime: String?): Notification {
        val fullScreenIntent = Intent(this, AlarmActivity::class.java).apply {
            putExtra(EXTRA_TASK_TITLE, title)
            putExtra(EXTRA_TASK_DUE_TIME, dueTime)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val stopIntent = Intent(this, AlarmRingingService::class.java).apply { action = ACTION_STOP }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, TaskNotificationChannels.CHANNEL_ALARM)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("タスク期限アラーム")
            .setContentText("「$title」の期限です" + (dueTime?.let { "($it)" } ?: ""))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(0, "停止", stopPendingIntent)
            .build()
    }

    private fun startMediaPlayer() {
        val alarmUri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        if (alarmUri == null) {
            Log.w(TAG, "no alarm sound uri available")
            return
        }

        try {
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@AlarmRingingService, alarmUri)
                isLooping = true
                setOnErrorListener { _, _, _ -> true }
                prepare()
                start()
            }
        } catch (e: Exception) {
            Log.w(TAG, "failed to start alarm sound", e)
            mediaPlayer?.release()
            mediaPlayer = null
        }
    }

    private fun startVibration() {
        vibrator = getSystemService(Vibrator::class.java)
        val pattern = longArrayOf(0, 800, 500)
        vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
    }

    private fun maybeLaunchAlarmActivity(taskId: String?, title: String, dueTime: String?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val notificationManager = getSystemService(NotificationManager::class.java)
            if (!notificationManager.canUseFullScreenIntent()) return
        }
        val intent = Intent(this, AlarmActivity::class.java).apply {
            putExtra(EXTRA_TASK_ID, taskId)
            putExtra(EXTRA_TASK_TITLE, title)
            putExtra(EXTRA_TASK_DUE_TIME, dueTime)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(intent)
    }

    private fun stopRinging() {
        mediaPlayer?.let {
            try {
                it.stop()
            } catch (e: Exception) {
                Log.w(TAG, "failed to stop media player", e)
            }
            it.release()
        }
        mediaPlayer = null
        vibrator?.cancel()
        vibrator = null
        isRinging = false
        NotificationManagerCompat.from(this).cancel(NOTIFICATION_ID)
    }

    override fun onDestroy() {
        stopRinging()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
