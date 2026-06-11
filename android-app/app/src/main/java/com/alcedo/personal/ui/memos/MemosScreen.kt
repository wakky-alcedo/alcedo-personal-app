package com.alcedo.personal.ui.memos

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alcedo.personal.sync.MemoEntity
import com.alcedo.personal.ui.common.SwipeToRevealDelete
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemosScreen(vm: MemosViewModel = viewModel()) {
    val memos by vm.memos.collectAsStateWithLifecycle()
    val refreshing by vm.refreshing.collectAsStateWithLifecycle()
    var showCompose by remember { mutableStateOf(false) }
    var editingMemo by remember { mutableStateOf<MemoEntity?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("メモ") },
                actions = {
                    IconButton(onClick = { showCompose = true }) {
                        Icon(Icons.Default.Add, "メモを追加")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { vm.refresh() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (memos.isEmpty()) {
                EmptyMemosState(
                    modifier = Modifier.fillMaxSize(),
                    onAdd = { showCompose = true }
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp
                    )
                ) {
                    items(memos, key = { it.id }) { memo ->
                        val deletedBody    = memo.body
                        val deletedUrl     = memo.sourceUrl
                        val deletedTitle   = memo.sourceTitle

                        SwipeToRevealDelete(
                            onDelete = {
                                vm.softDelete(memo.id)
                                scope.launch {
                                    val result = snackbarHostState.showSnackbar(
                                        message = "削除しました",
                                        actionLabel = "元に戻す",
                                        duration = SnackbarDuration.Short
                                    )
                                    if (result == SnackbarResult.ActionPerformed) {
                                        vm.create(deletedBody, deletedUrl, deletedTitle)
                                    }
                                }
                            },
                            modifier = Modifier.padding(vertical = 6.dp)
                        ) {
                            MemoCard(
                                memo = memo,
                                onClick = { editingMemo = memo }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showCompose) {
        MemoComposeSheet(
            onDismiss = { showCompose = false },
            onSave = { body -> vm.create(body) }
        )
    }

    editingMemo?.let { memo ->
        MemoComposeSheet(
            initialBody = memo.body,
            sourceUrl = memo.sourceUrl,
            sourceTitle = memo.sourceTitle,
            isEdit = true,
            onDismiss = { editingMemo = null },
            onSave = { body -> vm.update(memo.id, body) }
        )
    }
}

@Composable
private fun EmptyMemosState(modifier: Modifier = Modifier, onAdd: () -> Unit) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("📝", style = MaterialTheme.typography.displayMedium)
        Spacer(Modifier.height(16.dp))
        Text(
            "メモがまだありません",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "記事を共有するか、＋から追加",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(24.dp))
        FilledTonalButton(onClick = onAdd) {
            Icon(Icons.Default.Add, null)
            Spacer(Modifier.width(4.dp))
            Text("最初のメモを追加")
        }
    }
}
