package com.alcedo.personal.sync

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface BeliefDao {
    @Query("SELECT * FROM beliefs WHERE isActive = 1 AND deletedAt IS NULL ORDER BY updatedAt DESC")
    fun observeActiveBeliefs(): Flow<List<BeliefEntity>>

    @Query("SELECT * FROM beliefs WHERE deletedAt IS NULL ORDER BY updatedAt DESC")
    fun observeAllBeliefs(): Flow<List<BeliefEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(belief: BeliefEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(beliefs: List<BeliefEntity>)

    @Query("SELECT * FROM beliefs WHERE id = :id LIMIT 1")
    suspend fun findById(id: String): BeliefEntity?

    /** Including local tombstones, for merging with the server list. */
    @Query("SELECT * FROM beliefs")
    suspend fun getAll(): List<BeliefEntity>

    @Query("SELECT * FROM beliefs WHERE syncStatus != 'SYNCED' ORDER BY updatedAt ASC")
    suspend fun getPending(): List<BeliefEntity>

    @Query("DELETE FROM beliefs WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)

    @Transaction
    suspend fun applyServerMerge(plan: MergePlan<BeliefEntity>) {
        upsertAll(plan.upserts)
        if (plan.removeIds.isNotEmpty()) deleteByIds(plan.removeIds)
    }

    /** Stores the server's copy only if the row was not edited while its push was in flight. */
    @Transaction
    suspend fun replaceIfUnchanged(sent: BeliefEntity, replacement: BeliefEntity) {
        if (LocalFirstSyncRules.unchangedSince(sent, findById(sent.id))) upsert(replacement)
    }

    @Transaction
    suspend fun removeIfUnchanged(sent: BeliefEntity) {
        if (LocalFirstSyncRules.unchangedSince(sent, findById(sent.id))) deleteByIds(listOf(sent.id))
    }
}
