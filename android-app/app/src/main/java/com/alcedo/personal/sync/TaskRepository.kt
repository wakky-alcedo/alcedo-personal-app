package com.alcedo.personal.sync

import android.content.Context
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
}
