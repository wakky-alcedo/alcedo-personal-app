package com.alcedo.personal.analytics

import android.app.AppOpsManager
import android.content.Context
import android.os.Build
import androidx.work.*
import com.alcedo.personal.sync.SyncConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

class UsageStatsSyncWorker(
    ctx: Context,
    params: WorkerParameters
) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        if (!hasUsagePermission(applicationContext)) return@withContext Result.success()

        val zoneId   = ZoneId.systemDefault()
        val today    = LocalDate.now()
        val fromMs   = today.minusDays(1).atStartOfDay(zoneId).toInstant().toEpochMilli()
        val toMs     = System.currentTimeMillis()

        val sessions = UsageSessionBuilder.build(applicationContext, fromMs, toMs)
        if (sessions.isEmpty()) return@withContext Result.success()

        val serverUrl = SyncConfig.getServerUrl(applicationContext)
        val apiKey    = SyncConfig.getApiKey(applicationContext)
        val deviceId  = "${Build.MANUFACTURER} ${Build.MODEL}"

        val ok = pushSessions(serverUrl, apiKey, deviceId, sessions)
        if (ok) Result.success() else Result.retry()
    }

    private fun pushSessions(
        serverUrl: String,
        apiKey: String,
        deviceId: String,
        sessions: List<UsageSession>
    ): Boolean = runCatching {
        val logsArr = JSONArray()
        sessions.forEach { s ->
            logsArr.put(JSONObject()
                .put("startedAt",    s.startedAt)
                .put("endedAt",      s.endedAt)
                .put("processName",  s.appLabel)
                .put("windowTitle",  s.appLabel)
                .put("browserUrl",   JSONObject.NULL)
                .put("isMediaPlaying", false)
            )
        }
        val payload = JSONObject()
            .put("deviceId", deviceId)
            .put("logs", logsArr)

        val conn = (URL("$serverUrl/api/v1/activity/bulk").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("X-Api-Key", apiKey)
            doOutput = true
            connectTimeout = 10000; readTimeout = 15000
        }
        conn.outputStream.bufferedWriter().use { it.write(payload.toString()) }
        val ok = conn.responseCode in 200..299
        conn.disconnect()
        ok
    }.getOrElse { false }

    companion object {
        private const val WORK_NAME = "usage-stats-sync"

        fun schedule(context: Context) {
            // 毎日深夜2時に実行
            val now          = java.time.LocalTime.now()
            val target       = java.time.LocalTime.of(2, 0)
            val initialDelay = if (now.isBefore(target))
                java.time.Duration.between(now, target).toMinutes()
            else
                java.time.Duration.between(now, target.plusHours(24)).toMinutes()

            val request = PeriodicWorkRequestBuilder<UsageStatsSyncWorker>(1, TimeUnit.DAYS)
                .setInitialDelay(initialDelay, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun runNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<UsageStatsSyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueue(request)
        }
    }
}

fun hasUsagePermission(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(), context.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
}
