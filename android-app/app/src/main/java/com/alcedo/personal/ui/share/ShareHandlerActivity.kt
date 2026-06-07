package com.alcedo.personal.ui.share

import android.content.Intent
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
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim()?.takeIf { it.isNotBlank() }

        val url: String?
        val prefixTitle: String?

        if (rawText.startsWith("http://") || rawText.startsWith("https://")) {
            // EXTRA_TEXT がそのまま URL（ブラウザからの標準的な共有）
            url = rawText
            prefixTitle = null
        } else {
            // テキスト中に URL が埋め込まれている場合（例: "タイトル https://..."）
            val matcher = Patterns.WEB_URL.matcher(rawText)
            if (matcher.find()) {
                url = matcher.group()
                prefixTitle = rawText.substring(0, matcher.start()).trim().takeIf { it.isNotBlank() }
            } else {
                url = null
                prefixTitle = null
            }
        }

        // SUBJECT 優先 → URL より前のテキスト → null
        val title = subject ?: prefixTitle

        return Pair(url, title)
    }
}
