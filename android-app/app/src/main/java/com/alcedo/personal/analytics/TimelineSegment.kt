package com.alcedo.personal.analytics

import com.alcedo.personal.ui.util.TimeUtils
import java.time.Instant
import java.time.ZoneId

const val TIMELINE_BUCKET_MINUTES = 5
const val TIMELINE_NUM_BUCKETS = 24 * 60 / TIMELINE_BUCKET_MINUTES  // 288

data class TimelineSegment(
    val category: String,
    val bucketCount: Int,
    val isSleep: Boolean
)

data class ActivitySession(
    val startedAt: String,
    val endedAt: String?,
    val category: String,
    val processName: String,
    val windowTitle: String,
    val deviceId: String
)

fun buildTimelineSegments(sessions: List<ActivitySession>, dayStartMs: Long): List<TimelineSegment> {
    val bucketMs = TIMELINE_BUCKET_MINUTES * 60 * 1000L
    val buckets  = Array<String?>(TIMELINE_NUM_BUCKETS) { null }

    // 後の startedAt が優先（直近デバイス優先）
    val sorted = sessions.sortedBy { it.startedAt }
    for (s in sorted) {
        val startMs = runCatching { Instant.parse(s.startedAt).toEpochMilli() }.getOrNull() ?: continue
        val endMs   = s.endedAt?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
            ?: System.currentTimeMillis()
        val startB = ((startMs - dayStartMs) / bucketMs).toInt().coerceIn(0, TIMELINE_NUM_BUCKETS - 1)
        val endB   = ((endMs   - dayStartMs) / bucketMs).toInt().coerceIn(0, TIMELINE_NUM_BUCKETS)
        for (i in startB until endB) buckets[i] = s.category
    }

    // ギャップ = 睡眠
    val filled = buckets.map { it ?: "睡眠" }

    // 連続する同カテゴリを統合
    val segments = mutableListOf<TimelineSegment>()
    var cur = filled[0]; var count = 1
    for (i in 1 until TIMELINE_NUM_BUCKETS) {
        if (filled[i] == cur) count++
        else { segments += TimelineSegment(cur, count, cur == "睡眠"); cur = filled[i]; count = 1 }
    }
    segments += TimelineSegment(cur, count, cur == "睡眠")
    return segments
}

/** YYYY-MM-DD の 06:00 ローカル時刻のエポックミリ秒 */
fun dayStartMs(localDate: String): Long =
    java.time.LocalDateTime.parse("${localDate}T06:00:00")
        .atZone(ZoneId.systemDefault())
        .toInstant().toEpochMilli()
