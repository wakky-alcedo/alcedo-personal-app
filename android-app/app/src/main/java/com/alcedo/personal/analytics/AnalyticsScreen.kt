package com.alcedo.personal.analytics

import android.app.AppOpsManager
import android.app.Application
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.sync.DbProvider
import com.alcedo.personal.sync.SyncConfig
import com.alcedo.personal.ui.util.TimeUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.ZoneId

// ─── データクラス ──────────────────────────────────────────────────────────────

data class CategoryDuration(val category: String, val durationSec: Long)
data class AppUsage(val appName: String, val packageName: String, val totalSec: Long, val category: String = "未分類")

// ─── ViewModel ────────────────────────────────────────────────────────────────

class AnalyticsViewModel(app: Application) : AndroidViewModel(app) {
    private val _date    = MutableStateFlow(TimeUtils.effectiveLocalDateStr())
    private val _tab     = MutableStateFlow(0)  // 0=タイムライン, 1=活動, 2=習慣
    private val _loading = MutableStateFlow(false)
    private val _syncing = MutableStateFlow(false)
    private val _hasUsagePerm = MutableStateFlow(false)

    // 活動タブ
    private val _activityDevice   = MutableStateFlow("all")
    private val _availableDevices = MutableStateFlow<List<String>>(emptyList())
    private val _activitySummary  = MutableStateFlow<List<CategoryDuration>>(emptyList())
    private val _topApps          = MutableStateFlow<List<AppUsage>>(emptyList())

    // タイムラインタブ
    private val _timelineSegments = MutableStateFlow<List<TimelineSegment>>(emptyList())

    // 習慣タブ
    private val _habitStats = MutableStateFlow<List<Pair<String, Float>>>(emptyList())

    val date:             StateFlow<String>                   = _date
    val tab:              StateFlow<Int>                      = _tab
    val loading:          StateFlow<Boolean>                  = _loading
    val syncing:          StateFlow<Boolean>                  = _syncing
    val hasUsagePerm:     StateFlow<Boolean>                  = _hasUsagePerm
    val activityDevice:   StateFlow<String>                   = _activityDevice
    val availableDevices: StateFlow<List<String>>             = _availableDevices
    val activitySummary:  StateFlow<List<CategoryDuration>>   = _activitySummary
    val topApps:          StateFlow<List<AppUsage>>           = _topApps
    val timelineSegments: StateFlow<List<TimelineSegment>>    = _timelineSegments
    val habitStats:       StateFlow<List<Pair<String, Float>>> = _habitStats

    init { refresh() }

    fun setTab(t: Int) { _tab.value = t }
    fun setActivityDevice(d: String) {
        _activityDevice.value = d
        viewModelScope.launch { loadActivitySummary() }
    }

    fun previousDay() { adjustDate(-1) }
    fun nextDay()     { adjustDate(1) }
    fun today()       { _date.value = TimeUtils.effectiveLocalDateStr(); refresh() }

