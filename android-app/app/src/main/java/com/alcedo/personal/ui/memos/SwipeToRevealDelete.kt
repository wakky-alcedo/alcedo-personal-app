package com.alcedo.personal.ui.memos

import androidx.compose.animation.core.exponentialDecay
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.AnchoredDraggableState
import androidx.compose.foundation.gestures.DraggableAnchors
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.anchoredDraggable
import androidx.compose.foundation.gestures.animateTo
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

private enum class RevealValue { Closed, Open }

private val DeleteActionWidth = 72.dp

/**
 * 左に少しスワイプすると幅 [DeleteActionWidth] 分だけ削除アイコンが現れ、
 * タップすると [onDelete] が呼ばれる行コンテナ。
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SwipeToRevealDelete(
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val density = LocalDensity.current
    val revealPx = with(density) { DeleteActionWidth.toPx() }
    val velocityThresholdPx = with(density) { 125.dp.toPx() }
    val scope = rememberCoroutineScope()

    val state = remember {
        AnchoredDraggableState(
            initialValue = RevealValue.Closed,
            anchors = DraggableAnchors {
                RevealValue.Closed at 0f
                RevealValue.Open at -revealPx
            },
            positionalThreshold = { distance -> distance * 0.5f },
            velocityThreshold = { velocityThresholdPx },
            snapAnimationSpec = tween(),
            decayAnimationSpec = exponentialDecay()
        )
    }

    Box(modifier = modifier) {
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(MaterialTheme.colorScheme.errorContainer, MaterialTheme.shapes.medium),
            contentAlignment = Alignment.CenterEnd
        ) {
            IconButton(
                onClick = {
                    onDelete()
                    scope.launch { state.animateTo(RevealValue.Closed) }
                },
                modifier = Modifier
                    .width(DeleteActionWidth)
                    .fillMaxHeight()
            ) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "削除",
                    tint = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }

        Box(
            modifier = Modifier
                .offset { IntOffset(state.requireOffset().roundToInt(), 0) }
                .anchoredDraggable(state, Orientation.Horizontal)
        ) {
            content()
        }
    }
}
