package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CompareArrows
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RvHookup
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.data.model.RvSearchFilter
import com.example.data.model.SavedRvRecord
import com.example.data.model.SavedSearchAlertRecord
import com.example.ui.CompareUiState
import com.example.ui.UiState
import com.example.ui.components.RvFormatters
import com.example.ui.theme.MatchAmber
import com.example.ui.theme.MatchAqua
import com.example.ui.theme.MatchInk700
import com.example.ui.theme.MatchInk800
import com.example.ui.theme.MatchInk850
import com.example.ui.theme.MatchInk900
import com.example.ui.theme.MatchInk950
import com.example.ui.theme.MatchPassCoral

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedScreen(
    savedRvsState: UiState<List<SavedRvRecord>>,
    savedAlertsState: UiState<List<SavedSearchAlertRecord>>,
    compareState: CompareUiState,
    isRefreshingPrices: Boolean,
    isRefreshingAlerts: Boolean,
    onOpenDetail: (SavedRvRecord) -> Unit,
    onRemoveSaved: (String) -> Unit,
    onRefreshPrices: () -> Unit,
    onToggleCompare: (String) -> Unit,
    onRunCompare: () -> Unit,
    onClearCompare: () -> Unit,
    onToggleAlert: (String, Boolean) -> Unit,
    onDeleteAlert: (String) -> Unit,
    onCheckAlertsNow: () -> Unit,
    onApplyAlertFilter: (RvSearchFilter) -> Unit
) {
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MatchInk900)
            .padding(horizontal = 16.dp)
    ) {
        SingleChoiceSegmentedButtonRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp)
        ) {
            SegmentedButton(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                shape = SegmentedButtonDefaults.itemShape(0, 2),
                modifier = Modifier.testTag("saved_tab_rvs")
            ) {
                val count = (savedRvsState as? UiState.Success)?.data?.size ?: 0
                Text("Saved RVs ($count)")
            }
            SegmentedButton(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                shape = SegmentedButtonDefaults.itemShape(1, 2),
                modifier = Modifier.testTag("saved_tab_alerts")
            ) {
                val count = (savedAlertsState as? UiState.Success)?.data?.size ?: 0
                Text("Search Alerts ($count)")
            }
        }

        if (selectedTab == 0) {
            SavedRvsTabContent(
                state = savedRvsState,
                compareState = compareState,
                isRefreshingPrices = isRefreshingPrices,
                onOpenDetail = onOpenDetail,
                onRemoveSaved = onRemoveSaved,
                onRefreshPrices = onRefreshPrices,
                onToggleCompare = onToggleCompare,
                onRunCompare = onRunCompare
            )
        } else {
            SavedAlertsTabContent(
                state = savedAlertsState,
                isRefreshingAlerts = isRefreshingAlerts,
                onToggleAlert = onToggleAlert,
                onDeleteAlert = onDeleteAlert,
                onCheckAlertsNow = onCheckAlertsNow,
                onApplyAlertFilter = onApplyAlertFilter
            )
        }
    }

    // Side-by-side compare modal sheet (compare_rvs MCP tool)
    if (compareState.result != null || compareState.errorMessage != null) {
        ModalBottomSheet(
            onDismissRequest = onClearCompare,
            containerColor = MatchInk850
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "MatchRV Side-by-Side Compare",
                    style = MaterialTheme.typography.headlineMedium,
                    color = MatchAqua
                )
                if (compareState.errorMessage != null) {
                    Text(
                        text = compareState.errorMessage,
                        color = MatchPassCoral,
                        style = MaterialTheme.typography.bodyMedium
                    )
                } else if (compareState.result != null) {
                    Text(
                        text = compareState.result.summaryText,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    compareState.result.rows.forEach { item ->
                        Card(
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = MatchInk800)
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(item.title, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    text = listOfNotNull(
                                        RvFormatters.price(item.priceUsd),
                                        RvFormatters.length(item.lengthFt),
                                        item.sleeps?.let { "Sleeps $it" },
                                        RvFormatters.weight(item.dryWeightLbs ?: item.gvwrLbs)
                                    ).joinToString(" • "),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MatchAqua
                                )
                                Text(
                                    text = item.dealer,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SavedRvsTabContent(
    state: UiState<List<SavedRvRecord>>,
    compareState: CompareUiState,
    isRefreshingPrices: Boolean,
    onOpenDetail: (SavedRvRecord) -> Unit,
    onRemoveSaved: (String) -> Unit,
    onRefreshPrices: () -> Unit,
    onToggleCompare: (String) -> Unit,
    onRunCompare: () -> Unit
) {
    when (state) {
        is UiState.Loading -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MatchAqua)
            }
        }
        is UiState.Error -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(state.message, color = MatchPassCoral)
            }
        }
        is UiState.Success -> {
            val items = state.data
            if (items.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.FavoriteBorder,
                            contentDescription = null,
                            tint = MatchAqua,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "No saved RVs yet",
                            style = MaterialTheme.typography.titleLarge
                        )
                        Text(
                            text = "Swipe right on any RV in Discover to save it here, compare specs side-by-side, and monitor price drops.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = onRefreshPrices,
                        enabled = !isRefreshingPrices,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("check_price_drops_button")
                    ) {
                        if (isRefreshingPrices) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MatchAqua)
                        } else {
                            Icon(Icons.Default.TrendingDown, contentDescription = null, tint = MatchAmber)
                        }
                        Spacer(Modifier.width(6.dp))
                        Text("Check Drops")
                    }

                    Button(
                        onClick = onRunCompare,
                        enabled = compareState.selectedUnitIds.size in 2..4 && !compareState.isComparing,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MatchAqua,
                            contentColor = MatchInk950
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("compare_selected_button")
                    ) {
                        if (compareState.isComparing) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MatchInk950)
                        } else {
                            Icon(Icons.Default.CompareArrows, contentDescription = null)
                        }
                        Spacer(Modifier.width(6.dp))
                        Text("Compare (${compareState.selectedUnitIds.size})")
                    }
                }

                LazyColumn(
                    contentPadding = PaddingValues(bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(items, key = { it.id }) { rv ->
                        val selected = rv.unitId in compareState.selectedUnitIds
                        Card(
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = MatchInk850),
                            border = BorderStroke(
                                1.dp,
                                if (rv.hasPriceDrop) MatchAmber else if (selected) MatchAqua else MatchInk700
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onOpenDetail(rv) }
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(84.dp)
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(MatchInk800),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.RvHookup,
                                        contentDescription = null,
                                        tint = MatchAqua.copy(alpha = 0.45f)
                                    )
                                    if (!rv.imageUrl.isNullOrBlank()) {
                                        AsyncImage(
                                            model = rv.imageUrl,
                                            contentDescription = rv.title,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize()
                                        )
                                    }
                                }

                                Column(
                                    modifier = Modifier.weight(1f),
                                    verticalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = RvFormatters.price(
                                                if (rv.lastCheckedPriceUsd > 0) rv.lastCheckedPriceUsd else rv.savedPriceUsd
                                            ),
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontFamily = MaterialTheme.typography.labelMedium.fontFamily
                                            ),
                                            color = MatchAqua
                                        )
                                        if (rv.hasPriceDrop) {
                                            Surface(
                                                color = MatchAmber.copy(alpha = 0.2f),
                                                shape = RoundedCornerShape(6.dp)
                                            ) {
                                                Text(
                                                    text = "DROP ${RvFormatters.price(rv.priceDropAmountUsd())}",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = MatchAmber,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }
                                    Text(
                                        text = rv.title,
                                        style = MaterialTheme.typography.titleSmall,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = rv.dealerName.ifBlank { rv.dealerState },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Checkbox(
                                        checked = selected,
                                        onCheckedChange = { onToggleCompare(rv.unitId) },
                                        colors = CheckboxDefaults.colors(checkedColor = MatchAqua)
                                    )
                                    IconButton(
                                        onClick = { onRemoveSaved(rv.id) },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.DeleteOutline,
                                            contentDescription = "Remove saved RV",
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SavedAlertsTabContent(
    state: UiState<List<SavedSearchAlertRecord>>,
    isRefreshingAlerts: Boolean,
    onToggleAlert: (String, Boolean) -> Unit,
    onDeleteAlert: (String) -> Unit,
    onCheckAlertsNow: () -> Unit,
    onApplyAlertFilter: (RvSearchFilter) -> Unit
) {
    when (state) {
        is UiState.Loading -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MatchAqua)
            }
        }
        is UiState.Error -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(state.message, color = MatchPassCoral)
            }
        }
        is UiState.Success -> {
            val alerts = state.data
            if (alerts.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.NotificationsNone,
                            contentDescription = null,
                            tint = MatchAqua,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "No saved search alerts",
                            style = MaterialTheme.typography.titleLarge
                        )
                        Text(
                            text = "Open Filters on the Discover screen or run an Ask AI search, then tap Save Alert to monitor new dealer matches.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                Button(
                    onClick = onCheckAlertsNow,
                    enabled = !isRefreshingAlerts,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MatchAqua,
                        contentColor = MatchInk950
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                        .height(48.dp)
                        .testTag("check_new_matches_button")
                ) {
                    if (isRefreshingAlerts) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = MatchInk950)
                        Spacer(Modifier.width(8.dp))
                        Text("Scanning live MatchRV inventory...")
                    } else {
                        Icon(Icons.Default.Refresh, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Check for New Matches Now", fontWeight = FontWeight.Bold)
                    }
                }

                LazyColumn(
                    contentPadding = PaddingValues(bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(alerts, key = { it.id }) { alert ->
                        Card(
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = MatchInk850),
                            border = BorderStroke(1.dp, MatchInk700),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.NotificationsActive,
                                            contentDescription = null,
                                            tint = if (alert.alertsEnabled) MatchAqua else MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                        Text(
                                            text = alert.label,
                                            style = MaterialTheme.typography.titleMedium,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Switch(
                                        checked = alert.alertsEnabled,
                                        onCheckedChange = { onToggleAlert(alert.id, it) },
                                        colors = SwitchDefaults.colors(checkedTrackColor = MatchAqua)
                                    )
                                }

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = "${alert.matchCount} active fits",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    if (alert.newMatchCount > 0) {
                                        Surface(
                                            color = MatchAqua.copy(alpha = 0.2f),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = "+${alert.newMatchCount} NEW",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MatchAqua,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                            )
                                        }
                                    }
                                }

                                HorizontalDivider(color = MatchInk700)

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    OutlinedButton(
                                        onClick = { onApplyAlertFilter(alert.toSearchFilter()) },
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Text("Open in Swipe Deck")
                                    }
                                    IconButton(
                                        onClick = { onDeleteAlert(alert.id) },
                                        modifier = Modifier.size(48.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.DeleteOutline,
                                            contentDescription = "Delete alert",
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
