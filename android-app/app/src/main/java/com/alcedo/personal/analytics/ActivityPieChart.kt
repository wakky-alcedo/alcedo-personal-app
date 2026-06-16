package com.alcedo.personal.analytics

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun ActivityPieChart(
    data: List<CategoryDuration>,
    colorFor: (String) -> Color,
    modifier: Modifier = Modifier
) {
    val total = data.sumOf { it.durationSec }.coerceAtLeast(1L)

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Canvas(Modifier.size(160.dp)) {
            var startAngle = -90f
            for (item in data) {
                val sweep = item.durationSec.toFloat() / total * 360f
                drawArc(
                    color = colorFor(item.category),
                    startAngle = startAngle,
                    sweepAngle = sweep,
                    useCenter = true,
                    topLeft = Offset.Zero,
                    size = Size(size.width, size.height)
                )
                startAngle += sweep
            }
        }
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            data.forEach { item ->
                val percent = (item.durationSec.toFloat() / total * 100).let { "%.0f".format(it) }
                Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        androidx.compose.foundation.layout.Box(
                            Modifier.size(10.dp).background(colorFor(item.category), RoundedCornerShape(2.dp))
                        )
                        Text(item.category, fontSize = 12.sp)
                    }
                    Text("${formatDuration(item.durationSec)} (${percent}%)",
                        fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
