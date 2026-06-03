package com.alcedo.personal.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.sync.TaskEntity
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(onNavigateToTask: (String) -> Unit = {}, vm: DashboardViewModel = viewModel()) {
    val beliefs          by vm.beliefs.collectAsStateWithLifecycle()
    val currentBelief    by vm.currentBelief.collectAsStateWithLifecycle()
    val habitsWithStatus by vm.habitsWithStatus.collectAsStateWithLifecycle()
    val tasks            by vm.tasks.collectAsStateWithLifecycle()
    val showAddTask      by vm.showAddTask.collectAsStateWithLifecycle()
    val syncing          by vm.syncing.collectAsStateWithLifecycle()

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
                    if (syncing) {
                        CircularProgressIndicator(Modifier.size(24.dp).padding(4.dp), strokeWidth = 2.dp)
                    } else {
                        IconButton(onClick = { vm.syncNow() }) {
                            Icon(Icons.Default.Refresh, contentDescription = "同期")
                        }
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(vertical = 12.dp)
        ) {
            // ─── 信念 ──────────────────────────────────────────────────────────
            item {
                BeliefCard(
                    text = currentBelief?.text,
                    hasMultiple = beliefs.size > 1,
                    onNext = { vm.nextBelief() }
                )
            }

            // ─── 習慣クイックチェック ──────────────────────────────────────────
            item {
                HabitCard(habitsWithStatus) { vm.checkInHabit(it) }
            }
            if (habitsWithStatus.isNotEmpty()) {
                item { HabitHeatmap(habitsWithStatus, vm) }
            }

            // ─── タスク ────────────────────────────────────────────────────────
            item {
                Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                    Text("Tasks", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    IconButton(onClick = { vm.toggleAddTask() }) { Icon(Icons.Default.Add, null) }
                }
            }
            if (showAddTask) {
                item { TaskAddForm(onAdd = { vm.createTask(it) }, onDismiss = { vm.hideAddTask() }) }
            }
            item {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    listOf("todo" to "Todo", "doing" to "Doing", "done" to "Done", "all" to "All")
                        .forEachIndexed { idx, (v, label) ->
                            SegmentedButton(selected = taskFilter == v, onClick = { taskFilter = v },
                                shape = SegmentedButtonDefaults.itemShape(idx, 4),
                                label = { Text(label, style = MaterialTheme.typography.labelSmall) })
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
                TaskCard(task, onToggleDone = { vm.toggleDone(task) },
                    onDelete = { vm.deleteTask(task) },
                    onTap = { onNavigateToTask(task.id) })
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

// ─── 信念カード ─────────────────────────────────────────────────────────────

@Composable
private fun BeliefCard(text: String?, hasMultiple: Boolean, onNext: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Column(Modifier.padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                Text("信念", style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                if (hasMultiple) TextButton(onClick = onNext, contentPadding = PaddingValues(0.dp)) {
                    Text("›", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                }
            }
            Spacer(Modifier.height(8.dp))
            if (text != null) {
                Text(text, style = MaterialTheme.typography.bodyLarge, fontStyle = FontStyle.Italic, fontWeight = FontWeight.Medium)
            } else {
                Text("設定から信念を追加してください", style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant, fontStyle = FontStyle.Italic)
            }
        }
    }
}

// ─── 習慣クイックチェック ───────────────────────────────────────────────────

@Composable
private fun HabitCard(habits: List<HabitUiState>, onCheckIn: (String) -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text("Habit check", style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            if (habits.isEmpty()) {
                Text("設定から習慣を追加してください", style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    habits.forEach { state ->
                        FilterChip(
                            selected = state.completedToday,
                            onClick = { if (!state.completedToday) onCheckIn(state.habit.id) },
                            label = {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(state.habit.name, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                                    if (state.streakDays > 0)
                                        Text("🔥${state.streakDays}", style = MaterialTheme.typography.labelSmall)
                                }
                            },
                            leadingIcon = if (state.completedToday) {{ Icon(Icons.Default.Check, null, Modifier.size(14.dp)) }} else null,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

// ─── 習慣ヒートマップ ────────────────────────────────────────────────────────

@Composable
private fun HabitHeatmap(habits: List<HabitUiState>, vm: DashboardViewModel) {
    val today = LocalDate.now()
    val days = (59 downTo 0).map { today.minusDays(it.toLong()) }
    val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text("Habit calendar", style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth()) {
                // 習慣名列
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Spacer(Modifier.height(14.dp)) // month labels row
                    habits.forEach { state ->
                        Box(Modifier.height(12.dp).width(72.dp), Alignment.CenterStart) {
                            Text(state.habit.name, style = MaterialTheme.typography.labelSmall,
                                maxLines = 1, fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                Spacer(Modifier.width(4.dp))
                // スクロール可能なセル列
                Row(Modifier.weight(1f).horizontalScroll(rememberScrollState())) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        // 月ラベル
                        Row {
                            days.forEachIndexed { i, day ->
                                val w = if (i > 0 && i % 7 == 0) 4.dp else 0.dp
                                Spacer(Modifier.width(w))
                                if (day.dayOfMonth == 1) {
                                    Text("${day.monthValue}月", fontSize = 9.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.width(14.dp))
                                } else Spacer(Modifier.width(14.dp))
                            }
                        }
                        // 習慣ごとの行
                        habits.forEach { state ->
                            // TODO: ideally load log data per habit — using rough heuristic for now
                            Row {
                                days.forEachIndexed { i, day ->
                                    val dayStr = day.format(DateTimeFormatter.ISO_LOCAL_DATE)
                                    val w = if (i > 0 && i % 7 == 0) 4.dp else 0.dp
                                    Spacer(Modifier.width(w))
                                    val isDone = dayStr == todayStr && state.completedToday
                                    val isToday = dayStr == todayStr
                                    Box(
                                        Modifier.size(12.dp)
                                            .background(
                                                when {
                                                    isDone -> Color(0xFF22C55E)
                                                    else   -> Color(0xFFE2E8F0)
                                                },
                                                MaterialTheme.shapes.extraSmall
                                            )
                                            .then(if (isToday) Modifier.padding(1.dp) else Modifier)
                                    )
                                    Spacer(Modifier.width(2.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ─── タスク追加フォーム ─────────────────────────────────────────────────────

@Composable
private fun TaskAddForm(onAdd: (String) -> Unit, onDismiss: () -> Unit) {
    var title by remember { mutableStateOf("") }
    OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(),
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

// ─── タスクカード ───────────────────────────────────────────────────────────

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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskCard(task: TaskEntity, onToggleDone: () -> Unit, onDelete: () -> Unit, onTap: () -> Unit) {
    val isDone = task.status == "done"
    Card(onClick = onTap, modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = if (isDone) MaterialTheme.colorScheme.surfaceVariant else dueDateBg(task.dueAt))) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Checkbox(isDone, { onToggleDone() })
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text(task.title, style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (isDone) FontWeight.Normal else FontWeight.Medium,
                    color = if (isDone) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PriorityBadge(task.priority)
                    task.dueAt?.let { Text(it.take(10), style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error.copy(alpha = 0.6f),
                    modifier = Modifier.size(18.dp))
            }
        }
    }
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
