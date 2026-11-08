package com.alcedo.personal.sync

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface HabitDao {
    @Query("SELECT * FROM habits WHERE isActive = 1 AND deletedAt IS NULL ORDER BY name ASC")
    fun observeActiveHabits(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits WHERE deletedAt IS NULL ORDER BY name ASC")
    fun observeAllHabits(): Flow<List<HabitEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(habit: HabitEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(habits: List<HabitEntity>)

    @Query("SELECT * FROM habits WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): HabitEntity?

    /** Including local tombstones, for merging with the server list. */
    @Query("SELECT * FROM habits")
    suspend fun getAll(): List<HabitEntity>

    @Query("SELECT * FROM habits WHERE syncStatus != 'SYNCED' ORDER BY updatedAt ASC")
    suspend fun getPending(): List<HabitEntity>

    @Query("DELETE FROM habits WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertLog(log: HabitLogEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertLogs(logs: List<HabitLogEntity>)

    @Query("SELECT * FROM habit_logs")
    fun observeAllLogs(): Flow<List<HabitLogEntity>>

    @Query("SELECT doneDate FROM habit_logs WHERE habitId = :habitId AND doneDate >= :from ORDER BY doneDate DESC")
    suspend fun getRecentLogs(habitId: String, from: String): List<String>

    @Query("SELECT * FROM habit_logs WHERE syncStatus != 'SYNCED' ORDER BY doneDate ASC")
    suspend fun getUnsentLogs(): List<HabitLogEntity>

    @Query("UPDATE habit_logs SET syncStatus = :status WHERE habitId = :habitId AND doneDate = :doneDate")
    suspend fun updateLogSyncStatus(habitId: String, doneDate: String, status: SyncStatus)

    @Query("DELETE FROM habit_logs WHERE habitId = :habitId AND doneDate = :doneDate")
    suspend fun deleteLog(habitId: String, doneDate: String)

    @Query("DELETE FROM habit_logs WHERE syncStatus = 'SYNCED' AND doneDate >= :from AND doneDate <= :to")
    suspend fun deleteSyncedLogsInRange(from: String, to: String)

    /**
     * Makes local logs in [from, to] mirror the server, keeping check-ins that are
     * still waiting to be pushed. Server rows overwrite matching local rows as SYNCED.
     */
    @Transaction
    suspend fun replaceSyncedLogs(from: String, to: String, serverLogs: List<HabitLogEntity>) {
        deleteSyncedLogsInRange(from, to)
        upsertLogs(serverLogs)
    }

    /** Local cache cleanup after habits were removed (deleted here or on the server). */
    @Query("DELETE FROM habit_logs WHERE habitId NOT IN (SELECT id FROM habits)")
    suspend fun deleteOrphanLogs()

    @Transaction
    suspend fun applyServerMerge(plan: MergePlan<HabitEntity>) {
        upsertAll(plan.upserts)
        if (plan.removeIds.isNotEmpty()) deleteByIds(plan.removeIds)
        deleteOrphanLogs()
    }

    /** Stores the server's copy only if the row was not edited while its push was in flight. */
    @Transaction
    suspend fun replaceIfUnchanged(sent: HabitEntity, replacement: HabitEntity) {
        if (LocalFirstSyncRules.unchangedSince(sent, findById(sent.id))) upsert(replacement)
    }

    /** Drops the habit and its check-ins (delete accepted, or the server rejected the change). */
    @Transaction
    suspend fun removeIfUnchanged(sent: HabitEntity) {
        if (LocalFirstSyncRules.unchangedSince(sent, findById(sent.id))) {
            deleteByIds(listOf(sent.id))
            deleteOrphanLogs()
        }
    }
}
