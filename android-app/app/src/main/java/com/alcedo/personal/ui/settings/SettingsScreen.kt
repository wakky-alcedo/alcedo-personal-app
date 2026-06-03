package com.alcedo.personal.ui.settings

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.sync.SyncConfig
import com.alcedo.personal.sync.TaskSyncScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class SettingsViewModel(app: Application) : AndroidViewModel(app) {
    private val _serverUrl = MutableStateFlow(SyncConfig.getServerUrl(app))
    val serverUrl: StateFlow<String> = _serverUrl

    private val _apiKey = MutableStateFlow(SyncConfig.getApiKey(app))
    val apiKey: StateFlow<String> = _apiKey

    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved

    fun setServerUrl(v: String) { _serverUrl.value = v; _saved.value = false }
    fun setApiKey(v: String)    { _apiKey.value = v;    _saved.value = false }

    fun save() {
        viewModelScope.launch {
            SyncConfig.save(getApplication(), _serverUrl.value.trim(), _apiKey.value.trim())
            _saved.value = true
        }
    }

    fun syncNow() { TaskSyncScheduler.enqueue(getApplication()) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateToBeliefs: () -> Unit = {},
    onNavigateToHabits: () -> Unit = {},
    vm: SettingsViewModel = viewModel()
) {
    val serverUrl by vm.serverUrl.collectAsStateWithLifecycle()
    val apiKey    by vm.apiKey.collectAsStateWithLifecycle()
    val saved     by vm.saved.collectAsStateWithLifecycle()
    var showKey   by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("設定", fontWeight = FontWeight.Bold) }) }
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // ─── サーバー接続 ─────────────────────────────────────────────────
            Text("サーバー接続", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)

            OutlinedTextField(serverUrl, { vm.setServerUrl(it) }, Modifier.fillMaxWidth(),
                label = { Text("Server URL") }, placeholder = { Text("http://192.168.1.x:8787") }, singleLine = true)

            OutlinedTextField(apiKey, { vm.setApiKey(it) }, Modifier.fillMaxWidth(),
                label = { Text("API Key") }, singleLine = true,
                visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = { TextButton({ showKey = !showKey }) { Text(if (showKey) "隠す" else "表示") } })

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button({ vm.save() }, Modifier.weight(1f)) { Text("保存") }
                OutlinedButton({ vm.syncNow() }, Modifier.weight(1f)) { Text("今すぐ同期") }
            }

            if (saved) Text("保存しました", color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.bodySmall)

            HorizontalDivider()

            // ─── データ管理 ────────────────────────────────────────────────────
            Text("データ管理", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)

            NavRow("信念の管理", onNavigateToBeliefs)
            NavRow("習慣の管理", onNavigateToHabits)
        }
    }
}

@Composable
private fun NavRow(label: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            Arrangement.SpaceBetween, Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.bodyMedium)
            Icon(Icons.Default.ArrowForward, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
