package com.alcedo.personal.analytics

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import java.time.Instant

data class UsageSession(
    val packageName: String,
    val appLabel: String,
    val startedAt: String,   // UTC ISO 8601
    val endedAt: String,     // UTC ISO 8601
    val category: String     // OS標準カテゴリ（未分類はサーバー側で設定）
)

/** UsageEvents からアプリ別セッションを構築する */
object UsageSessionBuilder {

    private const val MIN_DURATION_MS = 5_000L   // 5秒未満は除外

    fun build(context: Context, fromMs: Long, toMs: Long): List<UsageSession> {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val pm  = context.packageManager
        val events = usm.queryEvents(fromMs, toMs)
        val event = UsageEvents.Event()

        val active   = mutableMapOf<String, Long>()  // package → フォアグラウンド開始ms
        val sessions = mutableListOf<UsageSession>()

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            when (event.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    active[pkg] = event.timeStamp
                }
                UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    val start    = active.remove(pkg) ?: continue
                    val duration = event.timeStamp - start
                    if (duration < MIN_DURATION_MS) continue

                    val (label, osCategory) = try {
                        val info = pm.getApplicationInfo(pkg, PackageManager.GET_META_DATA)
                        pm.getApplicationLabel(info).toString() to info.category
                    } catch (e: Exception) {
                        pkg to android.content.pm.ApplicationInfo.CATEGORY_UNDEFINED
                    }

                    sessions.add(UsageSession(
                        packageName = pkg,
                        appLabel    = label,
                        startedAt   = Instant.ofEpochMilli(start).toString(),
                        endedAt     = Instant.ofEpochMilli(event.timeStamp).toString(),
                        category    = CategoryMapper.fromOsCategory(osCategory)
                    ))
                }
            }
        }
        return sessions
    }
}