    private fun adjustDate(days: Long) {
        _date.value = java.time.LocalDate.parse(_date.value).plusDays(days)
            .format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _loading.value = true
            _hasUsagePerm.value = hasUsagePermission(getApplication())
            loadAvailableDevices()
            loadActivitySummary()
            loadTimeline()
            loadHabitStats()
            _loading.value = false
        }
    }

    fun syncNow() {
        viewModelScope.launch {
            _syncing.value = true
            try { UsageStatsSyncWorker.runNow(getApplication()) }
            finally { _syncing.value = false }
        }
    }

    // ─── 活動タブ ──────────────────────────────────────────────────────────────

    private suspend fun loadAvailableDevices() = withContext(Dispatchers.IO) {
        val url  = SyncConfig.getServerUrl(getApplication())
        val key  = SyncConfig.getApiKey(getApplication())
        val date = _date.value
        val conn = runCatching {
            (URL("$url/api/v1/activity/devices?date=${URLEncoder.encode(date, "UTF-8")}").openConnection() as HttpURLConnection).apply {
                setRequestProperty("X-Api-Key", key); connectTimeout = 5000; readTimeout = 5000
            }
        }.getOrNull() ?: return@withContext
        if (conn.responseCode !in 200..299) { conn.disconnect(); return@withContext }
        val json = conn.inputStream.bufferedReader().readText(); conn.disconnect()
        val arr = JSONArray(json)
        _availableDevices.value = (0 until arr.length()).map { arr.getJSONObject(it).getString("deviceId") }
    }

    private suspend fun loadActivitySummary() = withContext(Dispatchers.IO) {
        val url    = SyncConfig.getServerUrl(getApplication())
        val key    = SyncConfig.getApiKey(getApplication())
        val date   = _date.value
        val device = _activityDevice.value
        val params = buildString {
            append("date=${URLEncoder.encode(date, "UTF-8")}")
            if (device != "all") append("&deviceId=${URLEncoder.encode(device, "UTF-8")}")
        }
        val conn = runCatching {
            (URL("$url/api/v1/activity/summary?$params").openConnection() as HttpURLConnection).apply {
                setRequestProperty("X-Api-Key", key); connectTimeout = 5000; readTimeout = 5000
            }
        }.getOrNull() ?: return@withContext
        if (conn.responseCode !in 200..299) { conn.disconnect(); return@withContext }
        val json = conn.inputStream.bufferedReader().readText(); conn.disconnect()
        val arr = JSONArray(json)
        _activitySummary.value = (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            CategoryDuration(obj.getString("category"), obj.getLong("durationSec"))
        }.sortedByDescending { it.durationSec }

        // 上位アプリ：このAndroid端末が明示的に選択された場合のみ（「すべて」は非表示）
        val myDevice = "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}"
        if (device == myDevice && hasUsagePermission(getApplication())) {
            loadTopApps()
        } else {
            _topApps.value = emptyList()
        }
    }

    private suspend fun loadTopApps() = withContext(Dispatchers.IO) {
        val app = getApplication<Application>()
        val date = java.time.LocalDate.parse(_date.value)
        val zoneId = ZoneId.systemDefault()
        val startMs = java.time.LocalDateTime.parse("${date}T06:00:00").atZone(zoneId).toInstant().toEpochMilli()
        val endMs   = startMs + 86400_000L

        val usm = app.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val pm  = app.packageManager
        val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startMs, endMs)
            .filter { it.totalTimeInForeground > 0 }

        _topApps.value = stats.mapNotNull { us ->
            val (name, osCat) = try {
                val info = pm.getApplicationInfo(us.packageName, android.content.pm.PackageManager.GET_META_DATA)
                pm.getApplicationLabel(info).toString() to info.category
            } catch (e: Exception) { us.packageName to android.content.pm.ApplicationInfo.CATEGORY_UNDEFINED }
            val sec = us.totalTimeInForeground / 1000
            if (sec < 5) null else AppUsage(name, us.packageName, sec, CategoryMapper.fromOsCategory(osCat))
        }.sortedByDescending { it.totalSec }.take(10)
    }

    // ─── タイムラインタブ ────────────────────────────────────────────────────────

    private suspend fun loadTimeline() = withContext(Dispatchers.IO) {
        val url  = SyncConfig.getServerUrl(getApplication())
        val key  = SyncConfig.getApiKey(getApplication())
        val date = _date.value
        val conn = runCatching {
            (URL("$url/api/v1/activity/logs?date=${URLEncoder.encode(date, "UTF-8")}").openConnection() as HttpURLConnection).apply {
                setRequestProperty("X-Api-Key", key); connectTimeout = 5000; readTimeout = 10000
            }
        }.getOrNull() ?: return@withContext
        if (conn.responseCode !in 200..299) { conn.disconnect(); return@withContext }
        val json = conn.inputStream.bufferedReader().readText(); conn.disconnect()
        val arr  = JSONArray(json)
        val sessions = (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            ActivitySession(
                startedAt   = obj.getString("startedAt"),
                endedAt     = if (obj.isNull("endedAt")) null else obj.optString("endedAt").takeIf { it.isNotEmpty() },
                category    = obj.getString("category"),
                processName = obj.optString("processName", ""),
                windowTitle = obj.optString("windowTitle", ""),
                deviceId    = obj.optString("deviceId", "")
            )
        }
        _timelineSegments.value = buildTimelineSegments(sessions, dayStartMs(date))
    }

    // ─── 習慣タブ ────────────────────────────────────────────────────────────────

    private suspend fun loadHabitStats() = withContext(Dispatchers.IO) {
        val db   = DbProvider.get(getApplication())
        val from = TimeUtils.effectiveDaysAgo(29)
        val habits = db.habitDao().observeActiveHabits().first()
        _habitStats.value = habits.map { habit ->
            val logs = db.habitDao().getRecentLogs(habit.id, from)
            habit.name to (logs.size / 30f).coerceAtMost(1f)
        }.sortedByDescending { it.second }
    }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(vm: AnalyticsViewModel = viewModel()) {
    val date             by vm.date.collectAsStateWithLifecycle()
    val tab              by vm.tab.collectAsStateWithLifecycle()
    val loading          by vm.loading.collectAsStateWithLifecycle()
    val syncing          by vm.syncing.collectAsStateWithLifecycle()
    val hasUsagePerm     by vm.hasUsagePerm.collectAsStateWithLifecycle()
    val activityDevice   by vm.activityDevice.collectAsStateWithLifecycle()
    val availableDevices by vm.availableDevices.collectAsStateWithLifecycle()
    val activitySummary  by vm.activitySummary.collectAsStateWithLifecycle()
    val topApps          by vm.topApps.collectAsStateWithLifecycle()
    val timelineSegments by vm.timelineSegments.collectAsStateWithLifecycle()
    val habitStats       by vm.habitStats.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // カテゴリカラー（ローカル定義）
    val colorFor: (String) -> Color = { cat ->
        when (cat) {
            "開発" -> Color(0xFF4757FF); "ブラウザ" -> Color(0xFF6366F1)
            "コミュニケーション" -> Color(0xFF10B981); "学習" -> Color(0xFF0EA5E9)
            "SNS" -> Color(0xFFEF4444); "娯楽" -> Color(0xFFF59E0B)
            "ゲーム" -> Color(0xFFF97316); "音楽" -> Color(0xFFA855F7)
            "動画" -> Color(0xFFEC4899); "写真" -> Color(0xFF14B8A6)
            "ニュース" -> Color(0xFF64748B); "地図" -> Color(0xFF22C55E)
            "仕事" -> Color(0xFF3B82F6); "ユーティリティ" -> Color(0xFF8B5CF6)
            "睡眠" -> Color(0xFF93C5FD)
            else -> Color(0xFF94A3B8)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("分析", fontWeight = FontWeight.Bold) },
                actions = {
                    TextButton(onClick = { vm.today() }) { Text("今日") }
                    if (syncing) CircularProgressIndicator(Modifier.size(20.dp).padding(2.dp), strokeWidth = 2.dp)
                    else TextButton(onClick = { vm.syncNow() }, enabled = hasUsagePerm) { Text("同期") }
                    if (loading) CircularProgressIndicator(Modifier.size(20.dp).padding(2.dp), strokeWidth = 2.dp)
                }
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            // 日付ナビ
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                Arrangement.SpaceBetween, Alignment.CenterVertically) {
                IconButton(onClick = { vm.previousDay() }) { Text("‹", fontSize = 24.sp) }
                Text(date, style = MaterialTheme.typography.titleMedium)
                IconButton(onClick = { vm.nextDay() }) { Text("›", fontSize = 24.sp) }
            }
            // タブ（0=タイムライン, 1=活動, 2=習慣）
            TabRow(selectedTabIndex = tab) {
                Tab(selected = tab == 0, onClick = { vm.setTab(0) }, text = { Text("タイムライン") })
                Tab(selected = tab == 1, onClick = { vm.setTab(1) }, text = { Text("活動") })
                Tab(selected = tab == 2, onClick = { vm.setTab(2) }, text = { Text("習慣") })
            }
            // コンテンツ
            when (tab) {
                0 -> TimelineTab(timelineSegments, colorFor, dayStartMs(date))
                1 -> ActivityTab(activityDevice, availableDevices, activitySummary, topApps,
                    hasUsagePerm, colorFor, context, vm)
                2 -> HabitsTab(habitStats)
            }
        }
    }
}

