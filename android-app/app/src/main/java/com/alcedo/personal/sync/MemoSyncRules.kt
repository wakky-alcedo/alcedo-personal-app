package com.alcedo.personal.sync

/** Pure rules for pulling memos (unit-tested without Room). */
object MemoSyncRules {
    /** GET /memos `since` for a cursor-driven pull: the cursor alone decides where to resume. */
    const val PULL_SINCE_EPOCH = "1970-01-01T00:00:00.000Z"
    /** Page size requested from the server (its maximum). */
    const val PULL_PAGE_LIMIT = 200
    private const val CURSOR_SEPARATOR = "|"

    /** Same "updatedAt|id" format as pc-server's formatPullCursor. */
    fun cursorAfter(memo: MemoEntity): String = "${memo.updatedAt}$CURSOR_SEPARATOR${memo.id}"

    /**
     * A server memo replaces the cache unless an unsent local change is at least as new.
     * The server only accepts a push with a higher version, so a newer server version wins.
     */
    fun shouldApplyRemote(local: MemoEntity?, remote: MemoEntity): Boolean =
        local == null || local.syncStatus == SyncStatus.SYNCED || remote.version > local.version
}
