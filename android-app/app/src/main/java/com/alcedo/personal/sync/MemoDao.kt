package com.alcedo.personal.sync

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface MemoDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(memo: MemoEntity)

    @Query("SELECT * FROM memos WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): MemoEntity?

    @Query("SELECT * FROM memos WHERE syncStatus IN ('UNSENT', 'FAILED', 'RETRYING') ORDER BY updatedAt ASC LIMIT :limit")
    suspend fun findPendingSync(limit: Int): List<MemoEntity>

    @Query("UPDATE memos SET syncStatus = :syncStatus WHERE id IN (:ids)")
    suspend fun updateSyncStatus(ids: List<String>, syncStatus: SyncStatus)

    @Update
    suspend fun updateAll(memos: List<MemoEntity>)

    @Query("SELECT * FROM memos WHERE deletedAt IS NULL ORDER BY createdAt DESC")
    fun observeActiveMemos(): Flow<List<MemoEntity>>
}
