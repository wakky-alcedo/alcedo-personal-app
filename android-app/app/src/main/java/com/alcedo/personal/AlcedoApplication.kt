package com.alcedo.personal

import android.app.Application
import com.alcedo.personal.analytics.UsageStatsSyncWorker
import com.alcedo.personal.notifications.TaskNotificationChannels
import com.alcedo.personal.notifications.TaskNotificationScheduler
import com.alcedo.personal.sync.MemoSyncScheduler
import com.alcedo.personal.sync.TaskSyncScheduler

class AlcedoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        TaskNotificationChannels.ensureChannels(this)
        TaskSyncScheduler.enqueue(this)
        MemoSyncScheduler.schedulePull(this)
        UsageStatsSyncWorker.schedule(this)
        TaskNotificationScheduler.enqueue(this)
        TaskNotificationScheduler.runOnce(this)
    }
}
