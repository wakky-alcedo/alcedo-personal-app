package com.alcedo.personal.sync

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(task: TaskEntity)

    @Query("SELECT * FROM tasks WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): TaskEntity?

    @Query("SELECT * FROM tasks WHERE syncStatus IN ('UNSENT', 'FAILED', 'RETRYING') ORDER BY updatedAt ASC LIMIT :limit")
    suspend fun findPendingSync(limit: Int): List<TaskEntity>

    @Query("SELECT COUNT(*) FROM tasks WHERE deletedAt IS NULL")
    suspend fun countActiveTasks(): Int

    @Query("SELECT * FROM tasks WHERE deletedAt IS NULL ORDER BY updatedAt DESC LIMIT :limit")
    suspend fun listActiveTasks(limit: Int): List<TaskEntity>

    @Query("SELECT COUNT(*) FROM tasks WHERE syncStatus IN ('UNSENT', 'FAILED', 'RETRYING')")
    suspend fun countPendingSync(): Int

    @Query("UPDATE tasks SET syncStatus = :syncStatus WHERE id IN (:ids)")
    suspend fun updateSyncStatus(ids: List<String>, syncStatus: SyncStatus)

    @Update
    suspend fun updateAll(tasks: List<TaskEntity>)

    @Query("SELECT * FROM tasks WHERE deletedAt IS NULL ORDER BY updatedAt DESC")
    fun observeActiveTasks(): Flow<List<TaskEntity>>
}
