package com.alcedo.personal.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.sync.TaskEntity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(vm: DashboardViewModel = viewModel()) {
    val beliefs by vm.beliefs.collectAsStateWithLifecycle()
    val currentBelief by vm.currentBelief.collectAsStateWithLifecycle()
    val habitsWithStatus by vm.habitsWithStatus.collectAsStateWithLifecycle()
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val showAddTask by vm.showAddTask.collectAsStateWithLifecycle()

    var taskFilter by remember { mutableStateOf("todo") }
    val filteredTasks = tasks.filter {
        when (taskFilter) {
            "todo"  -> it.status == "todo"
            "doing" -> it.status == "doing"
            "done"  -> it.status == "done"
            else    -> true
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Alcedo", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { vm.syncNow() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "同期")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(vertical = 12.dp)
        ) {
            // ─── 信念カード ─────────────────────────────────────────
            if (beliefs.isNotEmpty() && currentBelief != null) {
                item {
                    BeliefCard(
                        text = currentBelief!!.text,
                        hasMultiple = beliefs.size > 1,
                        onNext = { vm.nextBelief() }
                    )
                }
            }

            // ─── 習慣クイックチェック ──────────────────────────────
            if (habitsWithStatus.isNotEmpty()) {
                item {
                    HabitCard(
                        habits = habitsWithStatus,
                        onCheckIn = { vm.checkInHabit(it) }
                    )
                }
            }

            // ─── タスク ──────────────────────────────────────────────
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Tasks", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    IconButton(onClick = { vm.toggleAddTask() }) {
                        Icon(Icons.Default.Add, contentDescription = "タスクを追加")
                    }
                }
            }

            // 追加フォーム
            if (showAddTask) {
                item {
                    TaskAddForm(
                        onAdd = { vm.createTask(it) },
                        onDismiss = { vm.hideAddTask() }
                    )
                }
            }

            // フィルターチップ
            item {
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    listOf("todo" to "Todo", "doing" to "Doing", "done" to "Done", "all" to "All")
                        .forEachIndexed { idx, (value, label) ->
                            SegmentedButton(
                                selected = taskFilter == value,
                                onClick = { taskFilter = value },
                                shape = SegmentedButtonDefaults.itemShape(idx, 4),
                                label = { Text(label, style = MaterialTheme.typography.labelSmall) }
                            )
                        }
                }
            }

            if (filteredTasks.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(24.dp), Alignment.Center) {
                        Text("タスクがありません", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            items(filteredTasks, key = { it.id }) { task ->
                TaskCard(
                    task = task,
                    onToggleDone = { vm.toggleDone(task) },
                    onDelete = { vm.deleteTask(task) }
                )
            }

            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

// ─── 信念カード ──────────────────────────────────────────────────────────────

@Composable
private fun BeliefCard(text: String, hasMultiple: Boolean, onNext: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "信念",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
                if (hasMultiple) {
                    TextButton(onClick = onNext, contentPadding = PaddingValues(0.dp)) {
                        Text("›", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text,
                style = MaterialTheme.typography.bodyLarge,
                fontStyle = FontStyle.Italic,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

// ─── 習慣カード ──────────────────────────────────────────────────────────────

@Composable
private fun HabitCard(habits: List<HabitUiState>, onCheckIn: (String) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(
                "Habit check",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                habits.forEach { state ->
                    HabitChip(
                        state = state,
                        onClick = { if (!state.completedToday) onCheckIn(state.habit.id) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun HabitChip(state: HabitUiState, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val done = state.completedToday
    FilterChip(
        selected = done,
        onClick = onClick,
        label = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(state.habit.name, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                if (state.streakDays > 0) {
                    Text("🔥${state.streakDays}", style = MaterialTheme.typography.labelSmall)
                }
            }
        },
        leadingIcon = if (done) {{ Icon(Icons.Default.Check, null, Modifier.size(14.dp)) }} else null,
        modifier = modifier
    )
}

// ─── タスク追加フォーム ──────────────────────────────────────────────────────

@Composable
private fun TaskAddForm(onAdd: (String) -> Unit, onDismiss: () -> Unit) {
    var title by remember { mutableStateOf("") }

    OutlinedTextField(
        value = title,
        onValueChange = { title = it },
        modifier = Modifier.fillMaxWidth(),
        placeholder = { Text("タスクのタイトル") },
        singleLine = true,
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

// ─── タスクカード ────────────────────────────────────────────────────────────

@Composable
private fun TaskCard(task: TaskEntity, onToggleDone: () -> Unit, onDelete: () -> Unit) {
    val isDone = task.status == "done"
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isDone)
                MaterialTheme.colorScheme.surfaceVariant
            else
                MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(checked = isDone, onCheckedChange = { onToggleDone() })
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
                    task.dueAt?.let { due ->
                        Text(
                            due.take(10),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "削除",
                    tint = MaterialTheme.colorScheme.error.copy(alpha = 0.6f),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun PriorityBadge(priority: String) {
    val (label, color) = when (priority) {
        "high"   -> "High"   to MaterialTheme.colorScheme.error
        "medium" -> "Med"    to MaterialTheme.colorScheme.primary
        else     -> "Low"    to MaterialTheme.colorScheme.outline
    }
    Surface(
        shape = MaterialTheme.shapes.extraSmall,
        color = color.copy(alpha = 0.12f)
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}
