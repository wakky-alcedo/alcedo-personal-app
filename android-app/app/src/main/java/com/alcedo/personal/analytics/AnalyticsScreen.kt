package com.alcedo.personal.analytics

import android.app.AppOpsManager
import android.app.Application
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// ─── データクラス ──────────────────────────────────────────────────────────────

data class CategoryDuration(val category: String, val durationSec: Long)
data class AppUsage(val appName: String, val packageName: String, val totalSec: Long)

// ─── アプリ → カテゴリ マッピング ──────────────────────────────────────────────

private val PACKAGE_CATEGORIES = mapOf(
    "com.twitter.android" to "SNS", "com.twitter.android.lite" to "SNS",
    "com.instagram.android" to "SNS", "com.facebook.katana" to "SNS",
    "com.zhiliaoapp.musically" to "SNS", "com.snapchat.android" to "SNS",
    "jp.naver.line.android" to "コミュニケーション",
    "org.telegram.messenger" to "コミュニケーション",
    "com.discord" to "コミュニケーション", "com.slack" to "コミュニケーション",
    "com.google.android.gm" to "コミュニケーション",
    "com.google.android.youtube" to "娯楽",
    "com.netflix.mediaclient" to "娯楽",
    "com.amazon.avod.thirdpartyclient" to "娯楽",
    "com.google.android.apps.chrome" to "ブラウザ",
    "org.mozilla.firefox" to "ブラウザ",
    "com.microsoft.edge" to "ブラウザ",
    "com.android.chrome" to "ブラウザ",
    "com.anki.flashcards" to "学習", "org.khanacademy.android" to "学習",
)

private fun packageToCategory(pkg: String): String =
    PACKAGE_CATEGORIES[pkg] ?: when {
        pkg.contains("mail", true) || pkg.contains("gmail") -> "コミュニケーション"
        pkg.contains("browser", true) || pkg.contains("chrome") -> "ブラウザ"
        pkg.contains("youtube") || pkg.contains("video") || pkg.contains("music") -> "娯楽"
        else -> "その他"
    }

// ─── ViewModel ────────────────────────────────────────────────────────────────

