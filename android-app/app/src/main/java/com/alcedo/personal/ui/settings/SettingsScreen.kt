package com.alcedo.personal.ui.settings

import android.Manifest
import android.app.Application
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.notifications.NotificationPrefs
import com.alcedo.personal.notifications.TaskAlarmScheduler
import com.alcedo.personal.notifications.TaskNotificationScheduler
import com.alcedo.personal.sync.SyncConfig
import com.alcedo.personal.sync.TaskSyncScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SettingsViewModel(app: Application) : AndroidViewModel(app) {
    private val _serverUrl = MutableStateFlow(SyncConfig.getServerUrl(app))
    val serverUrl: StateFlow<String> = _serverUrl

    private val _apiKey = MutableStateFlow(SyncConfig.getApiKey(app))
    val apiKey: StateFlow<String> = _apiKey

    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved

    val notificationsEnabled: StateFlow<Boolean> = NotificationPrefs.notificationsEnabled(app)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)
    val alarmEnabled: StateFlow<Boolean> = NotificationPrefs.alarmEnabled(app)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)
    val reminderMinutes: StateFlow<Int> = NotificationPrefs.reminderMinutes(app)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), NotificationPrefs.DEFAULT_REMINDER_MINUTES)

    fun setServerUrl(v: String) { _serverUrl.value = v; _saved.value = false }
    fun setApiKey(v: String)    { _apiKey.value = v;    _saved.value = false }

    fun save() {
        viewModelScope.launch {
            SyncConfig.save(getApplication(), _serverUrl.value.trim(), _apiKey.value.trim())
            _saved.value = true
        }
    }

    fun syncNow() { TaskSyncScheduler.enqueue(getApplication()) }

    fun setNotificationsEnabled(value: Boolean) {
        viewModelScope.launch {
            NotificationPrefs.setNotificationsEnabled(getApplication(), value)
            if (value) TaskNotificationScheduler.runOnce(getApplication())
        }
    }

    fun setAlarmEnabled(value: Boolean) {
        viewModelScope.launch { NotificationPrefs.setAlarmEnabled(getApplication(), value) }
    }

    fun setReminderMinutes(value: Int) {
        viewModelScope.launch {
            NotificationPrefs.setReminderMinutes(getApplication(), value)
            TaskNotificationScheduler.runOnce(getApplication())
        }
    }
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

    val notificationsEnabled by vm.notificationsEnabled.collectAsStateWithLifecycle()
    val alarmEnabled         by vm.alarmEnabled.collectAsStateWithLifecycle()
    val reminderMinutes      by vm.reminderMinutes.collectAsStateWithLifecycle()

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

            // ─── タスク期限通知 ───────────────────────────────────────────────
            NotificationSettingsSection(
                enabled = notificationsEnabled,
                onEnabledChange = vm::setNotificationsEnabled,
                alarmEnabled = alarmEnabled,
                onAlarmEnabledChange = vm::setAlarmEnabled,
                reminderMinutes = reminderMinutes,
                onReminderMinutesChange = vm::setReminderMinutes,
            )

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

@Composable
private fun NotificationSettingsSection(
    enabled: Boolean,
    onEnabledChange: (Boolean) -> Unit,
    alarmEnabled: Boolean,
    onAlarmEnabledChange: (Boolean) -> Unit,
    reminderMinutes: Int,
    onReminderMinutesChange: (Int) -> Unit,
) {
    val context = LocalContext.current
    var permissionGranted by remember {
        mutableStateOf(
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> permissionGranted = granted }

    var exactAlarmGranted by remember { mutableStateOf(TaskAlarmScheduler.canScheduleExactAlarms(context)) }
    var fullScreenIntentGranted by remember { mutableStateOf(canUseFullScreenIntent(context)) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                exactAlarmGranted = TaskAlarmScheduler.canScheduleExactAlarms(context)
                fullScreenIntentGranted = canUseFullScreenIntent(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    var reminderText by remember(reminderMinutes) { mutableStateOf(reminderMinutes.toString()) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("タスク期限通知", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)

        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
            Text("通知を有効化", style = MaterialTheme.typography.bodyMedium)
            Switch(checked = enabled, onCheckedChange = onEnabledChange)
        }

        OutlinedTextField(
            value = reminderText,
            onValueChange = { text ->
                reminderText = text
                val n = text.toIntOrNull()
                if (n != null && n > 0) onReminderMinutesChange(n)
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("何分前に通知") },
            supportingText = { Text("${NotificationPrefs.MIN_REMINDER_MINUTES}分以上を指定してください(期限チェックは15分間隔のため)") },
            enabled = enabled,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
        )

        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
            Text("アラーム音を鳴らす", style = MaterialTheme.typography.bodyMedium)
            Switch(checked = alarmEnabled, onCheckedChange = onAlarmEnabledChange, enabled = enabled)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && enabled && !permissionGranted) {
            Text(
                "通知を表示するには許可が必要です。",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
            OutlinedButton(onClick = { permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }) {
                Text("通知を許可する")
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && enabled && !exactAlarmGranted) {
            Text(
                "誤差1分程度で通知するには「アラームとリマインダー」の許可が必要です。",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
            OutlinedButton(onClick = {
                context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM))
            }) {
                Text("アラームを許可する")
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && enabled && alarmEnabled && !fullScreenIntentGranted) {
            Text(
                "アラーム画面をロック画面上に表示するには許可が必要です。許可がない場合も通知から停止できます。",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
            OutlinedButton(onClick = {
                context.startActivity(
                    Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                        data = Uri.parse("package:${context.packageName}")
                    }
                )
            }) {
                Text("全画面表示を許可する")
            }
        }
    }
}

/** Android 14+ で全画面アラーム画面の表示が許可されているか(13以下は宣言のみで自動許可) */
private fun canUseFullScreenIntent(context: android.content.Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
    val manager = context.getSystemService(NotificationManager::class.java)
    return manager.canUseFullScreenIntent()
}
