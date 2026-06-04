package com.alcedo.personal.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.LaunchedEffect
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
    val todayTodos       by vm.todayTodos.collectAsStateWithLifecycle()
    val syncing          by vm.syncing.collectAsStateWithLifecycle()

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

            // ─── 習慣（クイックチェック + カレンダー） ──────────────────────────
            item {
                HabitsBlock(habitsWithStatus, vm)
            }

            // ─── 今日のタスク ──────────────────────────────────────────────────
            item {
                Text("今日のタスク", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            if (todayTodos.isEmpty()) {
                item {
                    Card(Modifier.fillMaxWidth()) {
                        Box(Modifier.fillMaxWidth().padding(20.dp), Alignment.Center) {
                            Text("今日が期限のタスクはありません",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
            items(todayTodos, key = { it.id }) { task ->
                TaskCard(task, onToggleDone = { vm.toggleDone(task) },
                    onDelete = {}, // Dashboard では削除しない
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

// ─── 習慣ブロック（クイックチェック + カレンダー） ──────────────────────────

@Composable
private fun HabitsBlock(habits: List<HabitUiState>, vm: DashboardViewModel) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // ヘッダー
            Text("Habits", style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)

            // クイックチェック
            if (habits.isEmpty()) {
                Text("設定から習慣を追加してください", style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    habits.forEach { state ->
                        FilterChip(
                            selected = state.completedToday,
                            onClick = { if (!state.completedToday) vm.checkInHabit(state.habit.id) },
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

                // カレンダー（ヒートマップ）
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                HabitHeatmapContent(habits)
            }
        }
    }
}

// ─── 習慣ヒートマップ（内部コンテンツのみ） ──────────────────────────────────

@Composable
private fun HabitHeatmapContent(habits: List<HabitUiState>) {
    val today   = LocalDate.now()
    val days    = (59 downTo 0).map { today.minusDays(it.toLong()) }
    val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
    val cellSize = 12.dp
    val cellGap  = 2.dp
    val weekGap  = 4.dp
    val nameW    = 72.dp
    val rowGap   = 4.dp
    // 全行で横スクロールを共有 → 月ラベルと習慣行が連動してスクロール
    val scrollState = rememberScrollState()
    LaunchedEffect(scrollState.maxValue) {
        if (scrollState.maxValue > 0) scrollState.scrollTo(scrollState.maxValue)
    }

    Column(verticalArrangement = Arrangement.spacedBy(rowGap)) {
        // 月ラベル行（名前列幅分のオフセット）
        Row(verticalAlignment = Alignment.Bottom) {
            Spacer(Modifier.width(nameW + rowGap))
            Row(Modifier.horizontalScroll(scrollState)) {
                days.forEachIndexed { i, day ->
                    if (i > 0 && i % 7 == 0) Spacer(Modifier.width(weekGap))
                    Box(Modifier.width(cellSize + cellGap)) {
                        if (day.dayOfMonth == 1) {
                            Text(
                                "${day.monthValue}月",
                                fontSize = 9.sp,
                                softWrap = false,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.wrapContentWidth(
                                    align = androidx.compose.ui.Alignment.Start,
                                    unbounded = true
                                )
                            )
                        }
                    }
                }
            }
        }
        // 習慣ごとの行：名前テキストが自然な高さを決め、セルを中央揃え
        habits.forEach { state ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    state.habit.name,
                    modifier = Modifier.width(nameW),
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.width(rowGap))
                Row(Modifier.horizontalScroll(scrollState)) {
                    days.forEachIndexed { i, day ->
                        if (i > 0 && i % 7 == 0) Spacer(Modifier.width(weekGap))
                        val dayStr  = day.format(DateTimeFormatter.ISO_LOCAL_DATE)
                        val isDone  = dayStr == todayStr && state.completedToday
                        val isToday = dayStr == todayStr
                        Box(
                            Modifier
                                .size(cellSize)
                                .background(
                                    if (isDone) Color(0xFF22C55E) else Color(0xFFE2E8F0),
                                    MaterialTheme.shapes.extraSmall
                                )
                                .then(if (isToday) Modifier.border(
                                    1.dp, MaterialTheme.colorScheme.primary,
                                    MaterialTheme.shapes.extraSmall
                                ) else Modifier)
                        )
                        Spacer(Modifier.width(cellGap))
                    }
                }
            }
        }
    }
}

// ─── タスク追加フォーム ─────────────────────────────────────────────────────

// ─── タスクカード ───────────────────────────────────────────────────────────

@Composable
private fun dueDateBg(dueAt: String?): Color {
    val surface = MaterialTheme.colorScheme.surface
    val dark = isSystemInDarkTheme()
    if (dueAt == null) return surface
    return try {
        val due = LocalDate.parse(dueAt.take(10))
        val diff = ChronoUnit.DAYS.between(com.alcedo.personal.ui.util.TimeUtils.effectiveLocalDate(), due)
        when {
            diff < 0   -> if (dark) Color(0xFF1A1A1A) else Color(0xFFF5F5F5)
            diff == 0L -> if (dark) Color(0xFF3B1010) else Color(0xFFFFE0E0)
            diff <= 3  -> if (dark) Color(0xFF2E1A08) else Color(0xFFFFF3E0)
            diff <= 7  -> if (dark) Color(0xFF252209) else Color(0xFFFFFDE7)
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
