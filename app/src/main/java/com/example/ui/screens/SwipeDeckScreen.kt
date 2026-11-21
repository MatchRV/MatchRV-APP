package com.example.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material.icons.filled.RvHookup
import androidx.compose.material.icons.filled.Style
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.Coil
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.data.model.RvSummary
import com.example.data.model.RvTypeOption
import com.example.ui.BrowseMode
import com.example.ui.DiscoverUiState
import com.example.ui.components.RvFormatters
import com.example.ui.theme.MatchAmber
import com.example.ui.theme.MatchAqua
import com.example.ui.theme.MatchInk700
import com.example.ui.theme.MatchInk800
import com.example.ui.theme.MatchInk850
import com.example.ui.theme.MatchInk900
import com.example.ui.theme.MatchInk950
import com.example.ui.theme.MatchPassCoral
import kotlinx.coroutines.launch
import kotlin.math.abs

@Composable
fun DiscoverScreen(
    state: DiscoverUiState,
    onSwipeRight: (RvSummary) -> Unit,
    onSwipeLeft: (RvSummary) -> Unit,
    onUndo: () -> Unit,
    onCardTap: (RvSummary) -> Unit,
    onToggleMode: (BrowseMode) -> Unit,
    onOpenFilters: () -> Unit,
    onRetry: () -> Unit,
    onResetFilters: () -> Unit,
    onLoadMore: () -> Unit
) {
    val context = LocalContext.current

    // Prefetch upcoming card images via Coil for smooth swipes
    LaunchedEffect(state.deck.take(5).map { it.thumbnailUrl }) {
        val loader = Coil.imageLoader(context)
        state.deck.take(5).forEach { rv ->
            val url = rv.thumbnailUrl
            if (!url.isNullOrBlank()) {
                loader.enqueue(
                    ImageRequest.Builder(context)
                        .data(url)
                        .build()
                )
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MatchInk900)
            .padding(horizontal = 16.dp)
    ) {
        // Sub-header: live count, mode switch, and instant filter button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                val integerFormatter = remember { java.text.NumberFormat.getIntegerInstance() }
                val eligibleText = state.eligibleInventoryCount?.let {
                    "${integerFormatter.format(it)} live dealer RVs"
                } ?: "Live MatchRV inventory"
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(MatchAqua)
                    )
                    Text(
                        text = eligibleText,
                        style = MaterialTheme.typography.labelMedium,
                        color = MatchAqua
                    )
                }
                if (state.filter.activeFilterCount() > 0) {
                    Text(
                        text = state.filter.toSummaryLabel(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MatchInk800,
                    border = BorderStroke(1.dp, MatchInk700)
                ) {
                    Row(modifier = Modifier.padding(3.dp)) {
                        ModeToggleIcon(
                            selected = state.browseMode == BrowseMode.SWIPE,
                            icon = Icons.Default.Style,
                            contentDescription = "Swipe deck mode",
                            testTag = "mode_swipe_button",
                            onClick = { onToggleMode(BrowseMode.SWIPE) }
                        )
                        ModeToggleIcon(
                            selected = state.browseMode == BrowseMode.GRID,
                            icon = Icons.Default.GridView,
                            contentDescription = "Grid browse mode",
                            testTag = "mode_grid_button",
                            onClick = { onToggleMode(BrowseMode.GRID) }
                        )
                    }
                }

                val activeCount = state.filter.activeFilterCount()
                BadgedBox(
                    badge = {
                        if (activeCount > 0) {
                            Badge(
                                containerColor = MatchAqua,
                                contentColor = MatchInk950
                            ) {
                                Text(activeCount.toString())
                            }
                        }
                    }
                ) {
                    FilledTonalIconButton(
                        onClick = onOpenFilters,
                        colors = IconButtonDefaults.filledTonalIconButtonColors(
                            containerColor = MatchInk800,
                            contentColor = MaterialTheme.colorScheme.onSurface
                        ),
                        modifier = Modifier
                            .size(48.dp)
                            .testTag("open_filters_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Tune,
                            contentDescription = "Open RV Filters"
                        )
                    }
                }
            }
        }

        // AI-curated deck indicator if active
        if (!state.aiCuratedSummary.isNullOrBlank()) {
            Surface(
                color = MatchAqua.copy(alpha = 0.12f),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, MatchAqua.copy(alpha = 0.35f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 10.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = MatchAqua,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = state.aiCuratedSummary,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Surface(
                        shape = CircleShape,
                        color = MatchInk800,
                        modifier = Modifier
                            .size(32.dp)
                            .clickable(onClick = onResetFilters)
                            .testTag("clear_ai_deck_button")
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Clear AI deck",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }

        // Main content area
        when {
            state.isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        CircularProgressIndicator(color = MatchAqua)
                        Text(
                            text = "Matching live dealer inventory...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            state.errorMessage != null && state.deck.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.RvHookup,
                            contentDescription = null,
                            tint = MatchAmber,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "Couldn't load MatchRV inventory",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = state.errorMessage,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Button(
                            onClick = onRetry,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MatchAqua,
                                contentColor = MatchInk950
                            ),
                            modifier = Modifier.testTag("retry_deck_button")
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Retry")
                        }
                    }
                }
            }

            state.deck.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.RvHookup,
                            contentDescription = null,
                            tint = MatchAqua,
                            modifier = Modifier.size(52.dp)
                        )
                        Text(
                            text = "You've seen this batch!",
                            style = MaterialTheme.typography.headlineMedium,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = "Load more live units or broaden your filters to explore more of the 144,000+ nationwide RVs.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(
                                onClick = onResetFilters,
                                modifier = Modifier.testTag("reset_filters_empty_button")
                            ) {
                                Text("Reset Filters")
                            }
                            Button(
                                onClick = onRetry,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MatchAqua,
                                    contentColor = MatchInk950
                                ),
                                modifier = Modifier.testTag("load_more_deck_button")
                            ) {
                                Text("Refresh Deck")
                            }
                        }
                    }
                }
            }

            state.browseMode == BrowseMode.SWIPE -> {
                SwipeDeckContent(
                    deck = state.deck,
                    canUndo = state.passedStack.isNotEmpty(),
                    isPrefetching = state.isPrefetching,
                    onSwipeRight = onSwipeRight,
                    onSwipeLeft = onSwipeLeft,
                    onUndo = onUndo,
                    onCardTap = onCardTap
                )
            }

            else -> {
                GridBrowseContent(
                    units = state.deck,
                    isPrefetching = state.isPrefetching,
                    onCardTap = onCardTap,
                    onQuickSave = onSwipeRight,
                    onLoadMore = onLoadMore
                )
            }
        }
    }
}

