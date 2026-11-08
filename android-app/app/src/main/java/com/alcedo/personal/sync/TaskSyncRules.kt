package com.alcedo.personal.sync

/** Pure merge rules for pulling tasks from the server (unit-tested without Room). */
object TaskSyncRules {

    /** A server row replaces the cache unless an unsent local edit is at least as new. */
    fun shouldApplyServerTask(local: TaskEntity?, server: TaskEntity): Boolean =
        local == null || local.syncStatus == SyncStatus.SYNCED || local.version < server.version

    /**
     * Applies a server tombstone to the cached task, or returns null to keep the local row.
     * Same conflict rule as the server: a newer unsent local edit wins over the tombstone.
     */
    fun applyTombstone(local: TaskEntity, tombstone: TaskSyncApiClient.TaskTombstone): TaskEntity? {
        if (local.deletedAt != null) return null
        if (local.syncStatus != SyncStatus.SYNCED && local.version > tombstone.version) return null
        return local.copy(
            deletedAt = tombstone.updatedAt,
            updatedAt = tombstone.updatedAt,
            version = tombstone.version,
            syncStatus = SyncStatus.SYNCED
        )
    }
}
