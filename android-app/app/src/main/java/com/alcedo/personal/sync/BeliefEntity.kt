package com.alcedo.personal.sync

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "beliefs")
data class BeliefEntity(
    @PrimaryKey val id: String,
    val text: String,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)
