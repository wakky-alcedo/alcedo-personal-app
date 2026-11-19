package com.alcedo.personal.analytics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UsageSyncRulesTest {

    private fun session(endMs: Long) = UsageSession(
        packageName = "p$endMs", appLabel = "a", startedAt = "s", endedAt = "e", endedAtMs = endMs, category = "c"
    )

    @Test
    fun `without a cursor every session is sent`() {
        val all = listOf(session(1), session(2))
        assertEquals(all, UsageSyncRules.unsent(all, null))
    }

    @Test
    fun `only sessions ending after the cursor are sent`() {
        val all = listOf(session(100), session(200), session(300))
        assertEquals(listOf(session(300)), UsageSyncRules.unsent(all, 200))
    }

    @Test
    fun `next cursor is the latest end that was sent`() {
        assertEquals(300L, UsageSyncRules.nextCursor(listOf(session(300), session(250)), 200))
    }

    @Test
    fun `cursor never moves back`() {
        assertEquals(500L, UsageSyncRules.nextCursor(listOf(session(300)), 500))
    }

    @Test
    fun `nothing sent keeps the cursor`() {
        assertEquals(200L, UsageSyncRules.nextCursor(emptyList(), 200))
        assertNull(UsageSyncRules.nextCursor(emptyList(), null))
    }
}
