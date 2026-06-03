package com.alcedo.personal.ui.dashboard

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alcedo.personal.sync.BeliefEntity
import com.alcedo.personal.sync.DbProvider
import com.alcedo.personal.sync.HabitEntity
import com.alcedo.personal.sync.HabitLogEntity
import com.alcedo.personal.sync.SyncStatus
import com.alcedo.personal.sync.TaskEntity
import com.alcedo.personal.sync.TaskSyncScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

data class HabitUiState(
    val habit: HabitEntity,
    val completedToday: Boolean,
    val streakDays: Int
)

class DashboardViewModel(app: Application) : AndroidViewModel(app) {
    private val db = DbProvider.get(app)
    private val taskDao = db.taskDao()
    private val beliefDao = db.beliefDao()
    private val habitDao = db.habitDao()

    private val _beliefIndex = MutableStateFlow(0)
    private val _showAddTask = MutableStateFlow(false)
    val showAddTask: StateFlow<Boolean> = _showAddTask

    val beliefs: StateFlow<List<BeliefEntity>> = beliefDao.observeActiveBeliefs()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val currentBelief: StateFlow<BeliefEntity?> = beliefs
        .map { list -> if (list.isEmpty()) null else list[_beliefIndex.value % list.size] }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val tasks: StateFlow<List<TaskEntity>> = taskDao.observeActiveTasks()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _habitsWithStatus = MutableStateFlow<List<HabitUiState>>(emptyList())
    val habitsWithStatus: StateFlow<List<HabitUiState>> = _habitsWithStatus

    init {
        viewModelScope.launch {
            habitDao.observeActiveHabits().collect { habits ->
                _habitsWithStatus.value = computeHabitStatus(habits)
            }
        }
    }

    private suspend fun computeHabitStatus(habits: List<HabitEntity>): List<HabitUiState> {
        val today = today()
        val completedIds = habitDao.getCompletedHabitIds(today).toSet()
        val from30 = daysAgo(30)
        return habits.map { habit ->
            val logs = habitDao.getRecentLogs(habit.id, from30)
            HabitUiState(habit, habit.id in completedIds, computeStreak(logs, today))
        }
    }

    fun nextBelief() {
        val list = beliefs.value
        if (list.size > 1) _beliefIndex.value = (_beliefIndex.value + 1) % list.size
    }

    fun toggleAddTask() { _showAddTask.value = !_showAddTask.value }
    fun hideAddTask() { _showAddTask.value = false }

    fun createTask(title: String) {
        if (title.isBlank()) return
        viewModelScope.launch {
            val now = Instant.now().toString()
            taskDao.upsert(
                TaskEntity(
                    id = UUID.randomUUID().toString(),
                    title = title.trim(),
                    description = null,
                    categoryType = "short_term",
                    categoryName = "today",
                    priority = "medium",
                    dueAt = null,
                    status = "todo",
                    syncStatus = SyncStatus.UNSENT,
                    deletedAt = null,
                    updatedAt = now,
                    version = 1
                )
            )
            TaskSyncScheduler.enqueue(getApplication())
            _showAddTask.value = false
        }
    }

    fun toggleDone(task: TaskEntity) {
        viewModelScope.launch {
            val nextStatus = if (task.status == "done") "todo" else "done"
            taskDao.upsert(
                task.copy(
                    status = nextStatus,
                    syncStatus = SyncStatus.UNSENT,
                    updatedAt = Instant.now().toString(),
                    version = task.version + 1
                )
            )
            TaskSyncScheduler.enqueue(getApplication())
        }
    }

    fun deleteTask(task: TaskEntity) {
        viewModelScope.launch {
            val now = Instant.now().toString()
            taskDao.upsert(
                task.copy(
                    deletedAt = now,
                    syncStatus = SyncStatus.UNSENT,
                    updatedAt = now,
                    version = task.version + 1
                )
            )
            TaskSyncScheduler.enqueue(getApplication())
        }
    }

    fun checkInHabit(habitId: String) {
        viewModelScope.launch {
            habitDao.insertLog(
                HabitLogEntity(
                    habitId = habitId,
                    doneDate = today(),
                    createdAt = Instant.now().toString()
                )
            )
            // refresh
            val habits = habitDao.observeActiveHabits()
                .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList()).value
            _habitsWithStatus.value = computeHabitStatus(habits)
        }
    }

    fun syncNow() {
        TaskSyncScheduler.enqueue(getApplication())
    }

    // ─── helpers ──────────────────────────────────────────────

    private fun today(): String =
        LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

    private fun daysAgo(n: Int): String =
        LocalDate.now().minusDays(n.toLong()).format(DateTimeFormatter.ISO_LOCAL_DATE)

    private fun computeStreak(logs: List<String>, today: String): Int {
        val set = logs.toHashSet()
        var streak = 0
        var cursor = LocalDate.parse(if (set.contains(today)) today else {
            val yesterday = LocalDate.parse(today).minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
            if (set.contains(yesterday)) yesterday else return 0
        })
        while (set.contains(cursor.format(DateTimeFormatter.ISO_LOCAL_DATE))) {
            streak++
            cursor = cursor.minusDays(1)
        }
        return streak
    }
}
