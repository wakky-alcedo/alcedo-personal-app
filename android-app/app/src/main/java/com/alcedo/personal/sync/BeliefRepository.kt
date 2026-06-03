package com.alcedo.personal.sync

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.util.UUID

class BeliefRepository(private val context: Context, private val dao: BeliefDao) {

    fun observeAll() = dao.observeAllBeliefs()
    fun observeActive() = dao.observeActiveBeliefs()

    suspend fun syncFromServer() = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext
        val remote = client.fetchAll() ?: return@withContext
        dao.insertAll(remote)
        if (remote.isNotEmpty()) dao.deleteNotIn(remote.map { it.id })
    }

    suspend fun create(text: String): Boolean = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext false
        val now = Instant.now().toString()
        val entity = BeliefEntity(UUID.randomUUID().toString(), text.trim(), true, now, now)
        val result = client.upsert(entity)
        if (result != null) { dao.upsert(result); true } else false
    }

    suspend fun update(belief: BeliefEntity): Boolean = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext false
        val updated = belief.copy(updatedAt = Instant.now().toString())
        val result = client.upsert(updated)
        if (result != null) { dao.upsert(result); true } else false
    }

    suspend fun delete(belief: BeliefEntity): Boolean = withContext(Dispatchers.IO) {
        val client = buildClient() ?: return@withContext false
        if (client.delete(belief.id)) { dao.delete(belief); true } else false
    }

    private fun buildClient(): BeliefSyncApiClient? {
        val url = SyncConfig.getServerUrl(context).takeIf { it.isNotBlank() } ?: return null
        val key = SyncConfig.getApiKey(context)
        return BeliefSyncApiClient(url, key)
    }
}