class AnalyticsViewModel(app: Application) : AndroidViewModel(app) {
    private val _date = MutableStateFlow(LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE))
    val date: StateFlow<String> = _date

    private val _tab = MutableStateFlow(0)
    val tab: StateFlow<Int> = _tab

    private val _phoneUsage    = MutableStateFlow<List<CategoryDuration>>(emptyList())
    private val _topApps       = MutableStateFlow<List<AppUsage>>(emptyList())
    private val _pcActivity    = MutableStateFlow<List<CategoryDuration>>(emptyList())
    private val _habitStats    = MutableStateFlow<List<Pair<String, Float>>>(emptyList())  // name → completionRate
    private val _loading       = MutableStateFlow(false)
    private val _hasUsagePerm  = MutableStateFlow(false)

    val phoneUsage:   StateFlow<List<CategoryDuration>> = _phoneUsage
    val topApps:      StateFlow<List<AppUsage>>         = _topApps
    val pcActivity:   StateFlow<List<CategoryDuration>> = _pcActivity
    val habitStats:   StateFlow<List<Pair<String, Float>>> = _habitStats
    val loading:      StateFlow<Boolean>                = _loading
    val hasUsagePerm: StateFlow<Boolean>                = _hasUsagePerm

    init { refresh() }

    fun setTab(t: Int) { _tab.value = t }

    fun previousDay() { adjustDate(-1) }
    fun nextDay()     { adjustDate(1) }
    fun today()       { _date.value = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE); refresh() }

    private fun adjustDate(days: Long) {
        _date.value = LocalDate.parse(_date.value).plusDays(days).format(DateTimeFormatter.ISO_LOCAL_DATE)
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _loading.value = true
            _hasUsagePerm.value = hasUsagePermission(getApplication())
            if (_hasUsagePerm.value) loadPhoneUsage()
            loadPcActivity()
            loadHabitStats()
            _loading.value = false
        }
    }

    private suspend fun loadPhoneUsage() = withContext(Dispatchers.IO) {
        val app: Application = getApplication()
        val date = LocalDate.parse(_date.value)
        val zoneId = ZoneId.systemDefault()
        val startMs = date.atStartOfDay(zoneId).toInstant().toEpochMilli()
        val endMs   = date.plusDays(1).atStartOfDay(zoneId).toInstant().toEpochMilli()

        val usm = app.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startMs, endMs)
            .filter { it.totalTimeInForeground > 0 }

        // アプリ名取得
        val pm = app.packageManager
        val appList = stats.mapNotNull { us ->
            val name = try { pm.getApplicationLabel(pm.getApplicationInfo(us.packageName, 0)).toString() }
                       catch (e: Exception) { us.packageName }
            val sec = us.totalTimeInForeground / 1000
            if (sec < 5) null else AppUsage(name, us.packageName, sec)
        }.sortedByDescending { it.totalSec }

        _topApps.value = appList.take(10)

        // カテゴリ別に集計
        val catMap = mutableMapOf<String, Long>()
        appList.forEach { a ->
            val cat = packageToCategory(a.packageName)
            catMap[cat] = (catMap[cat] ?: 0L) + a.totalSec
        }
        _phoneUsage.value = catMap.entries
            .sortedByDescending { it.value }
            .map { CategoryDuration(it.key, it.value) }
    }

    private suspend fun loadPcActivity() = withContext(Dispatchers.IO) {
        val url = SyncConfig.getServerUrl(getApplication())
        val key = SyncConfig.getApiKey(getApplication())
        val date = _date.value
        val conn = runCatching {
            (URL("$url/api/v1/activity/summary?date=${URLEncoder.encode(date, "UTF-8")}").openConnection() as HttpURLConnection).apply {
                setRequestProperty("X-Api-Key", key); connectTimeout = 5000; readTimeout = 5000
            }
        }.getOrNull() ?: return@withContext
        if (conn.responseCode !in 200..299) { conn.disconnect(); return@withContext }
        val json = conn.inputStream.bufferedReader().readText()
        conn.disconnect()
        val arr = JSONArray(json)
        _pcActivity.value = (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            CategoryDuration(obj.getString("category"), obj.getLong("durationSec"))
        }.sortedByDescending { it.durationSec }
    }

    private suspend fun loadHabitStats() = withContext(Dispatchers.IO) {
        val db = DbProvider.get(getApplication())
        val habits = db.habitDao().observeActiveHabits()
        // 30日間の完了率を計算
        val from = LocalDate.now().minusDays(29).format(DateTimeFormatter.ISO_LOCAL_DATE)
        val results = mutableListOf<Pair<String, Float>>()
        habits.collect { habitList ->
            habitList.forEach { habit ->
                val logs = db.habitDao().getRecentLogs(habit.id, from)
                val rate = logs.size / 30f
                results.add(habit.name to rate.coerceAtMost(1f))
            }
            _habitStats.value = results.sortedByDescending { it.second }
            return@collect
        }
    }
}

private fun hasUsagePermission(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(), context.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
}

// ─── Screen ───────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(vm: AnalyticsViewModel = viewModel()) {
    val date         by vm.date.collectAsStateWithLifecycle()
    val tab          by vm.tab.collectAsStateWithLifecycle()
    val loading      by vm.loading.collectAsStateWithLifecycle()
    val phoneUsage   by vm.phoneUsage.collectAsStateWithLifecycle()
    val topApps      by vm.topApps.collectAsStateWithLifecycle()
    val pcActivity   by vm.pcActivity.collectAsStateWithLifecycle()
    val habitStats   by vm.habitStats.collectAsStateWithLifecycle()
    val hasUsagePerm by vm.hasUsagePerm.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("分析", fontWeight = FontWeight.Bold) },
                actions = {
                    TextButton(onClick = { vm.today() }) { Text("今日") }
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
            // タブ
            TabRow(selectedTabIndex = tab) {
                Tab(selected = tab == 0, onClick = { vm.setTab(0) }, text = { Text("使用時間") })
                Tab(selected = tab == 1, onClick = { vm.setTab(1) }, text = { Text("PC活動") })
                Tab(selected = tab == 2, onClick = { vm.setTab(2) }, text = { Text("習慣") })
            }
            // コンテンツ
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                when (tab) {
                    0 -> {
                        if (!hasUsagePerm) {
                            item {
                                UsagePermissionCard {
                                    context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
                                }
                            }
                        } else {
                            if (phoneUsage.isEmpty()) {
                                item { EmptyCard("使用データがありません") }
                            } else {
                                item { SummaryCard("スマホ使用時間", phoneUsage) }
                                item { HorizontalDivider() }
                                item { Text("アプリ別", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold) }
                                items(topApps) { app ->
                                    AppUsageRow(app, topApps.firstOrNull()?.totalSec ?: 1L)
                                }
                            }
                        }
                    }
                    1 -> {
                        if (pcActivity.isEmpty()) {
                            item { EmptyCard("PCの作業データがありません\nwin-trackerを起動して同期してください") }
                        } else {
                            item { SummaryCard("PC作業時間", pcActivity) }
                        }
                    }
                    2 -> {
                        if (habitStats.isEmpty()) {
                            item { EmptyCard("習慣データがありません") }
                        } else {
                            item {
                                Text("過去30日間の達成率",
                                    style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                            }
                            items(habitStats) { (name, rate) ->
                                HabitCompletionRow(name, rate)
                            }
                        }
                    }
                }
                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }
}

