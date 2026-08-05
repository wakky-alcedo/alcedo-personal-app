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
import java.time.LocalDate
import java.time.format.DateTimeFormatter

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

    private val _habitsWithStatus = MutableStateFlow<List<HabitUiState>>(emptyList())
    val habitsWithStatus: StateFlow<List<HabitUiState>> = _habitsWithStatus

    init {
        viewModelScope.launch { syncAll() }
        viewModelScope.launch {
            habitRepo.observeActive().collect { habits ->
                _habitsWithStatus.value = computeHabitStatus(habits)
            }
        }
    }

    private suspend fun computeHabitStatus(habits: List<HabitEntity>): List<HabitUiState> {
        val today = today()
        val completedIds = db.habitDao().getCompletedHabitIds(today).toSet()
        // ヒートマップ表示日数（HabitHeatmapContent の60日分）に合わせて取得
        val fromHeatmap = daysAgo(HEATMAP_DAYS)
        return habits.map { habit ->
            val logs = db.habitDao().getRecentLogs(habit.id, fromHeatmap)
            HabitUiState(habit, habit.id in completedIds, computeStreak(logs, today, habit.allowedMissDays), logs.toSet())
        }
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
        viewModelScope.launch {
            habitRepo.checkIn(habitId)
            // 既存のリストから habit を取得して再計算（新規 StateFlow を作らない）
            val currentHabits = _habitsWithStatus.value.map { it.habit }
            _habitsWithStatus.value = computeHabitStatus(currentHabits)
        }
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

    // ─── helpers ─────────────────────────────────────────────────────────────

    private fun today() = TimeUtils.effectiveLocalDateStr()
    private fun daysAgo(n: Int) = TimeUtils.effectiveDaysAgo(n)

    // Mirrors pc-server's computeStreakDays (routes/habits.ts): walks backward from
    // today (or yesterday, if today isn't logged yet), counting completed days.
    // A run of missed days is skipped over as long as its length is within
    // allowedMissDays; a longer run breaks the streak.
    private fun computeStreak(logs: List<String>, today: String, allowedMissDays: Int): Int {
        if (logs.isEmpty()) return 0
        val set = logs.toHashSet()
        val earliestDate = logs.minOrNull()?.let { LocalDate.parse(it) }
        var streak = 0
        var cursor: LocalDate? = if (set.contains(today)) LocalDate.parse(today) else LocalDate.parse(today).minusDays(1)

        fun key(d: LocalDate) = d.format(DateTimeFormatter.ISO_LOCAL_DATE)

        while (cursor != null && (earliestDate == null || !cursor.isBefore(earliestDate))) {
            if (set.contains(key(cursor))) {
                streak++
                cursor = cursor.minusDays(1)
                continue
            }

            var gapLen = 0
            var probe: LocalDate? = cursor
            while (probe != null && !set.contains(key(probe)) && (earliestDate == null || !probe.isBefore(earliestDate))) {
                gapLen++
                probe = probe.minusDays(1)
            }

            if (gapLen <= allowedMissDays) {
                cursor = probe
                continue
            }

            break
        }
        return streak
    }
}
