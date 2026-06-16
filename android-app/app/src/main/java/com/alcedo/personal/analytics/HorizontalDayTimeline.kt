package com.alcedo.personal.analytics

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private const val MIN_SCALE = 1f
private const val MAX_SCALE = 6f

@Composable
fun HorizontalDayTimeline(
    segments: List<TimelineSegment>,
    colorForCategory: (String) -> Color,
    dayStartMs: Long,
    modifier: Modifier = Modifier
) {
    val textMeasurer = rememberTextMeasurer()
    val labelStyle   = TextStyle(fontSize = 10.sp, color = Color(0xFF667085), textAlign = TextAlign.Center)
    val dividerColor = Color(0xFFCBD5E1)

    // 現在時刻の位置（当日のみ有効）
    val dayEndMs         = dayStartMs + 24L * 60 * 60 * 1000
    val nowMs            = System.currentTimeMillis()
    val nowFraction      = ((nowMs - dayStartMs).toFloat() / (dayEndMs - dayStartMs)).coerceIn(0f, 1f)
    val showNowIndicator = nowMs in dayStartMs..dayEndMs

    var scale by remember { mutableFloatStateOf(MIN_SCALE) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var viewportWidthPx by remember { mutableFloatStateOf(0f) }

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(76.dp)
            .clipToBounds()
            .onSizeChanged { viewportWidthPx = it.width.toFloat() }
            .pointerInput(Unit) {
                detectTransformGestures { centroid, pan, zoom, _ ->
                    if (viewportWidthPx <= 0f) return@detectTransformGestures
                    val newScale = (scale * zoom).coerceIn(MIN_SCALE, MAX_SCALE)
                    // ズーム中心(centroid)がコンテンツ上の同じ位置を指すよう offsetX を再計算
                    val fraction = (offsetX + centroid.x) / (viewportWidthPx * scale)
                    val maxOffset = viewportWidthPx * (newScale - 1f)
                    var newOffset = fraction * (viewportWidthPx * newScale) - centroid.x - pan.x
                    newOffset = newOffset.coerceIn(0f, maxOffset.coerceAtLeast(0f))
                    scale = newScale
                    offsetX = newOffset
                }
            }
    ) {
        val viewportW = size.width
        val contentW  = viewportW * scale
        val barHeight = 48.dp.toPx()

        // ─── セグメント描画 ────────────────────────────────────────────────────
        var x = -offsetX
        for (seg in segments) {
            val segW = (seg.bucketCount.toFloat() / TIMELINE_NUM_BUCKETS) * contentW
            val color = if (seg.isSleep) Color(0xFF93C5FD)
                        else runCatching { colorForCategory(seg.category) }.getOrElse { Color(0xFFE2E8F0) }
            if (x + segW >= 0f && x <= viewportW) {
                drawRect(color, Offset(x, 0f), Size(segW.coerceAtLeast(1f), barHeight))
            }
            x += segW
        }

        // ─── 現在時刻以降を半透明オーバーレイ ──────────────────────────────────
        if (showNowIndicator) {
            val nowX = nowFraction * contentW - offsetX
            val overlayStart = nowX.coerceIn(0f, viewportW)
            if (overlayStart < viewportW) {
                drawRect(
                    color = Color.White.copy(alpha = 0.45f),
                    topLeft = Offset(overlayStart, 0f),
                    size = Size(viewportW - overlayStart, barHeight)
                )
            }
            if (nowX in 0f..viewportW) {
                // 赤い現在時刻ライン
                drawLine(
                    color = Color(0xFFEF4444),
                    start = Offset(nowX, -6f),
                    end   = Offset(nowX, barHeight),
                    strokeWidth = 2.dp.toPx()
                )
                // 上端に赤い丸マーカー
                drawCircle(Color(0xFFEF4444), radius = 4.dp.toPx(), center = Offset(nowX, -2f))
            }
        }

        // ─── 2時間ごとの時刻ラベル・区切り線 ─────────────────────────────────
        for (i in 0..12) {
            val hour = (6 + i * 2) % 24
            val lineX = (i * 2f / 24f) * contentW - offsetX
            if (lineX < -40f || lineX > viewportW + 40f) continue
            val text = "%02d:00".format(hour)
            val measured = textMeasurer.measure(text, labelStyle)
            drawText(measured, topLeft = Offset(lineX - measured.size.width / 2f, barHeight + 6.dp.toPx()))
            drawLine(dividerColor, Offset(lineX, barHeight), Offset(lineX, barHeight + 4.dp.toPx()), 1.dp.toPx())
            if (i > 0 && i < 12) {
                drawLine(dividerColor.copy(alpha = 0.35f), Offset(lineX, 0f), Offset(lineX, barHeight), 0.5f)
            }
        }

        // ─── バーの枠線 ────────────────────────────────────────────────────────
        drawRect(Color(0xFFCBD5E1), Offset(0f, 0f), Size(viewportW, barHeight), style = Stroke(0.8.dp.toPx()))
    }
}