// ─── パーミッション要求カード ──────────────────────────────────────────────────

@Composable
private fun UsagePermissionCard(onGrantClick: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("使用状況アクセスの許可が必要です",
                style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Text("スマホのアプリ使用時間を計測するには、「使用状況へのアクセス」の許可が必要です。",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = onGrantClick, Modifier.fillMaxWidth()) {
                Text("許可する（設定画面を開く）")
            }
        }
    }
}

// ─── カテゴリ別サマリーカード（横棒グラフ） ───────────────────────────────────

@Composable
private fun SummaryCard(title: String, data: List<CategoryDuration>) {
    val total = data.sumOf { it.durationSec }.coerceAtLeast(1L)
    val totalStr = formatDuration(total)

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                Text(title, style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                Text("合計 $totalStr", style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            data.forEach { (category, sec) ->
                val fraction = sec.toFloat() / total
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                        Text(category, fontSize = 12.sp)
                        Text(formatDuration(sec), fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Box(Modifier.fillMaxWidth().height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)) {
                        Box(Modifier.fillMaxWidth(fraction).height(6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(categoryColor(category)))
                    }
                }
            }
        }
    }
}

// ─── アプリ別使用行 ────────────────────────────────────────────────────────────

@Composable
private fun AppUsageRow(app: AppUsage, maxSec: Long) {
    val fraction = (app.totalSec.toFloat() / maxSec).coerceIn(0f, 1f)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(app.appName, fontSize = 12.sp, maxLines = 1)
            Box(Modifier.fillMaxWidth().height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)) {
                Box(Modifier.fillMaxWidth(fraction).height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)))
            }
        }
        Text(formatDuration(app.totalSec), fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ─── 習慣完了率行 ──────────────────────────────────────────────────────────────

@Composable
private fun HabitCompletionRow(name: String, rate: Float) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
            Text(name, fontSize = 13.sp)
            Text("${(rate * 100).toInt()}%", fontSize = 13.sp, fontWeight = FontWeight.Medium,
                color = if (rate >= 0.8f) Color(0xFF22C55E) else MaterialTheme.colorScheme.onSurface)
        }
        Box(Modifier.fillMaxWidth().height(6.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)) {
            Box(Modifier.fillMaxWidth(rate).height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(Color(0xFF22C55E)))
        }
    }
}

@Composable
private fun EmptyCard(message: String) {
    Card(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().padding(32.dp), Alignment.Center) {
            Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
    }
}

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

private fun formatDuration(sec: Long): String {
    val h = sec / 3600; val m = (sec % 3600) / 60
    return when { h > 0 && m > 0 -> "${h}h${m}m"; h > 0 -> "${h}h"; else -> "${m}m" }
}

private fun categoryColor(cat: String): Color = when (cat) {
    "開発"            -> Color(0xFF4757FF)
    "ブラウザ"        -> Color(0xFF6366F1)
    "コミュニケーション" -> Color(0xFF10B981)
    "学習"            -> Color(0xFF0EA5E9)
    "SNS"             -> Color(0xFFEF4444)
    "娯楽"            -> Color(0xFFF59E0B)
    else              -> Color(0xFF94A3B8)
}
