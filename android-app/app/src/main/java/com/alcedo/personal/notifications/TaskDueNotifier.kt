package com.alcedo.personal.notifications

import com.alcedo.personal.sync.TaskEntity
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/** タスク期限通知の対象選定ロジック（web-app の dueTaskNotifications.ts と同等のルール） */
object TaskDueNotifier {

    /** タスクの dueAt(日付) + dueTime(HH:mm, ローカル時刻) を結合した期限時刻。いずれか未設定/不正なら null */
    fun getTaskDueDateTime(task: TaskEntity): Instant? {
        val dueAt = task.dueAt ?: return null
        val dueTime = task.dueTime ?: return null
        return try {
            val date = LocalDate.parse(dueAt.take(10))
            val parts = dueTime.split(":")
            val time = LocalTime.of(parts[0].toInt(), parts[1].toInt())
            LocalDateTime.of(date, time).atZone(ZoneId.systemDefault()).toInstant()
        } catch (e: Exception) {
            null
        }
    }

    /** 「通知済み」キー。dueAt/dueTime が変わると新しいキーになり再通知される */
    fun buildNotifiedKey(task: TaskEntity): String = "${task.id}:${task.dueAt}:${task.dueTime}"

    /**
     * 通知すべきタスクを選定する。
     * 対象: dueAt/dueTime が両方設定済み、status !== "done"、deletedAt なし、
     * 期限が (now, now + reminderMinutes] の範囲内、かつ未通知のもの。
     */
    fun selectTasksToNotify(
        tasks: List<TaskEntity>,
        now: Instant,
        reminderMinutes: Int,
        notifiedKeys: Set<String>,
    ): List<TaskEntity> {
        val windowMs = reminderMinutes * 60_000L
        return tasks.filter { task ->
            if (task.status == "done" || task.deletedAt != null) return@filter false
            val due = getTaskDueDateTime(task) ?: return@filter false
            val diffMs = due.toEpochMilli() - now.toEpochMilli()
            if (diffMs <= 0 || diffMs > windowMs) return@filter false
            buildNotifiedKey(task) !in notifiedKeys
        }
    }

    /** done/削除/編集済みタスクの古い通知済みキーを除去し、無限増加を防ぐ */
    fun pruneNotifiedKeys(tasks: List<TaskEntity>, notifiedKeys: Set<String>): Set<String> {
        val validKeys = tasks
            .filter { it.status != "done" && it.deletedAt == null && getTaskDueDateTime(it) != null }
            .map { buildNotifiedKey(it) }
            .toSet()
        return notifiedKeys.filter { it in validKeys }.toSet()
    }
}
