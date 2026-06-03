package com.alcedo.personal.sync

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "habits")
data class HabitEntity(
    @PrimaryKey val id: String,
    val name: String,
    val notifyTime: String?,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)
