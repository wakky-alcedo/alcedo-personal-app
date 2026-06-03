package com.alcedo.personal.analytics

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import java.time.Instant

data class UsageSession(
    val packageName: String,
    val appLabel: String,
    val startedAt: String,   // UTC ISO 8601
    val endedAt: String,     // UTC ISO 8601
    val category: String
)

/** UsageEvents からアプリ別セッションを構築する */
object UsageSessionBuilder {

    private const val MIN_DURATION_MS = 5_000L   // 5秒未満は除外

    fun build(context: Context, fromMs: Long, toMs: Long): List<UsageSession> {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val pm  = context.packageManager
        val events = usm.queryEvents(fromMs, toMs)
        val event = UsageEvents.Event()

        // パッケージ → フォアグラウンド開始時刻
        val active = mutableMapOf<String, Long>()
        val sessions = mutableListOf<UsageSession>()

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            when (event.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    active[pkg] = event.timeStamp
                }
                UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    val start = active.remove(pkg) ?: continue
                    val duration = event.timeStamp - start
                    if (duration < MIN_DURATION_MS) continue

                    val label = try {
                        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                    } catch (e: Exception) { pkg }

                    sessions.add(
                        UsageSession(
                            packageName = pkg,
                            appLabel    = label,
                            startedAt   = Instant.ofEpochMilli(start).toString(),
                            endedAt     = Instant.ofEpochMilli(event.timeStamp).toString(),
                            category    = CategoryMapper.get(pkg)
                        )
                    )
                }
            }
        }
        return sessions
    }
}