// ─── 活動タブ ──────────────────────────────────────────────────────────────────

@Composable
private fun ActivityTab(
    selectedDevice: String,
    devices: List<String>,
    summary: List<CategoryDuration>,
    topApps: List<AppUsage>,
    hasUsagePerm: Boolean,
    colorFor: (String) -> Color,
    context: Context,
    vm: AnalyticsViewModel
) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // デバイス切り替え
        if (devices.isNotEmpty()) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState())) {
                    DeviceChip("すべて", selectedDevice == "all") { vm.setActivityDevice("all") }
                    devices.forEach { d ->
                        DeviceChip(d.take(14), selectedDevice == d) { vm.setActivityDevice(d) }
                    }
                }
            }
        }
        // 使用許可チェック
        if (!hasUsagePerm) {
            item {
                OutlinedButton(onClick = { context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) },
                    modifier = Modifier.fillMaxWidth()) {
                    Text("スマホ使用時間の許可が必要です（タップして設定へ）", fontSize = 12.sp)
                }
            }
        }
        // カテゴリ別サマリー
        if (summary.isNotEmpty()) {
            item { SummaryCard("カテゴリ別時間", summary, colorFor) }
        } else {
            item { EmptyCard("データがありません\n同期ボタンを押してください") }
        }
        // 上位アプリ（スマホデバイス選択時）
        if (topApps.isNotEmpty()) {
            item { Text("上位アプリ", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold) }
            items(topApps) { app ->
                AppUsageRow(app, topApps.first().totalSec)
            }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun DeviceChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(selected = selected, onClick = onClick,
        label = { Text(label, fontSize = 12.sp) })
}

