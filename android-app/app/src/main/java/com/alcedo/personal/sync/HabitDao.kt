package com.alcedo.personal.sync

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface HabitDao {
    @Query("SELECT * FROM habits WHERE isActive = 1 ORDER BY name ASC")
    fun observeActiveHabits(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits ORDER BY name ASC")
    fun observeAllHabits(): Flow<List<HabitEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(habit: HabitEntity)

    @Delete
    suspend fun delete(habit: HabitEntity)

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

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(habits: List<HabitEntity>)

    @Query("DELETE FROM habits WHERE id NOT IN (:ids)")
    suspend fun deleteNotIn(ids: List<String>)

    @Query("DELETE FROM habits")
    suspend fun deleteAll()

    /** Local cache cleanup after habits were removed on the server. */
    @Query("DELETE FROM habit_logs WHERE habitId NOT IN (SELECT id FROM habits)")
    suspend fun deleteOrphanLogs()

    @Query("DELETE FROM habit_logs WHERE habitId = :habitId")
    suspend fun deleteLogsForHabit(habitId: String)
}
