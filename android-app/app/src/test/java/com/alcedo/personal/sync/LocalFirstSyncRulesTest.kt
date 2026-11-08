package com.alcedo.personal.sync

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalFirstSyncRulesTest {

    private fun belief(
        id: String,
        text: String = id,
        status: SyncStatus = SyncStatus.SYNCED,
        updatedAt: String = "2026-11-08T00:00:00Z",
        deletedAt: String? = null
    ) = BeliefEntity(id, text, true, "c", updatedAt, status, deletedAt)

    // ─── planServerMerge ────────────────────────────────────────────────────

    @Test
    fun `server rows overwrite synced rows and fill in missing ones`() {
        val plan = LocalFirstSyncRules.planServerMerge(
            local = listOf(belief("a", "old")),
            server = listOf(belief("a", "new"), belief("b"))
        )
        assertEquals(listOf("new", "b"), plan.upserts.map { it.text })
        assertEquals(emptyList<String>(), plan.removeIds)
    }

    @Test
    fun `pending local edits and tombstones are not overwritten by the server`() {
        val plan = LocalFirstSyncRules.planServerMerge(
            local = listOf(belief("a", "edited", SyncStatus.UNSENT), belief("b", status = SyncStatus.UNSENT, deletedAt = "d")),
            server = listOf(belief("a", "server"), belief("b"))
        )
        assertEquals(emptyList<BeliefEntity>(), plan.upserts)
        assertEquals(emptyList<String>(), plan.removeIds)
    }

    @Test
    fun `synced rows missing on the server are removed, unsent creations are kept`() {
        val plan = LocalFirstSyncRules.planServerMerge(
            local = listOf(belief("gone"), belief("new-local", status = SyncStatus.UNSENT)),
            server = emptyList()
        )
        assertEquals(listOf("gone"), plan.removeIds)
    }

    // ─── afterPush ──────────────────────────────────────────────────────────

    @Test
    fun `push outcome decides what happens to the local row`() {
        val edit = belief("a", status = SyncStatus.UNSENT)
        val tombstone = belief("a", status = SyncStatus.UNSENT, deletedAt = "d")
        assertEquals(LocalFirstSyncRules.PushAction.APPLY_SERVER, LocalFirstSyncRules.afterPush(edit, PushResult.OK))
        assertEquals(LocalFirstSyncRules.PushAction.REMOVE_LOCAL, LocalFirstSyncRules.afterPush(tombstone, PushResult.OK))
        assertEquals(LocalFirstSyncRules.PushAction.REMOVE_LOCAL, LocalFirstSyncRules.afterPush(edit, PushResult.REJECTED))
        assertEquals(LocalFirstSyncRules.PushAction.RETRY_LATER, LocalFirstSyncRules.afterPush(edit, PushResult.RETRYABLE))
    }

    @Test
    fun `400 and 404 are rejected, other errors are retried`() {
        assertEquals(PushResult.REJECTED, ApiResult.HttpError(400).toPushResult())
        assertEquals(PushResult.REJECTED, ApiResult.HttpError(404).toPushResult())
        assertEquals(PushResult.RETRYABLE, ApiResult.HttpError(401).toPushResult())
        assertEquals(PushResult.RETRYABLE, ApiResult.HttpError(500).toPushResult())
        assertEquals(PushResult.RETRYABLE, ApiResult.NetworkError(java.io.IOException()).toPushResult())
        assertEquals(PushResult.OK, ApiResult.Success(200, "{}").toPushResult())
    }

    @Test
    fun `a row edited while its push was in flight is not marked synced`() {
        val sent = belief("a", updatedAt = "t1")
        assertTrue(LocalFirstSyncRules.unchangedSince(sent, belief("a", updatedAt = "t1")))
        assertFalse(LocalFirstSyncRules.unchangedSince(sent, belief("a", updatedAt = "t2")))
        assertFalse(LocalFirstSyncRules.unchangedSince(sent, belief("a", updatedAt = "t1", deletedAt = "t1")))
        assertFalse(LocalFirstSyncRules.unchangedSince(sent, null))
    }

    // ─── pushLocalFirstRows ─────────────────────────────────────────────────

    @Test
    fun `stops at the first retryable failure and reports it`() = runBlocking {
        val applied = mutableListOf<String>()
        val removed = mutableListOf<String>()
        val results = mapOf("a" to PushResult.OK, "b" to PushResult.REJECTED, "c" to PushResult.RETRYABLE, "d" to PushResult.OK)
        val done = pushLocalFirstRows(
            pending = listOf("a", "b", "c", "d").map { belief(it, status = SyncStatus.UNSENT) },
            push = { PushOutcome(results.getValue(it.id)) },
            applyServer = { sent, _ -> applied += sent.id },
            removeLocal = { removed += it.id }
        )
        assertFalse(done)
        assertEquals(listOf("a"), applied)
        assertEquals(listOf("b"), removed)
    }
}
