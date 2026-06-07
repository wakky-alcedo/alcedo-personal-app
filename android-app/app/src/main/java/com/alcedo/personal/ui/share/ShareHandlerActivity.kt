package com.alcedo.personal.ui.share

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Patterns
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.alcedo.personal.ui.memos.MemoComposeSheet
import com.alcedo.personal.ui.memos.MemosViewModel
import com.alcedo.personal.ui.theme.AlcedoTheme

class ShareHandlerActivity : ComponentActivity() {

    private val vm: MemosViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val (sourceUrl, sourceTitle) = parseShareIntent(intent)

        setContent {
            AlcedoTheme {
                var show by remember { mutableStateOf(true) }
                if (show) {
                    MemoComposeSheet(
                        sourceUrl = sourceUrl,
                        sourceTitle = sourceTitle,
                        onDismiss = {
                            show = false
                            finish()
                        },
                        onSave = { body ->
                            vm.create(body, sourceUrl, sourceTitle)
                        }
                    )
                }
            }
        }
    }

    private fun parseShareIntent(intent: Intent): Pair<String?, String?> {
        val rawText = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim() ?: ""
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)

        // text がそのままURLなら正規表現を介さず使う（Patterns.WEB_URL がパスを切り落とすことがあるため）
        val url = if (rawText.startsWith("http://") || rawText.startsWith("https://")) {
            rawText
        } else {
            val matcher = Patterns.WEB_URL.matcher(rawText)
            if (matcher.find()) matcher.group() else null
        }

        val title = subject?.takeIf { it.isNotBlank() }
            ?: url?.let { u ->
                // URLのパスセグメントから人が読める文字列を生成（例: "my-article-title" → "My Article Title"）
                runCatching {
                    val segments = Uri.parse(u).pathSegments
                    segments.lastOrNull { seg -> seg.isNotBlank() && !seg.all(Char::isDigit) }
                        ?.replace(Regex("[-_]"), " ")
                        ?.split(" ")
                        ?.joinToString(" ") { it.replaceFirstChar(Char::uppercase) }
                        ?.takeIf { it.length > 3 }
                }.getOrNull() ?: runCatching { Uri.parse(u).host }.getOrNull()
            }

        return Pair(url, title)
    }
}
