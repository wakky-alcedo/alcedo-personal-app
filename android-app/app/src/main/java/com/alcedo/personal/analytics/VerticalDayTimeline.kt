package com.alcedo.personal.analytics

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val SLEEP_COLOR   = Color(0xFF93C5FD)
private val UNKNOWN_COLOR = Color(0xFFE2E8F0)

@Composable
fun VerticalDayTimeline(
    segments: List<TimelineSegment>,
    colorForCategory: (String) -> Color,
    modifier: Modifier = Modifier
) {
    val textMeasurer  = rememberTextMeasurer()
    val labelColor    = Color(0xFF667085)
    val dividerColor  = Color(0xFFCBD5E1)
    val labelStyle    = TextStyle(fontSize = 10.sp, color = labelColor)
    val nowLabelStyle = TextStyle(fontSize = 10.sp, color = Color(0xFF4757FF), fontWeight = FontWeight.Bold)

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(600.dp)
    ) {
        val labelW  = 38.dp.toPx()
        val barLeft = labelW + 4.dp.toPx()
        val barW    = size.width - barLeft
        val h       = size.height

        // セグメント描画
        var y = 0f
        for (seg in segments) {
            val segH = (seg.bucketCount.toFloat() / TIMELINE_NUM_BUCKETS) * h
            val color = when {
                seg.isSleep -> SLEEP_COLOR
                else        -> runCatching { colorForCategory(seg.category) }.getOrElse { UNKNOWN_COLOR }
            }
            drawRect(color, Offset(barLeft, y), Size(barW, segH.coerceAtLeast(1f)))
            y += segH
        }

        // 2時間ごとの時刻ラベル・区切り線
        for (i in 0..12) {
            val hour  = (6 + i * 2) % 24
            val lineY = (i * 2f / 24f) * h
            val text  = "%02d:00".format(hour)
            val isNow = i == 0 || i == 12
            val measured = textMeasurer.measure(text, if (isNow) nowLabelStyle else labelStyle)
            drawText(measured, topLeft = Offset(0f, lineY - measured.size.height / 2f))
            drawLine(dividerColor, Offset(barLeft - 4, lineY), Offset(barLeft, lineY), 1.dp.toPx())
            if (i > 0 && i < 12) {
                drawLine(dividerColor.copy(alpha = 0.4f), Offset(barLeft, lineY), Offset(barLeft + barW, lineY), 0.5f)
            }
        }

        // バーの枠線
        drawRect(
            color = Color(0xFFCBD5E1),
            topLeft = Offset(barLeft, 0f),
            size = Size(barW, h),
            style = androidx.compose.ui.graphics.drawscope.Stroke(1.dp.toPx())
        )
    }
}