// ─── タイムラインタブ ─────────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TimelineTab(segments: List<TimelineSegment>, colorFor: (String) -> Color, dayStartMs: Long) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (segments.isEmpty()) {
            EmptyCard("データがありません\n同期ボタンを押してください")
        } else {
            VerticalDayTimeline(segments, colorFor, dayStartMs)
            Spacer(Modifier.height(8.dp))
            // 凡例
            val cats = segments.map { it.category }.distinct()
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("凡例", style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        cats.forEach { cat ->
                            Row(verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                Box(Modifier.size(12.dp).background(colorFor(cat), RoundedCornerShape(3.dp)))
                                Text(cat, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
                            }
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}

// ─── 習慣タブ ────────────────────────────────────────────────────────────────

@Composable
private fun HabitsTab(habitStats: List<Pair<String, Float>>) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (habitStats.isEmpty()) {
            item { EmptyCard("習慣データがありません") }
        } else {
            item { Text("過去30日間の達成率", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold) }
            items(habitStats) { (name, rate) -> HabitCompletionRow(name, rate) }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

// ─── 共通コンポーネント ──────────────────────────────────────────────────────

@Composable
private fun SummaryCard(title: String, data: List<CategoryDuration>, colorFor: (String) -> Color) {
    val total = data.sumOf { it.durationSec }.coerceAtLeast(1L)
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text(title, style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                Text("合計 ${formatDuration(total)}", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            data.forEach { (cat, sec) ->
                val fraction = sec.toFloat() / total
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Text(cat, fontSize = 12.sp)
                        Text(formatDuration(sec), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)) {
                        Box(Modifier.fillMaxWidth(fraction).height(6.dp)
                            .clip(RoundedCornerShape(3.dp)).background(colorFor(cat)))
                    }
                }
            }
        }
    }
}

@Composable
private fun AppUsageRow(app: AppUsage, maxSec: Long) {
    val fraction = (app.totalSec.toFloat() / maxSec).coerceIn(0f, 1f)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(app.appName, fontSize = 12.sp, maxLines = 1)
            Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)) {
                Box(Modifier.fillMaxWidth(fraction).height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)))
            }
        }
        Text(formatDuration(app.totalSec), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun HabitCompletionRow(name: String, rate: Float) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
            Text(name, fontSize = 13.sp)
            Text("${(rate * 100).toInt()}%", fontSize = 13.sp, fontWeight = FontWeight.Medium,
                color = if (rate >= 0.8f) Color(0xFF22C55E) else MaterialTheme.colorScheme.onSurface)
        }
        Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)) {
            Box(Modifier.fillMaxWidth(rate).height(6.dp).clip(RoundedCornerShape(3.dp))
                .background(Color(0xFF22C55E)))
        }
    }
}

@Composable
private fun EmptyCard(message: String) {
    Card(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) {
            Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
    }
}

private fun formatDuration(sec: Long): String {
    val h = sec / 3600; val m = (sec % 3600) / 60
    return when { h > 0 && m > 0 -> "${h}h${m}m"; h > 0 -> "${h}h"; else -> "${m}m" }
}
