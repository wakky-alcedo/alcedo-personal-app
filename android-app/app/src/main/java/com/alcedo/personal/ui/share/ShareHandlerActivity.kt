package com.alcedo.personal.ui.share

import android.content.Intent
import android.os.Bundle
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

        // EXTRA_TEXT = 共有URL（フルパス）, EXTRA_SUBJECT = ページタイトル
        val sourceUrl   = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()?.takeIf { it.isNotBlank() }
        val sourceTitle = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim()?.takeIf { it.isNotBlank() }

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
}
