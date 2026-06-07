package com.alcedo.personal.ui.memos

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.alcedo.personal.sync.MemoEntity
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val dateFormatter = DateTimeFormatter
    .ofPattern("M/d HH:mm", Locale.JAPAN)
    .withZone(ZoneId.of("Asia/Tokyo"))

@Composable
fun MemoCard(
    memo: MemoEntity,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val url = memo.sourceUrl ?: extractUrl(memo.body)

    ElevatedCard(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = MaterialTheme.shapes.medium,
        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = memo.body,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (url != null) {
                Spacer(Modifier.height(8.dp))
                LinkPreviewCard(url = url, title = memo.sourceTitle)
            }

            Spacer(Modifier.height(6.dp))
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.weight(1f))
                Text(
                    text = formatDate(memo.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

private val urlRegex = Regex("""https?://\S+[^\s.,;!?)'"]+""")

fun extractUrl(text: String): String? = urlRegex.find(text)?.value

private fun formatDate(iso: String): String = runCatching {
    dateFormatter.format(Instant.parse(iso))
}.getOrElse { iso.take(16) }
