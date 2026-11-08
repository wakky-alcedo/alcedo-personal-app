package com.alcedo.personal.sync

/**
 * A row that is saved on the device first and pushed later (beliefs, habits).
 * [deletedAt] is a local tombstone kept until the server accepts the delete.
 */
interface LocalFirstRow {
    val id: String
    val updatedAt: String
    val syncStatus: SyncStatus
    val deletedAt: String?
}

private val LocalFirstRow.isPending: Boolean get() = syncStatus != SyncStatus.SYNCED

/** Server rows to write into the cache and cached ids to remove after a pull. */
data class MergePlan<T>(val upserts: List<T>, val removeIds: List<String>)

/** Pure rules for local-first beliefs and habits (unit-tested without Room). */
object LocalFirstSyncRules {

    /**
     * Server rows overwrite synced cache rows, but never a pending local change (edit or
     * tombstone): that change is pushed later and the server decides by updatedAt.
     * Synced rows missing on the server were deleted elsewhere and are removed; pending rows
     * missing on the server are local creations not sent yet and are kept.
     */
    fun <T : LocalFirstRow> planServerMerge(local: List<T>, server: List<T>): MergePlan<T> {
        val localById = local.associateBy { it.id }
        val serverIds = server.mapTo(HashSet()) { it.id }
        return MergePlan(
            upserts = server.filter { localById[it.id]?.isPending != true },
            removeIds = local.filter { it.id !in serverIds && !it.isPending }.map { it.id }
        )
    }

    enum class PushAction {
        /** Upsert accepted: store the server's copy as SYNCED. */
        APPLY_SERVER,
        /** Delete accepted, or the server rejected the change (400/404): drop the local row. */
        REMOVE_LOCAL,
        /** Offline/server error: keep it queued and retry. */
        RETRY_LATER
    }

    fun afterPush(row: LocalFirstRow, result: PushResult): PushAction = when (result) {
        PushResult.OK -> if (row.deletedAt != null) PushAction.REMOVE_LOCAL else PushAction.APPLY_SERVER
        PushResult.REJECTED -> PushAction.REMOVE_LOCAL
        PushResult.RETRYABLE -> PushAction.RETRY_LATER
    }

    /** True when the row was not edited again while its push was in flight. */
    fun unchangedSince(sent: LocalFirstRow, current: LocalFirstRow?): Boolean =
        current != null && current.updatedAt == sent.updatedAt && current.deletedAt == sent.deletedAt
}

/** Result of pushing one local-first row; [serverCopy] is the row as the server now stores it. */
data class PushOutcome<T>(val result: PushResult, val serverCopy: T? = null)

/**
 * Pushes [pending] rows in order. Stops at the first retryable failure and returns false so
 * the caller's worker retries; returns true when nothing is left to retry.
 */
internal suspend fun <T : LocalFirstRow> pushLocalFirstRows(
    pending: List<T>,
    push: (T) -> PushOutcome<T>,
    applyServer: suspend (sent: T, serverCopy: T?) -> Unit,
    removeLocal: suspend (sent: T) -> Unit,
): Boolean {
    for (row in pending) {
        val outcome = push(row)
        when (LocalFirstSyncRules.afterPush(row, outcome.result)) {
            LocalFirstSyncRules.PushAction.APPLY_SERVER -> applyServer(row, outcome.serverCopy)
            LocalFirstSyncRules.PushAction.REMOVE_LOCAL -> removeLocal(row)
            LocalFirstSyncRules.PushAction.RETRY_LATER -> return false
        }
    }
    return true
}
