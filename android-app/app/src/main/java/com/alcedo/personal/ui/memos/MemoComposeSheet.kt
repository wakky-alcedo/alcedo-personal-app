package com.alcedo.personal.ui.memos

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoComposeSheet(
    initialBody: String = "",
    sourceUrl: String? = null,
    sourceTitle: String? = null,
    isEdit: Boolean = false,
    onDismiss: () -> Unit,
    onSave: (body: String) -> Unit
) {
    val sheetState = rememberModalBottomSheetState()
    var body by remember { mutableStateOf(initialBody) }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        modifier = Modifier.imePadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
        ) {
            Text(
                text = if (isEdit) "メモを編集" else "記事にメモを追加",
                style = MaterialTheme.typography.titleMedium
            )

            if (sourceUrl != null) {
                Spacer(Modifier.height(12.dp))
                LinkPreviewCard(url = sourceUrl, title = sourceTitle)
            }

            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = body,
                onValueChange = { body = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester),
                placeholder = { Text("コメントを入力...") },
                minLines = 3,
                maxLines = 10
            )

            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onDismiss) { Text("キャンセル") }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = {
                        if (body.isNotBlank()) {
                            onSave(body.trim())
                            onDismiss()
                        }
                    },
                    enabled = body.isNotBlank()
                ) {
                    Text(if (isEdit) "更新する" else "メモを保存")
                }
            }
        }
    }
}
