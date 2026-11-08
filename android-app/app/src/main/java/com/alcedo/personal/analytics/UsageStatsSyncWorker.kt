package com.alcedo.personal.analytics

import android.app.AppOpsManager
import android.content.Context
import android.os.Build
import androidx.work.*
import com.alcedo.personal.sync.ApiHttpClient
import com.alcedo.personal.sync.ApiResult
import com.alcedo.personal.sync.HttpTimeouts
import com.alcedo.personal.sync.SyncConfig
import com.alcedo.personal.ui.util.TimeUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
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
        // 昨日の06:00〜現在（2日分をカバー）
        val yesterday = TimeUtils.effectiveLocalDate().minusDays(1).toString()
        val fromMs   = java.time.LocalDateTime.parse("${yesterday}T06:00:00")
            .atZone(zoneId).toInstant().toEpochMilli()
        val toMs     = System.currentTimeMillis()

        val sessions = UsageSessionBuilder.build(applicationContext, fromMs, toMs)
        if (sessions.isEmpty()) return@withContext Result.success()

        val deviceId  = "${Build.MANUFACTURER} ${Build.MODEL}"

        val ok = pushSessions(SyncConfig.httpClient(applicationContext), deviceId, sessions)
        if (ok) Result.success() else Result.retry()
    }

    private fun pushSessions(
        http: ApiHttpClient,
        deviceId: String,
        sessions: List<UsageSession>
    ): Boolean {
        val logsArr = JSONArray()
        sessions.forEach { s ->
            logsArr.put(JSONObject()
                .put("startedAt",    s.startedAt)
                .put("endedAt",      s.endedAt)
                .put("processName",  s.appLabel)
                .put("windowTitle",  s.appLabel)
                .put("browserUrl",   JSONObject.NULL)
                .put("category",     s.category)   // OS分類をサーバーに渡す
                .put("isMediaPlaying", false)
            )
        }
        val payload = JSONObject()
            .put("deviceId", deviceId)
            .put("logs", logsArr)

        return http.post("/api/v1/activity/bulk", payload.toString(), HttpTimeouts.BULK_UPLOAD) is ApiResult.Success
    }

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
