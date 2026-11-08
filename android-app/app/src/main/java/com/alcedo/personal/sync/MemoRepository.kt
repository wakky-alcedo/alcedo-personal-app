package com.alcedo.personal.sync

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.time.Instant
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

    /**
     * Pulls every memo changed since the last pull (all memos the first time), following
     * nextCursor page by page. The position is saved after each page, so an interrupted pull
     * resumes where it stopped. Unsent local changes are kept (MemoSyncRules).
     * Returns false when a page could not be fetched.
     */
    suspend fun syncFromServer(): Boolean = withContext(Dispatchers.IO) {
        val client = MemoSyncApiClient(SyncConfig.httpClient(context) ?: return@withContext false)
        val serverUrl = SyncConfig.getServerUrl(context)
        var cursor = MemoSyncState.getCursor(context, serverUrl)
        while (true) {
            val page = client.pullPage(MemoSyncRules.PULL_SINCE_EPOCH, cursor, MemoSyncRules.PULL_PAGE_LIMIT)
                ?: return@withContext false
            for (remote in page.memos) {
                if (MemoSyncRules.shouldApplyRemote(dao.findById(remote.id), remote)) dao.upsert(remote)
            }
            val last = page.memos.lastOrNull() ?: break
            val next = MemoSyncRules.cursorAfter(last)
            MemoSyncState.saveCursor(context, serverUrl, next)
            // Stop on the last page, or if the server stops advancing (defensive against a loop).
            if (page.nextCursor == null || next == cursor) break
            cursor = next
        }
        true
    }
}
