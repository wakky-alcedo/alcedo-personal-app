package com.alcedo.personal.ui.settings

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.sync.HabitEntity
import com.alcedo.personal.sync.HabitRepository
import com.alcedo.personal.sync.DbProvider
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class HabitsManagementViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = HabitRepository(app, DbProvider.get(app).habitDao())
    val habits: StateFlow<List<HabitEntity>> = repo.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init { viewModelScope.launch { repo.syncFromServer() } }

    fun create(name: String) { viewModelScope.launch { repo.create(name) } }
    fun toggleActive(habit: HabitEntity) {
        viewModelScope.launch { repo.update(habit.copy(isActive = !habit.isActive)) }
    }
    fun delete(habit: HabitEntity) { viewModelScope.launch { repo.delete(habit) } }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HabitsManagementScreen(onBack: () -> Unit, vm: HabitsManagementViewModel = viewModel()) {
    val habits by vm.habits.collectAsStateWithLifecycle()
    var showAdd by remember { mutableStateOf(false) }
    var newName  by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("習慣", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null) } }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) { Icon(Icons.Default.Add, null) }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (showAdd) {
                OutlinedTextField(
                    value = newName, onValueChange = { newName = it },
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    placeholder = { Text("習慣名を入力…") },
                    trailingIcon = {
                        Row {
                            TextButton(onClick = { showAdd = false; newName = "" }) { Text("キャンセル") }
                            TextButton(onClick = {
                                if (newName.isNotBlank()) { vm.create(newName); newName = ""; showAdd = false }
                            }, enabled = newName.isNotBlank()) { Text("追加") }
                        }
                    }
                )
            }
            LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(habits, key = { it.id }) { habit ->
                    HabitManagementRow(habit, onToggle = { vm.toggleActive(habit) }, onDelete = { vm.delete(habit) })
                }
                if (habits.isEmpty()) item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) {
                        Text("習慣がありません", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun HabitManagementRow(habit: HabitEntity, onToggle: () -> Unit, onDelete: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(habit.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                if (!habit.isActive) Text("非アクティブ", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Switch(checked = habit.isActive, onCheckedChange = { onToggle() })
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f))
            }
        }
    }
}
