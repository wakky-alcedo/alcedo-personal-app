package com.alcedo.personal.analytics

/** Pure rules for pushing usage sessions (unit-tested without Android). */
object UsageSyncRules {
    /** Periodic sync interval; WorkManager's minimum for periodic work. */
    const val SYNC_INTERVAL_MINUTES = 15L
    /** Hour (local) that starts the "effective day"; the query window begins at this hour yesterday. */
    const val DAY_START_HOUR = 6

    /**
     * Sessions not pushed yet: those ending after [cursorEndMs] (the latest end already accepted).
     * The query window still reaches back a day so a long session that started before the cursor
     * is not lost; only the upload is trimmed.
     */
    fun unsent(sessions: List<UsageSession>, cursorEndMs: Long?): List<UsageSession> =
        if (cursorEndMs == null) sessions else sessions.filter { it.endedAtMs > cursorEndMs }

    /** Cursor to save after [sent] was accepted; unchanged when nothing was sent. */
    fun nextCursor(sent: List<UsageSession>, cursorEndMs: Long?): Long? =
        sent.maxOfOrNull { it.endedAtMs }?.let { maxOf(it, cursorEndMs ?: it) } ?: cursorEndMs
}
