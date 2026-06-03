package com.alcedo.personal.ui.dashboard

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alcedo.personal.sync.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter

data class HabitUiState(
    val habit: HabitEntity,
    val completedToday: Boolean,
    val streakDays: Int
)

class DashboardViewModel(app: Application) : AndroidViewModel(app) {
    private val db = DbProvider.get(app)
    private val taskDao = db.taskDao()
    private val beliefRepo = BeliefRepository(app, db.beliefDao())
    private val habitRepo  = HabitRepository(app, db.habitDao())

    private val _beliefIndex = MutableStateFlow(0)
    private val _syncing     = MutableStateFlow(false)
    val syncing: StateFlow<Boolean> = _syncing

    val beliefs: StateFlow<List<BeliefEntity>> = beliefRepo.observeActive()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val currentBelief: StateFlow<BeliefEntity?> = beliefs
        .map { list -> if (list.isEmpty()) null else list[_beliefIndex.value % list.size] }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    /** 今日が期限かつ todo のタスクのみ */
    val todayTodos: StateFlow<List<TaskEntity>> = taskDao.observeActiveTasks()
        .map { list ->
            val todayPrefix = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            list.filter { it.status == "todo" && it.dueAt?.startsWith(todayPrefix) == true }
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
        val from30 = daysAgo(30)
        return habits.map { habit ->
            val logs = db.habitDao().getRecentLogs(habit.id, from30)
            HabitUiState(habit, habit.id in completedIds, computeStreak(logs, today))
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
            pullTasksFromServer()
            TaskSyncScheduler.enqueue(getApplication())
        } finally {
            _syncing.value = false
        }
    }

    private suspend fun pullTasksFromServer() = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        val url = SyncConfig.getServerUrl(getApplication())
        val key = SyncConfig.getApiKey(getApplication())
        val pulled = TaskSyncApiClient(url, key).pullTasks() ?: return@withContext
        for (serverTask in pulled) {
            val local = taskDao.findById(serverTask.id)
            // ローカルに未送信の変更がある場合は上書きしない
            if (local == null || local.syncStatus == SyncStatus.SYNCED) {
                taskDao.upsert(serverTask)
            } else if (local.version < serverTask.version) {
                taskDao.upsert(serverTask)
            }
        }
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private fun today() = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
    private fun daysAgo(n: Int) = LocalDate.now().minusDays(n.toLong()).format(DateTimeFormatter.ISO_LOCAL_DATE)

    private fun computeStreak(logs: List<String>, today: String): Int {
        val set = logs.toHashSet()
        val start = when {
            set.contains(today) -> LocalDate.parse(today)
            else -> {
                val yesterday = LocalDate.parse(today).minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
                if (set.contains(yesterday)) LocalDate.parse(yesterday) else return 0
            }
        }
        var streak = 0
        var cursor = start
        while (set.contains(cursor.format(DateTimeFormatter.ISO_LOCAL_DATE))) {
            streak++
            cursor = cursor.minusDays(1)
        }
        return streak
    }
}
