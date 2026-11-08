package com.alcedo.personal.sync

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.util.UUID

/**
 * Beliefs are saved on the device first (UNSENT) and pushed by BeliefSyncWorker, so creating,
 * editing and deleting work offline. See LocalFirstSyncRules for the merge/push rules.
 */
class BeliefRepository(private val context: Context, private val dao: BeliefDao) {

    fun observeAll() = dao.observeAllBeliefs()
    fun observeActive() = dao.observeActiveBeliefs()

    /** Pushes queued changes, then mirrors the server list without overwriting pending ones. */
    suspend fun syncFromServer() = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext
        pushPending(client)
        val remote = client.fetchAll() ?: return@withContext
        dao.applyServerMerge(LocalFirstSyncRules.planServerMerge(dao.getAll(), remote))
    }

    suspend fun create(text: String) {
        val now = Instant.now().toString()
        save(BeliefEntity(UUID.randomUUID().toString(), text.trim(), true, now, now, SyncStatus.UNSENT))
    }

    suspend fun update(belief: BeliefEntity) {
        save(belief.copy(updatedAt = Instant.now().toString(), syncStatus = SyncStatus.UNSENT))
    }

    /** Hides the belief at once; the local tombstone is removed when the server accepts it. */
    suspend fun delete(belief: BeliefEntity) {
        val now = Instant.now().toString()
        save(belief.copy(deletedAt = now, updatedAt = now, syncStatus = SyncStatus.UNSENT))
    }

    /** Returns true when nothing is left to retry (also when sync is not configured). */
    suspend fun pushPending(): Boolean = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext true
        pushPending(client)
    }

    private suspend fun save(belief: BeliefEntity) {
        dao.upsert(belief)
        BeliefSyncScheduler.enqueue(context)
    }

    private suspend fun pushPending(client: BeliefSyncApiClient): Boolean = pushLocalFirstRows(
        pending = dao.getPending(),
        push = { if (it.deletedAt != null) PushOutcome(client.delete(it.id)) else client.upsert(it) },
        applyServer = { sent, serverCopy ->
            dao.replaceIfUnchanged(sent, serverCopy ?: sent.copy(syncStatus = SyncStatus.SYNCED))
        },
        removeLocal = { sent -> dao.removeIfUnchanged(sent) }
    )

    private fun buildClient(): BeliefSyncApiClient? = SyncConfig.httpClient(context)?.let(::BeliefSyncApiClient)
}
