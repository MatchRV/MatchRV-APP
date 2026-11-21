package com.example.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

private val MatchRvDarkColorScheme = darkColorScheme(
    primary = MatchAqua,
    onPrimary = MatchAquaInk,
    primaryContainer = MatchAquaDeep,
    onPrimaryContainer = MatchAquaSoft,
    secondary = MatchAmber,
    onSecondary = MatchInk950,
    secondaryContainer = MatchInk700,
    onSecondaryContainer = MatchAmber,
    tertiary = MatchEmber,
    onTertiary = MatchInk950,
    background = MatchInk900,
    onBackground = MatchFgDark,
    surface = MatchInk850,
    onSurface = MatchFgDark,
    surfaceVariant = MatchInk800,
    onSurfaceVariant = MatchFgMutedDark,
    surfaceContainerLowest = MatchInk950,
    surfaceContainerLow = MatchInk900,
    surfaceContainer = MatchInk850,
    surfaceContainerHigh = MatchInk800,
    surfaceContainerHighest = MatchInk700,
    outline = MatchInk700,
    outlineVariant = MatchBorderDark,
    error = MatchPassCoral,
    onError = MatchInk950
)

private val MatchRvLightColorScheme = lightColorScheme(
    primary = MatchAquaDeep,
    onPrimary = MatchWhite,
    primaryContainer = MatchAquaSoft,
    onPrimaryContainer = MatchAquaInk,
    secondary = MatchWarnLight,
    onSecondary = MatchWhite,
    secondaryContainer = MatchPaper2,
    onSecondaryContainer = MatchFgLight,
    tertiary = MatchEmber,
    onTertiary = MatchInk950,
    background = MatchPaper,
    onBackground = MatchFgLight,
    surface = MatchWhite,
    onSurface = MatchFgLight,
    surfaceVariant = MatchPaper2,
    onSurfaceVariant = MatchFgMutedLight,
    outline = MatchBorderLight,
    error = MatchWarnLight,
    onError = MatchWhite
)

val MatchRvShapes = Shapes(
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(28.dp)
)

@Composable
fun MatchRvTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    // MatchRV uses its signature Ink 900 + Aqua dark palette by default
    val colorScheme = if (darkTheme) MatchRvDarkColorScheme else MatchRvLightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = MatchRvTypography,
        shapes = MatchRvShapes,
        content = content
    )
}
