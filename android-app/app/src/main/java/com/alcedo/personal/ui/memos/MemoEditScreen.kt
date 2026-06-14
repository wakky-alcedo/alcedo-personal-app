package com.alcedo.personal.ui.memos

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.alcedo.personal.sync.MemoEntity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoEditScreen(
    memo: MemoEntity,
    onDismiss: () -> Unit,
    onSave: (body: String) -> Unit
) {
    var body by remember { mutableStateOf(memo.body) }
    val focusRequester = remember { FocusRequester() }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            topBar = {
                TopAppBar(
                    title = { Text("メモを編集") },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, "閉じる")
                        }
                    },
                    actions = {
                        TextButton(
                            onClick = {
                                val trimmed = body.trim()
                                if (trimmed.isNotEmpty()) {
                                    onSave(trimmed)
                                    onDismiss()
                                }
                            },
                            enabled = body.isNotBlank()
                        ) {
                            Text("保存")
                        }
                    }
                )
            }
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .imePadding()
                    .padding(padding)
                    .padding(16.dp)
            ) {
                LaunchedEffect(Unit) { focusRequester.requestFocus() }

                if (memo.sourceUrl != null) {
                    LinkPreviewCard(
                        url = memo.sourceUrl,
                        title = memo.sourceTitle,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                }

                OutlinedTextField(
                    value = body,
                    onValueChange = { body = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .focusRequester(focusRequester),
                    placeholder = { Text("コメントを入力...") }
                )
            }
        }
    }
}
