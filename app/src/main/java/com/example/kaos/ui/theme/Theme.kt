package com.example.kaos.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = KaosPrimary,
    primaryContainer = KaosPrimaryContainer,
    background = KaosBackground,
    surface = KaosSurface,
    surfaceVariant = KaosSurfaceVariant,
    onBackground = KaosOnBackground,
    onSurface = KaosOnSurface,
    outline = KaosOutline
)

@Composable
fun KAOSTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = KaosTypography,
        content = content
    )
}
