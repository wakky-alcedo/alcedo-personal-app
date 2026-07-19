package com.alcedo.personal.ui.memos

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.sync.MemoEntity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoEditScreen(
    memoId: String,
    onBack: () -> Unit,
    vm: MemosViewModel = viewModel()
) {
    var memo by remember { mutableStateOf<MemoEntity?>(null) }
    var body by remember { mutableStateOf("") }
    var showDiscardDialog by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    val hasUnsavedChanges = memo != null && body != memo?.body
    val requestClose = {
        if (hasUnsavedChanges) showDiscardDialog = true else onBack()
    }

    BackHandler(enabled = hasUnsavedChanges) { showDiscardDialog = true }

    LaunchedEffect(memoId) {
        val loaded = vm.getMemo(memoId)
        if (loaded == null) {
            onBack()
        } else {
            memo = loaded
            body = loaded.body
        }
    }

    if (showDiscardDialog) {
        AlertDialog(
            onDismissRequest = { showDiscardDialog = false },
            title = { Text("変更を破棄しますか？") },
            text = { Text("保存していない変更があります。破棄して戻りますか？") },
            confirmButton = {
                TextButton(onClick = {
                    showDiscardDialog = false
                    onBack()
                }) {
                    Text("破棄")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDiscardDialog = false }) {
                    Text("キャンセル")
                }
            }
        )
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = { Text("メモを編集") },
                navigationIcon = {
                    IconButton(onClick = requestClose) {
                        Icon(Icons.Default.Close, "閉じる")
                    }
                },
                actions = {
                    TextButton(
                        onClick = {
                            val trimmed = body.trim()
                            if (trimmed.isNotEmpty()) {
                                vm.update(memoId, trimmed)
                                onBack()
                            }
                        },
                        enabled = memo != null && body.isNotBlank()
                    ) {
                        Text("保存")
                    }
                }
            )
        }
    ) { padding ->
        val loaded = memo
        if (loaded == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .imePadding()
                    .padding(padding)
                    .padding(16.dp)
            ) {
                LaunchedEffect(Unit) { focusRequester.requestFocus() }

                if (loaded.sourceUrl != null) {
                    LinkPreviewCard(
                        url = loaded.sourceUrl,
                        title = loaded.sourceTitle,
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
