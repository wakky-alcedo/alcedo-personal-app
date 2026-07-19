package com.alcedo.personal.sync

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

class MemoRepository(
    private val context: Context,
    private val dao: MemoDao
) {
    fun observeActiveMemos(): Flow<List<MemoEntity>> = dao.observeActiveMemos()

    suspend fun getById(id: String): MemoEntity? = dao.findById(id)

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

    /** PC サーバーから直近24時間に更新されたメモを取得し、新しい方を採用してマージする。取得に失敗した場合は false を返す */
    suspend fun syncFromServer(): Boolean = withContext(Dispatchers.IO) {
        val since = Instant.now().minus(24, ChronoUnit.HOURS).toString()
        val client = MemoSyncApiClient(
            baseUrl = SyncConfig.getServerUrl(context),
            apiKey = SyncConfig.getApiKey(context)
        )
        val pulled = client.pullMemos(since) ?: return@withContext false
        for (remote in pulled) {
            val local = dao.findById(remote.id)
            if (local == null || remote.version > local.version ||
                (remote.version == local.version && remote.updatedAt > local.updatedAt)) {
                dao.upsert(remote.copy(syncStatus = SyncStatus.SYNCED))
            }
        }
        true
    }
}
