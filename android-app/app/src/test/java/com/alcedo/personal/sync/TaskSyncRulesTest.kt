package com.alcedo.personal.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskSyncRulesTest {

    private fun task(version: Int, status: SyncStatus = SyncStatus.SYNCED, deletedAt: String? = null) = TaskEntity(
        id = "t1", title = "t", description = null, categoryType = "short_term", categoryName = "today",
        priority = "medium", dueAt = null, status = "todo", syncStatus = status, deletedAt = deletedAt,
        updatedAt = "2026-11-08T00:00:00Z", version = version
    )

    private val tombstone = TaskSyncApiClient.TaskTombstone("t1", "2026-11-08T01:00:00Z", 3)

    @Test
    fun `server task replaces a missing or synced row`() {
        assertTrue(TaskSyncRules.shouldApplyServerTask(null, task(1)))
        assertTrue(TaskSyncRules.shouldApplyServerTask(task(5), task(1)))
    }

    @Test
    fun `unsent local edit is kept unless the server version is newer`() {
        assertFalse(TaskSyncRules.shouldApplyServerTask(task(2, SyncStatus.UNSENT), task(2)))
        assertFalse(TaskSyncRules.shouldApplyServerTask(task(3, SyncStatus.RETRYING), task(2)))
        assertTrue(TaskSyncRules.shouldApplyServerTask(task(2, SyncStatus.UNSENT), task(3)))
    }

    @Test
    fun `tombstone deletes a synced row with the server's version`() {
        val applied = TaskSyncRules.applyTombstone(task(2), tombstone)!!
        assertEquals("2026-11-08T01:00:00Z", applied.deletedAt)
        assertEquals(3, applied.version)
        assertEquals(SyncStatus.SYNCED, applied.syncStatus)
    }

    @Test
    fun `tombstone wins over an unsent edit that is not newer`() {
        assertEquals(3, TaskSyncRules.applyTombstone(task(3, SyncStatus.UNSENT), tombstone)?.version)
    }

    @Test
    fun `newer unsent local edit wins over the tombstone`() {
        assertNull(TaskSyncRules.applyTombstone(task(4, SyncStatus.UNSENT), tombstone))
    }

    @Test
    fun `already deleted rows are left alone`() {
        assertNull(TaskSyncRules.applyTombstone(task(1, deletedAt = "2026-11-07T00:00:00Z"), tombstone))
    }
}
