package com.alcedo.personal.ui.share

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Patterns
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.view.WindowCompat
import com.alcedo.personal.ui.memos.MemoComposeSheet
import com.alcedo.personal.ui.memos.MemosViewModel
import com.alcedo.personal.ui.theme.AlcedoTheme

class ShareHandlerActivity : ComponentActivity() {

    private val vm: MemosViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

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
        val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: ""
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)

        val matcher = Patterns.WEB_URL.matcher(text)
        val url = if (matcher.find()) matcher.group() else null
        val title = subject?.takeIf { it.isNotBlank() }
            ?: url?.let { runCatching { Uri.parse(it).host }.getOrNull() }

        return Pair(url, title)
    }
}
