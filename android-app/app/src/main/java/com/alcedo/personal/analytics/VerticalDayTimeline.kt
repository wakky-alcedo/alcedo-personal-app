package com.alcedo.personal.analytics

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun VerticalDayTimeline(
    segments: List<TimelineSegment>,
    colorForCategory: (String) -> Color,
    dayStartMs: Long,
    modifier: Modifier = Modifier
) {
    val textMeasurer = rememberTextMeasurer()
    val labelStyle   = TextStyle(fontSize = 10.sp, color = Color(0xFF667085))
    val dividerColor = Color(0xFFCBD5E1)

    // 現在時刻の位置（当日のみ有効）
    val dayEndMs         = dayStartMs + 24L * 60 * 60 * 1000
    val nowMs            = System.currentTimeMillis()
    val nowFraction      = ((nowMs - dayStartMs).toFloat() / (dayEndMs - dayStartMs)).coerceIn(0f, 1f)
    val showNowIndicator = nowMs in dayStartMs..dayEndMs

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(600.dp)
    ) {
        val labelW  = 42.dp.toPx()
        val barLeft = labelW + 4.dp.toPx()
        val barW    = size.width - barLeft
        val h       = size.height

        // ─── セグメント描画 ────────────────────────────────────────────────────
        var y = 0f
        for (seg in segments) {
            val segH = (seg.bucketCount.toFloat() / TIMELINE_NUM_BUCKETS) * h
            val color = if (seg.isSleep) Color(0xFF93C5FD)
                        else runCatching { colorForCategory(seg.category) }.getOrElse { Color(0xFFE2E8F0) }
            drawRect(color, Offset(barLeft, y), Size(barW, segH.coerceAtLeast(1f)))
            y += segH
        }

        // ─── 現在時刻以降を半透明オーバーレイ ──────────────────────────────────
        if (showNowIndicator) {
            val nowY = nowFraction * h
            drawRect(
                color = Color.White.copy(alpha = 0.45f),
                topLeft = Offset(barLeft, nowY),
                size = Size(barW, h - nowY)
            )
            // 赤い現在時刻ライン
            drawLine(
                color = Color(0xFFEF4444),
                start = Offset(barLeft - 6, nowY),
                end   = Offset(barLeft + barW, nowY),
                strokeWidth = 2.dp.toPx()
            )
            // 左端に赤い三角マーカー（▶ 風の小丸）
            drawCircle(Color(0xFFEF4444), radius = 4.dp.toPx(), center = Offset(barLeft - 2, nowY))
        }

        // ─── 2時間ごとの時刻ラベル・区切り線 ─────────────────────────────────
        for (i in 0..12) {
            val hour  = (6 + i * 2) % 24
            val lineY = (i * 2f / 24f) * h
            val text  = "%02d:00".format(hour)
            val measured = textMeasurer.measure(text, labelStyle)
            drawText(measured, topLeft = Offset(0f, lineY - measured.size.height / 2f))
            drawLine(dividerColor, Offset(labelW, lineY), Offset(labelW + 4, lineY), 1.dp.toPx())
            if (i > 0 && i < 12) {
                drawLine(dividerColor.copy(alpha = 0.35f), Offset(barLeft, lineY), Offset(barLeft + barW, lineY), 0.5f)
            }
        }

        // ─── バーの枠線 ────────────────────────────────────────────────────────
        drawRect(Color(0xFFCBD5E1), Offset(barLeft, 0f), Size(barW, h), style = Stroke(0.8.dp.toPx()))
    }
}
