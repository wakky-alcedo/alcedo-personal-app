package com.alcedo.personal.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Primary = Color(0xFF4757FF)
private val PrimaryContainer = Color(0xFFDDE1FF)
private val OnPrimary = Color(0xFFFFFFFF)
private val Secondary = Color(0xFF5C5F7E)
private val Surface = Color(0xFFF4F7FB)
private val Background = Color(0xFFEEF2FF)

private val LightColors = lightColorScheme(
    primary = Primary,
    onPrimary = OnPrimary,
    primaryContainer = PrimaryContainer,
    secondary = Secondary,
    surface = Surface,
    background = Background,
)

@Composable
fun AlcedoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        content = content
    )
}
