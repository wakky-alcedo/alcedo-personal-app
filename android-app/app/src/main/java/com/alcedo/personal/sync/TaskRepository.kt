package com.alcedo.personal.sync

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.util.UUID

class TaskRepository(
    private val context: Context,
    private val dao: TaskDao
) {
    suspend fun listActiveTasks(limit: Int = 50): List<TaskEntity> {
        return dao.listActiveTasks(limit)
    }

    suspend fun createTask(
        title: String,
        description: String?,
        categoryType: String,
        categoryName: String,
        priority: String,
        dueAt: String?
    ): TaskEntity {
        val task = TaskEntity(
            id = UUID.randomUUID().toString(),
            title = title,
            description = description,
            categoryType = categoryType,
            categoryName = categoryName,
            priority = priority,
            dueAt = dueAt,
            status = "todo",
            syncStatus = SyncStatus.UNSENT,
            deletedAt = null,
            updatedAt = Instant.now().toString(),
            version = 1
        )
        dao.upsert(task)
        TaskSyncScheduler.enqueue(context)
        return task
    }

    suspend fun markDone(taskId: String) {
        val current = dao.findById(taskId) ?: return
        val updated = current.copy(
            status = "done",
            syncStatus = SyncStatus.UNSENT,
            updatedAt = Instant.now().toString(),
            version = current.version + 1
        )
        dao.upsert(updated)
        TaskSyncScheduler.enqueue(context)
    }

    suspend fun softDelete(taskId: String) {
        val current = dao.findById(taskId) ?: return
        val now = Instant.now().toString()
        val updated = current.copy(
            syncStatus = SyncStatus.UNSENT,
            deletedAt = now,
            updatedAt = now,
            version = current.version + 1
        )
        dao.upsert(updated)
        TaskSyncScheduler.enqueue(context)
    }

    /** PC サーバーから最新のタスクを取得し、未送信のローカル変更を上書きしないようマージする。取得に失敗した場合は false を返す */
    suspend fun syncFromServer(): Boolean = withContext(Dispatchers.IO) {
        val client = TaskSyncApiClient(SyncConfig.httpClient(context))
        val pulled = client.pullTasks() ?: return@withContext false
        for (serverTask in pulled) {
            val local = dao.findById(serverTask.id)
            if (local == null || local.syncStatus == SyncStatus.SYNCED) {
                dao.upsert(serverTask)
            } else if (local.version < serverTask.version) {
                dao.upsert(serverTask)
            }
        }
        // Same conflict rule as the server: a newer unsent local edit wins over the tombstone.
        client.pullDeletions()?.forEach { tombstone ->
            val local = dao.findById(tombstone.id) ?: return@forEach
            if (local.deletedAt != null) return@forEach
            if (local.syncStatus == SyncStatus.SYNCED || local.version <= tombstone.version) {
                dao.upsert(local.copy(
                    deletedAt = tombstone.updatedAt,
                    updatedAt = tombstone.updatedAt,
                    version = tombstone.version,
                    syncStatus = SyncStatus.SYNCED
                ))
            }
        }
        true
    }
}
