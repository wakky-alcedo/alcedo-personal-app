package com.alcedo.personal.sync

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "habits")
data class HabitEntity(
    @PrimaryKey override val id: String,
    val name: String,
    val notifyTime: String?,
    val isActive: Boolean,
    val createdAt: String,
    override val updatedAt: String,
    val allowedMissDays: Int = 0,
    /** UNSENT until the server accepts the change; HabitSyncWorker retries the rest. */
    @ColumnInfo(defaultValue = "SYNCED") override val syncStatus: SyncStatus = SyncStatus.SYNCED,
    /** Local tombstone: hidden from the UI, removed once the server accepts the delete. */
    override val deletedAt: String? = null
) : LocalFirstRow
