package com.alcedo.personal

import android.app.Application
import com.alcedo.personal.analytics.UsageStatsSyncWorker
import com.alcedo.personal.sync.MemoSyncScheduler
import com.alcedo.personal.sync.TaskSyncScheduler

class AlcedoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        TaskSyncScheduler.enqueue(this)
        MemoSyncScheduler.schedulePull(this)
        UsageStatsSyncWorker.schedule(this)
    }
}
