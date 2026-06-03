package com.alcedo.personal.ui.settings

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.alcedo.personal.sync.SyncConfig
import com.alcedo.personal.sync.TaskSyncScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

// ─── ViewModel ───────────────────────────────────────────────────────────────

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

// ─── Screen ──────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: SettingsViewModel = viewModel()) {
    val serverUrl by vm.serverUrl.collectAsStateWithLifecycle()
    val apiKey    by vm.apiKey.collectAsStateWithLifecycle()
    val saved     by vm.saved.collectAsStateWithLifecycle()
    var showKey   by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("設定", fontWeight = FontWeight.Bold) }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("サーバー接続", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)

            OutlinedTextField(
                value = serverUrl,
                onValueChange = { vm.setServerUrl(it) },
                label = { Text("Server URL") },
                placeholder = { Text("http://192.168.1.x:8787") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = apiKey,
                onValueChange = { vm.setApiKey(it) },
                label = { Text("API Key") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    TextButton(onClick = { showKey = !showKey }) {
                        Text(if (showKey) "隠す" else "表示")
                    }
                }
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = { vm.save() }, modifier = Modifier.weight(1f)) {
                    Text("保存")
                }
                OutlinedButton(onClick = { vm.syncNow() }, modifier = Modifier.weight(1f)) {
                    Text("今すぐ同期")
                }
            }

            if (saved) {
                Text(
                    "保存しました",
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