@Composable
private fun ModeToggleIcon(
    selected: Boolean,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    testTag: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(42.dp)
            .clip(RoundedCornerShape(11.dp))
            .background(if (selected) MatchAqua else Color.Transparent)
            .clickable(onClick = onClick)
            .testTag(testTag),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = if (selected) MatchInk950 else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun SwipeDeckContent(
    deck: List<RvSummary>,
    canUndo: Boolean,
    isPrefetching: Boolean,
    onSwipeRight: (RvSummary) -> Unit,
    onSwipeLeft: (RvSummary) -> Unit,
    onUndo: () -> Unit,
    onCardTap: (RvSummary) -> Unit
) {
    val topCard = deck.first()
    val nextCard = deck.getOrNull(1)
    val scope = rememberCoroutineScope()

    val offsetX = remember(topCard.unitId) { Animatable(0f) }
    val offsetY = remember(topCard.unitId) { Animatable(0f) }

    val swipeThreshold = 260f

    fun animateSwipeOut(toRight: Boolean) {
        scope.launch {
            val targetX = if (toRight) 1200f else -1200f
            offsetX.animateTo(targetX, animationSpec = tween(220))
            if (toRight) onSwipeRight(topCard) else onSwipeLeft(topCard)
        }
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            contentAlignment = Alignment.Center
        ) {
            // Stacked next card behind top card (draw-phase graphicsLayer avoids recomposing on drag)
            if (nextCard != null) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .offset(y = 10.dp)
                        .graphicsLayer {
                            val progress = (offsetX.value / swipeThreshold).coerceIn(-1f, 1f)
                            val nextScale = 0.94f + (0.06f * abs(progress))
                            scaleX = nextScale
                            scaleY = nextScale
                            alpha = 0.75f + 0.25f * abs(progress)
                        }
                ) {
                    RvSwipeCard(
                        rv = nextCard,
                        offsetXProvider = { 0f },
                        onTap = {}
                    )
                }
            }

            // Draggable top card (draw-phase graphicsLayer avoids recomposing on drag)
            key(topCard.unitId) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            translationX = offsetX.value
                            translationY = offsetY.value
                            rotationZ = offsetX.value / 32f
                        }
                        .pointerInput(topCard.unitId) {
                            detectDragGestures(
                                onDragEnd = {
                                    when {
                                        offsetX.value > swipeThreshold -> animateSwipeOut(true)
                                        offsetX.value < -swipeThreshold -> animateSwipeOut(false)
                                        else -> scope.launch {
                                            launch {
                                                offsetX.animateTo(
                                                    0f,
                                                    spring(
                                                        dampingRatio = Spring.DampingRatioMediumBouncy,
                                                        stiffness = Spring.StiffnessMedium
                                                    )
                                                )
                                            }
                                            launch {
                                                offsetY.animateTo(
                                                    0f,
                                                    spring(stiffness = Spring.StiffnessMedium)
                                                )
                                            }
                                        }
                                    }
                                },
                                onDragCancel = {
                                    scope.launch {
                                        offsetX.animateTo(0f, spring())
                                        offsetY.animateTo(0f, spring())
                                    }
                                },
                                onDrag = { change, dragAmount ->
                                    change.consume()
                                    scope.launch {
                                        offsetX.snapTo(offsetX.value + dragAmount.x)
                                        offsetY.snapTo((offsetY.value + dragAmount.y * 0.4f).coerceIn(-120f, 120f))
                                    }
                                }
                            )
                        }
                        .testTag("swipe_top_card")
                ) {
                    RvSwipeCard(
                        rv = topCard,
                        offsetXProvider = { offsetX.value },
                        onTap = { onCardTap(topCard) }
                    )
                }
            }
        }

        // Tactile Action Dock
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp, bottom = 14.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            DeckActionCircle(
                icon = Icons.Default.Replay,
                tint = if (canUndo) MatchAmber else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.35f),
                containerColor = MatchInk800,
                sizeDp = 50,
                enabled = canUndo,
                contentDescription = "Undo last pass",
                testTag = "deck_undo_button",
                onClick = onUndo
            )

            DeckActionCircle(
                icon = Icons.Default.Close,
                tint = MatchPassCoral,
                containerColor = MatchPassCoral.copy(alpha = 0.14f),
                borderColor = MatchPassCoral.copy(alpha = 0.45f),
                sizeDp = 64,
                enabled = true,
                contentDescription = "Pass on RV",
                testTag = "deck_pass_button",
                onClick = { animateSwipeOut(false) }
            )

            DeckActionCircle(
                icon = Icons.Default.Info,
                tint = MaterialTheme.colorScheme.onSurface,
                containerColor = MatchInk800,
                sizeDp = 52,
                enabled = true,
                contentDescription = "Inspect RV details",
                testTag = "deck_detail_button",
                onClick = { onCardTap(topCard) }
            )

            DeckActionCircle(
                icon = Icons.Default.Favorite,
                tint = MatchInk950,
                containerColor = MatchAqua,
                sizeDp = 64,
                enabled = true,
                contentDescription = "Save RV",
                testTag = "deck_save_button",
                onClick = { animateSwipeOut(true) }
            )
        }

        if (isPrefetching) {
            Text(
                text = "Prefetching next batch...",
                style = MaterialTheme.typography.labelSmall,
                color = MatchAqua.copy(alpha = 0.8f),
                modifier = Modifier.padding(bottom = 6.dp)
            )
        }
    }
}

