package com.alcedo.personal.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ─── ライトモード ─────────────────────────────────────────────────────────────
private val LightColors = lightColorScheme(
    primary          = Color(0xFF4757FF),
    onPrimary        = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFDDE1FF),
    onPrimaryContainer = Color(0xFF00007C),
    secondary        = Color(0xFF5C5F7E),
    onSecondary      = Color(0xFFFFFFFF),
    surface          = Color(0xFFF4F7FB),
    onSurface        = Color(0xFF182235),
    surfaceVariant   = Color(0xFFE8ECFF),
    onSurfaceVariant = Color(0xFF667085),
    background       = Color(0xFFEEF2FF),
    onBackground     = Color(0xFF182235),
    outline          = Color(0xFFBBC4E8),
)

// ─── ダークモード ──────────────────────────────────────────────────────────────
private val DarkColors = darkColorScheme(
    primary          = Color(0xFF9FABFF),
    onPrimary        = Color(0xFF00009E),
    primaryContainer = Color(0xFF1F2FE8),
    onPrimaryContainer = Color(0xFFDDE1FF),
    secondary        = Color(0xFFBEC2E8),
    onSecondary      = Color(0xFF282B4C),
    surface          = Color(0xFF111827),
    onSurface        = Color(0xFFE2E8F0),
    surfaceVariant   = Color(0xFF1E2640),
    onSurfaceVariant = Color(0xFF94A3B8),
    background       = Color(0xFF0D1117),
    onBackground     = Color(0xFFE2E8F0),
    outline          = Color(0xFF334155),
)

@Composable
fun AlcedoTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
