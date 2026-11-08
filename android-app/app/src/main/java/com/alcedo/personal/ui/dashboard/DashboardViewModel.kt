package com.alcedo.personal.ui.dashboard

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alcedo.personal.sync.*
import com.alcedo.personal.ui.util.TimeUtils
import com.alcedo.personal.ui.util.TimeUtils.toLocalDateStr
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.Instant

data class HabitUiState(
    val habit: HabitEntity,
    val completedToday: Boolean,
    val streakDays: Int,
    val completedDates: Set<String>
)

class DashboardViewModel(app: Application) : AndroidViewModel(app) {
    companion object {
        /** 習慣ヒートマップ（HabitHeatmapContent）に表示する日数 */
        const val HEATMAP_DAYS = 60
    }

    private val db = DbProvider.get(app)
    private val taskDao = db.taskDao()
    private val beliefRepo = BeliefRepository(app, db.beliefDao())
    private val habitRepo  = HabitRepository(app, db.habitDao())
    private val taskRepo   = TaskRepository(app, taskDao)

    private val _beliefIndex = MutableStateFlow(0)
    private val _syncing     = MutableStateFlow(false)
    val syncing: StateFlow<Boolean> = _syncing

    val beliefs: StateFlow<List<BeliefEntity>> = beliefRepo.observeActive()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val currentBelief: StateFlow<BeliefEntity?> = beliefs
        .map { list -> if (list.isEmpty()) null else list[_beliefIndex.value % list.size] }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /** 今日が期限かつ todo のタスクのみ（6時閾値・UTC→ローカル変換） */
    val todayTodos: StateFlow<List<TaskEntity>> = taskDao.observeActiveTasks()
        .map { list ->
            val effectiveToday = TimeUtils.effectiveLocalDateStr()
            list.filter { task ->
                task.status == "todo" && task.dueAt?.toLocalDateStr() == effectiveToday
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /**
     * Recomputed whenever habits or check-in logs change (local check-in, server pull,
     * retry worker), so the dashboard never shows a stale status after a sync.
     */
    val habitsWithStatus: StateFlow<List<HabitUiState>> =
        combine(habitRepo.observeActive(), habitRepo.observeLogs()) { habits, logs ->
            val today = TimeUtils.effectiveLocalDateStr()
            val datesByHabit = logs.groupBy({ it.habitId }, { it.doneDate }).mapValues { it.value.toSet() }
            habits.map { habit ->
                val dates = datesByHabit[habit.id].orEmpty()
                HabitUiState(habit, today in dates, HabitStreak.compute(dates, today, habit.allowedMissDays), dates)
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        viewModelScope.launch { syncAll() }
    }

    fun nextBelief() {
        val list = beliefs.value
        if (list.size > 1) _beliefIndex.value = (_beliefIndex.value + 1) % list.size
    }

    fun toggleDone(task: TaskEntity) {
        viewModelScope.launch {
            taskDao.upsert(task.copy(
                status = if (task.status == "done") "todo" else "done",
                syncStatus = SyncStatus.UNSENT,
                updatedAt = Instant.now().toString(),
                version = task.version + 1
            ))
            TaskSyncScheduler.enqueue(getApplication())
        }
    }

    fun checkInHabit(habitId: String) {
        // The local log row is written first, so habitsWithStatus updates immediately;
        // a failed push is retried in the background by HabitSyncWorker.
        viewModelScope.launch { habitRepo.checkIn(habitId) }
    }

    fun syncNow() { viewModelScope.launch { syncAll() } }

    private suspend fun syncAll() {
        _syncing.value = true
        try {
            beliefRepo.syncFromServer()
            habitRepo.syncFromServer()
            taskRepo.syncFromServer()
            TaskSyncScheduler.enqueue(getApplication())
        } finally {
            _syncing.value = false
        }
    }
}
