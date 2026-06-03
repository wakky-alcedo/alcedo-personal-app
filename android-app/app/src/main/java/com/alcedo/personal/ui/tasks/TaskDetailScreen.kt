package com.alcedo.personal.ui.tasks

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.sync.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class TaskDetailViewModel(app: Application, saved: SavedStateHandle) : AndroidViewModel(app) {
    private val taskId = saved.get<String>("taskId") ?: ""
    private val dao = DbProvider.get(app).taskDao()

    private val _task = MutableStateFlow<TaskEntity?>(null)
    val task: StateFlow<TaskEntity?> = _task

    private val _subtasks = MutableStateFlow<List<SubtaskItem>>(emptyList())
    val subtasks: StateFlow<List<SubtaskItem>> = _subtasks

    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved

    init {
        viewModelScope.launch {
            val t = dao.findById(taskId)
            _task.value = t
            _subtasks.value = t?.subtasks.toSubtasks()
        }
    }

    fun save(title: String, description: String, priority: String, dueAt: String?) {
        val current = _task.value ?: return
        viewModelScope.launch {
            val updated = current.copy(
                title = title.trim(),
                description = description.trim().takeIf { it.isNotEmpty() },
                priority = priority,
                dueAt = dueAt?.takeIf { it.isNotEmpty() },
                subtasks = _subtasks.value.filter { it.title.isNotBlank() }.toJsonString(),
                syncStatus = SyncStatus.UNSENT,
                updatedAt = Instant.now().toString(),
                version = current.version + 1
            )
            dao.upsert(updated)
            TaskSyncScheduler.enqueue(getApplication())
            _task.value = updated
            _saved.value = true
        }
    }

    fun addSubtask() {
        _subtasks.value = _subtasks.value + SubtaskItem(title = "")
    }

    fun updateSubtask(index: Int, title: String) {
        _subtasks.value = _subtasks.value.toMutableList().also { it[index] = it[index].copy(title = title) }
    }

    fun toggleSubtask(index: Int) {
        _subtasks.value = _subtasks.value.toMutableList().also {
            it[index] = it[index].copy(done = !it[index].done)
        }
    }

    fun removeSubtask(index: Int) {
        _subtasks.value = _subtasks.value.toMutableList().also { it.removeAt(index) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailScreen(onBack: () -> Unit, vm: TaskDetailViewModel = viewModel()) {
    val task     by vm.task.collectAsStateWithLifecycle()
    val subtasks by vm.subtasks.collectAsStateWithLifecycle()
    val savedOk  by vm.saved.collectAsStateWithLifecycle()

    var title    by remember(task) { mutableStateOf(task?.title ?: "") }
    var desc     by remember(task) { mutableStateOf(task?.description?.takeIf { it != "null" } ?: "") }
    var priority by remember(task) { mutableStateOf(task?.priority ?: "medium") }
    var dueAt by remember(task) {
        mutableStateOf(
            task?.dueAt?.takeIf { it != "null" }
                ?.let { com.alcedo.personal.ui.util.TimeUtils.run { it.toLocalDateStr() } } ?: ""
        )
    }

    LaunchedEffect(savedOk) { if (savedOk) onBack() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("タスク詳細", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null) } },
                actions = {
                    TextButton(onClick = { vm.save(title, desc, priority, dueAt.takeIf { it.isNotEmpty() }?.let { "${it}T00:00:00.000Z" }) }) {
                        Text("保存")
                    }
                }
            )
        }
    ) { padding ->
        if (task == null) {
            Box(Modifier.fillMaxSize().padding(padding), Alignment.Center) { CircularProgressIndicator() }
            return@Scaffold
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(vertical = 12.dp)
        ) {
            item {
                OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(),
                    label = { Text("タイトル") }, singleLine = true)
            }
            item {
                OutlinedTextField(desc, { desc = it }, Modifier.fillMaxWidth(),
                    label = { Text("詳細") }, minLines = 2, maxLines = 5)
            }
            item {
                Text("優先度", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("low" to "Low", "medium" to "Med", "high" to "High").forEach { (v, label) ->
                        FilterChip(selected = priority == v, onClick = { priority = v }, label = { Text(label) })
                    }
                }
            }
            item {
                DueDateField(dueAt) { dueAt = it }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically) {
                    Text("サブタスク", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    IconButton(onClick = { vm.addSubtask() }) { Icon(Icons.Default.Add, null) }
                }
            }
            itemsIndexed(subtasks) { i, sub ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = sub.done, onCheckedChange = { vm.toggleSubtask(i) })
                    OutlinedTextField(
                        sub.title, { vm.updateSubtask(i, it) },
                        Modifier.weight(1f), singleLine = true,
                        placeholder = { Text("サブタスク") }
                    )
                    IconButton(onClick = { vm.removeSubtask(i) }) {
                        Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error.copy(alpha = 0.6f),
                            modifier = Modifier.size(18.dp))
                    }
                }
            }
            item { Spacer(Modifier.height(32.dp)) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DueDateField(dueAt: String, onChange: (String) -> Unit) {
    var showPicker by remember { mutableStateOf(false) }

    val initialMillis = remember(dueAt) {
        if (dueAt.isNotEmpty()) {
            try {
                LocalDate.parse(dueAt).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
            } catch (e: Exception) { null }
        } else null
    }
    val pickerState = rememberDatePickerState(initialSelectedDateMillis = initialMillis)

    Box(Modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = if (dueAt.isEmpty()) "未設定" else dueAt,
            onValueChange = {},
            modifier = Modifier.fillMaxWidth(),
            label = { Text("期限") },
            readOnly = true,
            trailingIcon = {
                if (dueAt.isNotEmpty()) {
                    IconButton(onClick = { onChange("") }) {
                        Icon(Icons.Default.Close, "クリア", Modifier.size(18.dp))
                    }
                }
            }
        )
        // TextField上に透明なクリック領域を重ねてカレンダーを開く
        Box(Modifier.matchParentSize().clickable { showPicker = true })
    }

    if (showPicker) {
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let { millis ->
                        val date = Instant.ofEpochMilli(millis)
                            .atZone(ZoneOffset.UTC)
                            .toLocalDate()
                            .format(DateTimeFormatter.ISO_LOCAL_DATE)
                        onChange(date)
                    }
                    showPicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showPicker = false }) { Text("キャンセル") }
            }
        ) {
            DatePicker(state = pickerState)
        }
    }
}
