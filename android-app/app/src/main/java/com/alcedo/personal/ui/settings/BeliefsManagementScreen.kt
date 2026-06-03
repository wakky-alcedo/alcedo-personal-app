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
import com.alcedo.personal.sync.BeliefEntity
import com.alcedo.personal.sync.BeliefRepository
import com.alcedo.personal.sync.DbProvider
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class BeliefsViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = BeliefRepository(app, DbProvider.get(app).beliefDao())
    val beliefs: StateFlow<List<BeliefEntity>> = repo.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init { viewModelScope.launch { repo.syncFromServer() } }

    fun create(text: String) { viewModelScope.launch { repo.create(text) } }
    fun toggleActive(belief: BeliefEntity) {
        viewModelScope.launch { repo.update(belief.copy(isActive = !belief.isActive)) }
    }
    fun delete(belief: BeliefEntity) { viewModelScope.launch { repo.delete(belief) } }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BeliefsManagementScreen(onBack: () -> Unit, vm: BeliefsViewModel = viewModel()) {
    val beliefs by vm.beliefs.collectAsStateWithLifecycle()
    var showAdd by remember { mutableStateOf(false) }
    var newText  by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("信念", fontWeight = FontWeight.Bold) },
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
                    value = newText, onValueChange = { newText = it },
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    placeholder = { Text("新しい信念を入力…") },
                    trailingIcon = {
                        Row {
                            TextButton(onClick = { showAdd = false; newText = "" }) { Text("キャンセル") }
                            TextButton(onClick = {
                                if (newText.isNotBlank()) { vm.create(newText); newText = ""; showAdd = false }
                            }, enabled = newText.isNotBlank()) { Text("追加") }
                        }
                    }
                )
            }
            LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(beliefs, key = { it.id }) { belief ->
                    BeliefRow(belief, onToggle = { vm.toggleActive(belief) }, onDelete = { vm.delete(belief) })
                }
                if (beliefs.isEmpty()) item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) {
                        Text("信念がありません", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun BeliefRow(belief: BeliefEntity, onToggle: () -> Unit, onDelete: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(belief.text, style = MaterialTheme.typography.bodyMedium)
            }
            Switch(checked = belief.isActive, onCheckedChange = { onToggle() })
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f))
            }
        }
    }
}