@Composable
private fun DeckActionCircle(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    tint: Color,
    containerColor: Color,
    borderColor: Color = MatchInk700,
    sizeDp: Int,
    enabled: Boolean,
    contentDescription: String,
    testTag: String,
    onClick: () -> Unit
) {
    Surface(
        shape = CircleShape,
        color = containerColor,
        border = BorderStroke(1.dp, borderColor),
        shadowElevation = 6.dp,
        modifier = Modifier
            .size(sizeDp.dp)
            .clip(CircleShape)
            .clickable(enabled = enabled, onClick = onClick)
            .testTag(testTag)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = tint,
                modifier = Modifier.size((sizeDp * 0.44f).dp)
            )
        }
    }
}

@Composable
fun RvSwipeCard(
    rv: RvSummary,
    offsetXProvider: () -> Float = { 0f },
    onTap: () -> Unit
) {
    val context = LocalContext.current
    val imageRequest = remember(rv.thumbnailUrl) {
        rv.thumbnailUrl?.takeIf { it.isNotBlank() }?.let { url ->
            ImageRequest.Builder(context)
                .data(url)
                .crossfade(true)
                .build()
        }
    }

    Card(
        shape = RoundedCornerShape(26.dp),
        colors = CardDefaults.cardColors(containerColor = MatchInk850),
        border = BorderStroke(1.dp, MatchInk700),
        elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
        modifier = Modifier
            .fillMaxSize()
            .clickable(onClick = onTap)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Always render dark-blueprint placeholder underneath; AsyncImage avoids subcomposition overhead
            RvPhotoPlaceholder(rv)
            if (imageRequest != null) {
                AsyncImage(
                    model = imageRequest,
                    contentDescription = rv.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            }

            // Deep editorial gradient scrim for crisp legibility
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            0.0f to MatchInk950.copy(alpha = 0.55f),
                            0.35f to Color.Transparent,
                            0.55f to MatchInk950.copy(alpha = 0.45f),
                            1.0f to MatchInk950.copy(alpha = 0.96f)
                        )
                    )
            )

            // Top badge bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (!rv.rvType.isNullOrBlank()) {
                        CardBadgePill(
                            text = RvTypeOption.displayNameFor(rv.rvType),
                            bg = MatchInk950.copy(alpha = 0.78f),
                            fg = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    if (!rv.condition.isNullOrBlank() && rv.condition != "unknown") {
                        CardBadgePill(
                            text = rv.condition.uppercase(),
                            bg = MatchInk950.copy(alpha = 0.78f),
                            fg = MatchAmber
                        )
                    }
                }

                if (rv.matchScore != null && rv.matchScore > 0) {
                    CardBadgePill(
                        text = "${rv.matchScore}% FIT",
                        bg = MatchAqua.copy(alpha = 0.92f),
                        fg = MatchInk950
                    )
                }
            }

            // Live SAVE / PASS gesture stamps driven in draw phase
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(top = 74.dp, start = 24.dp)
                    .graphicsLayer {
                        val a = (offsetXProvider() / 180f).coerceIn(0f, 1f)
                        alpha = if (a > 0.05f) a else 0f
                        rotationZ = -14f
                    }
                    .border(3.dp, MatchAqua, RoundedCornerShape(12.dp))
                    .background(MatchInk950.copy(alpha = 0.65f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 16.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "SAVE",
                    style = MaterialTheme.typography.headlineMedium,
                    color = MatchAqua
                )
            }

            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 74.dp, end = 24.dp)
                    .graphicsLayer {
                        val a = (-offsetXProvider() / 180f).coerceIn(0f, 1f)
                        alpha = if (a > 0.05f) a else 0f
                        rotationZ = 14f
                    }
                    .border(3.dp, MatchPassCoral, RoundedCornerShape(12.dp))
                    .background(MatchInk950.copy(alpha = 0.65f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 16.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "PASS",
                    style = MaterialTheme.typography.headlineMedium,
                    color = MatchPassCoral
                )
            }

            // Bottom RV metadata stack
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = RvFormatters.price(rv.priceUsd),
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontFamily = MaterialTheme.typography.labelMedium.fontFamily
                        ),
                        color = MatchAqua
                    )
                    if (rv.verified) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                            modifier = Modifier.padding(bottom = 4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Verified,
                                contentDescription = "Verified dealer listing",
                                tint = MatchAqua,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = "Listed Price",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                Text(
                    text = rv.title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                // Key specs strip
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RvFormatters.length(rv.lengthFt)?.let { SpecMiniPill(it) }
                    rv.sleeps?.takeIf { it > 0 }?.let { SpecMiniPill("Sleeps $it") }
                    RvFormatters.weight(rv.dryWeightLbs ?: rv.gvwrLbs)?.let {
                        val label = if (rv.dryWeightLbs != null) "$it dry" else "$it GVWR"
                        SpecMiniPill(label)
                    }
                }

                // Dealer & location
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = MatchAmber,
                        modifier = Modifier.size(16.dp)
                    )
                    val distanceText = RvFormatters.distance(rv.distanceMi)?.let { " • $it" }.orEmpty()
                    Text(
                        text = "${rv.dealer.ifBlank { "Authorized RV Dealer" }}$distanceText",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Text(
                    text = "Tap card for full specs, tow-fit & dealer inquiry",
                    style = MaterialTheme.typography.labelSmall,
                    color = MatchAqua.copy(alpha = 0.85f)
                )
            }
        }
    }
}

