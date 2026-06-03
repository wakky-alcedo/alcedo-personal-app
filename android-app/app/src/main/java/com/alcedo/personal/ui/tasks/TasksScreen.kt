package com.alcedo.personal.ui.tasks

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.sync.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

// ─── ViewModel ────────────────────────────────────────────────────────────────

class TasksViewModel(app: Application) : AndroidViewModel(app) {
    private val db      = DbProvider.get(app)
    private val taskDao = db.taskDao()

    private val _allTasks = taskDao.observeActiveTasks()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _filter      = MutableStateFlow("all")
    private val _showAddForm = MutableStateFlow(false)
    val filter:      StateFlow<String>  = _filter
    val showAddForm: StateFlow<Boolean> = _showAddForm

    val tasks: StateFlow<List<TaskEntity>> = combine(_allTasks, _filter) { list, f ->
        when (f) {
            "todo"  -> list.filter { it.status == "todo" }
            "doing" -> list.filter { it.status == "doing" }
            "done"  -> list.filter { it.status == "done" }
            else    -> list
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun setFilter(f: String)     { _filter.value = f }
    fun toggleAddForm()          { _showAddForm.value = !_showAddForm.value }
    fun hideAddForm()            { _showAddForm.value = false }

    fun createTask(title: String, dueAtToday: Boolean = false) {
        if (title.isBlank()) return
        viewModelScope.launch {
            val now = Instant.now().toString()
            val dueAt = if (dueAtToday)
                "${LocalDate.now()}T00:00:00.000Z" else null
            taskDao.upsert(TaskEntity(
                id = UUID.randomUUID().toString(), title = title.trim(),
                description = null, categoryType = "short_term", categoryName = "today",
                priority = "medium", dueAt = dueAt, status = "todo",
                syncStatus = SyncStatus.UNSENT, deletedAt = null, updatedAt = now, version = 1
            ))
            TaskSyncScheduler.enqueue(getApplication())
            _showAddForm.value = false
        }
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

    fun delete(task: TaskEntity) {
        viewModelScope.launch {
            val now = Instant.now().toString()
            taskDao.upsert(task.copy(
                deletedAt = now, syncStatus = SyncStatus.UNSENT, updatedAt = now, version = task.version + 1
            ))
            TaskSyncScheduler.enqueue(getApplication())
        }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
    onNavigateToDetail: (String) -> Unit = {},
    vm: TasksViewModel = viewModel()
) {
    val tasks       by vm.tasks.collectAsStateWithLifecycle()
    val filter      by vm.filter.collectAsStateWithLifecycle()
    val showAddForm by vm.showAddForm.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tasks", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { vm.toggleAddForm() }) {
                        Icon(Icons.Default.Add, "追加")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(vertical = 12.dp)
        ) {
            // 追加フォーム
            if (showAddForm) {
                item { AddTaskForm(onAdd = { vm.createTask(it) }, onDismiss = { vm.hideAddForm() }) }
            }

            // フィルター
            item {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    listOf("all" to "All", "todo" to "Todo", "doing" to "Doing", "done" to "Done")
                        .forEachIndexed { idx, (v, label) ->
                            SegmentedButton(
                                selected = filter == v, onClick = { vm.setFilter(v) },
                                shape = SegmentedButtonDefaults.itemShape(idx, 4),
                                label = { Text(label, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                }
            }

            if (tasks.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) {
                        Text("タスクがありません", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            items(tasks, key = { it.id }) { task ->
                TaskListCard(
                    task = task,
                    onToggleDone = { vm.toggleDone(task) },
                    onDelete = { vm.delete(task) },
                    onTap = { onNavigateToDetail(task.id) }
                )
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

// ─── 追加フォーム ──────────────────────────────────────────────────────────────

@Composable
private fun AddTaskForm(onAdd: (String) -> Unit, onDismiss: () -> Unit) {
    var title by remember { mutableStateOf("") }
    OutlinedTextField(
        value = title, onValueChange = { title = it },
        modifier = Modifier.fillMaxWidth(),
        placeholder = { Text("タスクのタイトル") }, singleLine = true,
        trailingIcon = {
            Row {
                TextButton(onClick = onDismiss) { Text("キャンセル") }
                TextButton(onClick = { onAdd(title) }, enabled = title.isNotBlank()) { Text("追加") }
            }
        },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { onAdd(title) })
    )
}

// ─── タスクカード ──────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskListCard(task: TaskEntity, onToggleDone: () -> Unit, onDelete: () -> Unit, onTap: () -> Unit) {
    val isDone = task.status == "done"
    Card(
        onClick = onTap, modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isDone) MaterialTheme.colorScheme.surfaceVariant
            else dueDateBg(task.dueAt)
        )
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(isDone, { onToggleDone() })
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    task.title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (isDone) FontWeight.Normal else FontWeight.Medium,
                    color = if (isDone) MaterialTheme.colorScheme.onSurfaceVariant
                            else MaterialTheme.colorScheme.onSurface
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PriorityBadge(task.priority)
                    task.dueAt?.let {
                        Text(it.take(10), style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, null,
                    tint = MaterialTheme.colorScheme.error.copy(alpha = 0.6f),
                    modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun dueDateBg(dueAt: String?): Color {
    val surface = MaterialTheme.colorScheme.surface
    if (dueAt == null) return surface
    return try {
        val due = LocalDate.parse(dueAt.take(10))
        val diff = ChronoUnit.DAYS.between(LocalDate.now(), due)
        when {
            diff < 0   -> Color(0xFFF5F5F5)
            diff == 0L -> Color(0xFFFFE0E0)
            diff <= 3  -> Color(0xFFFFF3E0)
            diff <= 7  -> Color(0xFFFFFDE7)
            else       -> surface
        }
    } catch (e: Exception) { surface }
}

@Composable
private fun PriorityBadge(priority: String) {
    val (label, color) = when (priority) {
        "high"   -> "High" to MaterialTheme.colorScheme.error
        "medium" -> "Med"  to MaterialTheme.colorScheme.primary
        else     -> "Low"  to MaterialTheme.colorScheme.outline
    }
    Surface(shape = MaterialTheme.shapes.extraSmall, color = color.copy(alpha = 0.12f)) {
        Text(label, Modifier.padding(horizontal = 6.dp, vertical = 1.dp),
            style = MaterialTheme.typography.labelSmall, color = color)
    }
}
