package com.alcedo.personal.sync

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface BeliefDao {
    @Query("SELECT * FROM beliefs WHERE isActive = 1 ORDER BY updatedAt DESC")
    fun observeActiveBeliefs(): Flow<List<BeliefEntity>>

    @Query("SELECT * FROM beliefs ORDER BY updatedAt DESC")
    fun observeAllBeliefs(): Flow<List<BeliefEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(belief: BeliefEntity)

    @Delete
    suspend fun delete(belief: BeliefEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(beliefs: List<BeliefEntity>)

    @Query("DELETE FROM beliefs WHERE id NOT IN (:ids)")
    suspend fun deleteNotIn(ids: List<String>)

    @Query("DELETE FROM beliefs")
    suspend fun deleteAll()
}
