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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
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
            val linkColor = MaterialTheme.colorScheme.primary
            val annotatedBody = remember(memo.body, linkColor) {
                buildLinkedText(memo.body, linkColor)
            }
            Text(
                text = annotatedBody,
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

/** 本文中のURLをタップ可能なリンクに変換する */
private fun buildLinkedText(body: String, linkColor: Color) = buildAnnotatedString {
    var lastIndex = 0
    for (match in urlRegex.findAll(body)) {
        append(body.substring(lastIndex, match.range.first))
        withLink(
            LinkAnnotation.Url(
                url = match.value,
                styles = TextLinkStyles(
                    style = SpanStyle(color = linkColor, textDecoration = TextDecoration.Underline)
                )
            )
        ) {
            append(match.value)
        }
        lastIndex = match.range.last + 1
    }
    append(body.substring(lastIndex))
}

private fun formatDate(iso: String): String = runCatching {
    dateFormatter.format(Instant.parse(iso))
}.getOrElse { iso.take(16) }
