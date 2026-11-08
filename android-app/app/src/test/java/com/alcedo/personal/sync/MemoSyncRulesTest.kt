package com.alcedo.personal.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MemoSyncRulesTest {

    private fun memo(version: Int, status: SyncStatus = SyncStatus.SYNCED) = MemoEntity(
        id = "m1", body = "b", sourceUrl = null, sourceTitle = null, version = version,
        syncStatus = status, createdAt = "c", updatedAt = "2026-11-08T00:00:00.000Z", deletedAt = null
    )

    @Test
    fun `cursor matches the server's updatedAt-pipe-id format`() {
        assertEquals("2026-11-08T00:00:00.000Z|m1", MemoSyncRules.cursorAfter(memo(1)))
    }

    @Test
    fun `remote memo replaces a missing or synced row`() {
        assertTrue(MemoSyncRules.shouldApplyRemote(null, memo(1)))
        assertTrue(MemoSyncRules.shouldApplyRemote(memo(3), memo(1)))
    }

    @Test
    fun `unsent local change is kept unless the server already has a newer version`() {
        assertFalse(MemoSyncRules.shouldApplyRemote(memo(2, SyncStatus.UNSENT), memo(2)))
        assertFalse(MemoSyncRules.shouldApplyRemote(memo(3, SyncStatus.RETRYING), memo(2)))
        assertTrue(MemoSyncRules.shouldApplyRemote(memo(2, SyncStatus.UNSENT), memo(3)))
    }
}
