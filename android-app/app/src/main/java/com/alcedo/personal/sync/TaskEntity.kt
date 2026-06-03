package com.alcedo.personal.sync

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: String,
    val title: String,
    val description: String?,
    val categoryType: String,
    val categoryName: String,
    val priority: String,
    val dueAt: String?,
    val status: String,
    val syncStatus: SyncStatus,
    val deletedAt: String?,
    val updatedAt: String,
    val version: Int
)
