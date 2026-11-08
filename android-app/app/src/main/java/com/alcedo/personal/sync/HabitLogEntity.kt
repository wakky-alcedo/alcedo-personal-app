package com.alcedo.personal.sync

import androidx.room.ColumnInfo
import androidx.room.Entity

@Entity(
    tableName = "habit_logs",
    primaryKeys = ["habitId", "doneDate"]
)
data class HabitLogEntity(
    val habitId: String,
    val doneDate: String,   // YYYY-MM-DD
    val createdAt: String,
    /** UNSENT until the server accepts the check-in; HabitSyncWorker retries the rest. */
    @ColumnInfo(defaultValue = "UNSENT") val syncStatus: SyncStatus = SyncStatus.UNSENT
)
