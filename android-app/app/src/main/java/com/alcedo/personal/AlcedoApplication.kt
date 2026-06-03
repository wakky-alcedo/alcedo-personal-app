package com.alcedo.personal

import android.app.Application
import com.alcedo.personal.sync.TaskSyncScheduler

class AlcedoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Kick a safe background sync on startup.
        TaskSyncScheduler.enqueue(this)
    }
}