@Composable
private fun RvPhotoPlaceholder(rv: RvSummary) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(MatchInk800, MatchInk900, MatchInk950)
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(24.dp)
        ) {
            Icon(
                imageVector = Icons.Default.RvHookup,
                contentDescription = null,
                tint = MatchAqua.copy(alpha = 0.4f),
                modifier = Modifier.size(64.dp)
            )
            if (!rv.isHydrated) {
                Text(
                    text = "Loading dealer photos...",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun CardBadgePill(text: String, bg: Color, fg: Color) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = bg
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
            color = fg,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
        )
    }
}

@Composable
private fun SpecMiniPill(text: String) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MatchInk800.copy(alpha = 0.9f),
        border = BorderStroke(1.dp, MatchInk700)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = Color.White,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun GridBrowseContent(
    units: List<RvSummary>,
    isPrefetching: Boolean,
    onCardTap: (RvSummary) -> Unit,
    onQuickSave: (RvSummary) -> Unit,
    onLoadMore: () -> Unit
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 165.dp),
        contentPadding = PaddingValues(bottom = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxSize()
            .testTag("rv_grid_list")
    ) {
        items(units, key = { it.unitId }) { rv ->
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MatchInk850),
                border = BorderStroke(1.dp, MatchInk700),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onCardTap(rv) }
                    .testTag("grid_rv_card_${rv.unitId}")
            ) {
                Column {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1.35f)
                            .background(MatchInk800)
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.RvHookup,
                                contentDescription = null,
                                tint = MatchAqua.copy(alpha = 0.4f),
                                modifier = Modifier.size(36.dp)
                            )
                        }
                        if (!rv.thumbnailUrl.isNullOrBlank()) {
                            AsyncImage(
                                model = rv.thumbnailUrl,
                                contentDescription = rv.title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }

                        Surface(
                            shape = CircleShape,
                            color = MatchInk950.copy(alpha = 0.8f),
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(8.dp)
                                .size(38.dp)
                                .clickable { onQuickSave(rv) }
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Favorite,
                                    contentDescription = "Save RV",
                                    tint = MatchAqua,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }

                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = RvFormatters.price(rv.priceUsd),
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontFamily = MaterialTheme.typography.labelMedium.fontFamily
                            ),
                            color = MatchAqua
                        )
                        Text(
                            text = rv.title,
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                        val quickSpecs = listOfNotNull(
                            RvFormatters.length(rv.lengthFt),
                            rv.sleeps?.let { "Sleeps $it" }
                        ).joinToString(" • ")
                        if (quickSpecs.isNotBlank()) {
                            Text(
                                text = quickSpecs,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Text(
                            text = rv.dealer.ifBlank { rv.dealerState },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }

        item(span = { GridItemSpan(maxLineSpan) }) {
            OutlinedButton(
                onClick = onLoadMore,
                enabled = !isPrefetching,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
                    .height(48.dp)
            ) {
                if (isPrefetching) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = MatchAqua)
                    Spacer(Modifier.width(8.dp))
                    Text("Loading more dealer units...")
                } else {
                    Text("Load More Matching RVs")
                }
            }
        }
    }
}
