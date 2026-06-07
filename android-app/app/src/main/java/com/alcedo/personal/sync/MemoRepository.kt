package com.alcedo.personal.sync

import android.content.Context
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import java.util.UUID

class MemoRepository(
    private val context: Context,
    private val dao: MemoDao
) {
    fun observeActiveMemos(): Flow<List<MemoEntity>> = dao.observeActiveMemos()

    suspend fun create(body: String, sourceUrl: String?, sourceTitle: String?): MemoEntity {
        val now = Instant.now().toString()
        val memo = MemoEntity(
            id = UUID.randomUUID().toString(),
            body = body,
            sourceUrl = sourceUrl,
            sourceTitle = sourceTitle,
            version = 1,
            syncStatus = SyncStatus.UNSENT,
            createdAt = now,
            updatedAt = now,
            deletedAt = null
        )
        dao.upsert(memo)
        MemoSyncScheduler.enqueuePush(context)
        return memo
    }

    suspend fun update(id: String, body: String) {
        val current = dao.findById(id) ?: return
        val updated = current.copy(
            body = body,
            syncStatus = SyncStatus.UNSENT,
            updatedAt = Instant.now().toString(),
            version = current.version + 1
        )
        dao.upsert(updated)
        MemoSyncScheduler.enqueuePush(context)
    }

    suspend fun softDelete(id: String) {
        val current = dao.findById(id) ?: return
        val now = Instant.now().toString()
        val updated = current.copy(
            syncStatus = SyncStatus.UNSENT,
            deletedAt = now,
            updatedAt = now,
            version = current.version + 1
        )
        dao.upsert(updated)
        MemoSyncScheduler.enqueuePush(context)
    }
}
