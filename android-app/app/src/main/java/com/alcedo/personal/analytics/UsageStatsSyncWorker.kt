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
import java.time.ZoneId
import java.util.concurrent.TimeUnit

class UsageStatsSyncWorker(
    ctx: Context,
    params: WorkerParameters
) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        if (!hasUsagePermission(applicationContext)) return@withContext Result.success()
        val http = SyncConfig.httpClient(applicationContext) ?: return@withContext Result.success()
        val serverUrl = SyncConfig.getServerUrl(applicationContext)

        // 昨日の DAY_START_HOUR 時〜現在を読む(長いセッションを取りこぼさないため)。送るのは未送信分だけ
        val zoneId = ZoneId.systemDefault()
        val fromMs = TimeUtils.effectiveLocalDate().minusDays(1)
            .atTime(UsageSyncRules.DAY_START_HOUR, 0)
            .atZone(zoneId).toInstant().toEpochMilli()
        val toMs = System.currentTimeMillis()

        val cursor = UsageSyncState.getCursor(applicationContext, serverUrl)
        val unsent = UsageSyncRules.unsent(UsageSessionBuilder.build(applicationContext, fromMs, toMs), cursor)
        if (unsent.isEmpty()) return@withContext Result.success()

        val deviceId = "${Build.MANUFACTURER} ${Build.MODEL}"
        if (!pushSessions(http, deviceId, unsent)) return@withContext Result.retry()

        UsageSyncRules.nextCursor(unsent, cursor)?.let { UsageSyncState.saveCursor(applicationContext, serverUrl, it) }
        Result.success()
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
        private const val RUN_NOW_WORK_NAME = "usage-stats-sync-now"

        private fun networkConstraints() =
            Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        /** UsageSyncRules.SYNC_INTERVAL_MINUTES ごとに同期する。UPDATE で旧来の 1 日 1 回の登録を置き換える */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<UsageStatsSyncWorker>(
                UsageSyncRules.SYNC_INTERVAL_MINUTES, TimeUnit.MINUTES
            )
                .setConstraints(networkConstraints())
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        }

        /** アプリを開いたとき・同期ボタン。実行待ちが残っていれば重ねて登録しない */
        fun runNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<UsageStatsSyncWorker>()
                .setConstraints(networkConstraints())
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(RUN_NOW_WORK_NAME, ExistingWorkPolicy.KEEP, request)
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
