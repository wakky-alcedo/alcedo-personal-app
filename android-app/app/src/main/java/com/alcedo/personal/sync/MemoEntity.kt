package com.alcedo.personal.sync

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "memos")
data class MemoEntity(
    @PrimaryKey val id: String,
    val body: String,
    val sourceUrl: String?,
    val sourceTitle: String?,
    val version: Int,
    @ColumnInfo(defaultValue = "UNSENT") val syncStatus: SyncStatus,
    val createdAt: String,
    val updatedAt: String,
    val deletedAt: String?
)
