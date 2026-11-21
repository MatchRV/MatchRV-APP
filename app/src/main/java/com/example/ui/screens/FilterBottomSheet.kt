package com.example.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.model.RvConditionOption
import com.example.data.model.RvFeatureOption
import com.example.data.model.RvSearchFilter
import com.example.data.model.RvSortOption
import com.example.data.model.RvTypeOption
import com.example.ui.theme.MatchAqua
import com.example.ui.theme.MatchInk700
import com.example.ui.theme.MatchInk850
import com.example.ui.theme.MatchInk950
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FilterBottomSheet(
    currentFilter: RvSearchFilter,
    onDismiss: () -> Unit,
    onApply: (RvSearchFilter) -> Unit,
    onSaveAlert: (RvSearchFilter) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var selectedTypes by remember(currentFilter) { mutableStateOf(currentFilter.rvTypes) }
    var priceMinText by remember(currentFilter) {
        mutableStateOf(currentFilter.priceMinUsd?.toInt()?.toString().orEmpty())
    }
    var priceMaxText by remember(currentFilter) {
        mutableStateOf(currentFilter.priceMaxUsd?.toInt()?.toString().orEmpty())
    }
    var location by remember(currentFilter) { mutableStateOf(currentFilter.location) }
    var radiusMiles by remember(currentFilter) { mutableStateOf(currentFilter.radiusMiles?.toFloat() ?: 200f) }
    var condition by remember(currentFilter) { mutableStateOf(currentFilter.condition) }
    var sleepsMin by remember(currentFilter) { mutableStateOf(currentFilter.sleepsMin ?: 0) }
    var lengthMaxFt by remember(currentFilter) { mutableStateOf(currentFilter.lengthMaxFt?.toFloat() ?: 0f) }
    var towVehicle by remember(currentFilter) { mutableStateOf(currentFilter.towVehicle) }
    var towRatingText by remember(currentFilter) {
        mutableStateOf(currentFilter.truckTowRatingLbs?.toInt()?.toString().orEmpty())
    }
    var selectedFeatures by remember(currentFilter) { mutableStateOf(currentFilter.desiredFeatures) }
    var sortOption by remember(currentFilter) { mutableStateOf(currentFilter.sort) }

    fun buildFilter(): RvSearchFilter {
        val minPrice = priceMinText.toDoubleOrNull()?.takeIf { it > 0.0 }
        val maxPrice = priceMaxText.toDoubleOrNull()?.takeIf { it > 0.0 }
        val towRating = towRatingText.toDoubleOrNull()?.takeIf { it >= 1000.0 }
        return RvSearchFilter(
            rvTypes = selectedTypes,
            priceMinUsd = minPrice,
            priceMaxUsd = maxPrice,
            location = location.trim(),
            radiusMiles = if (location.isNotBlank()) radiusMiles.toDouble() else null,
            condition = condition,
            sleepsMin = sleepsMin.takeIf { it > 0 },
            lengthMaxFt = lengthMaxFt.takeIf { it >= 12f }?.toDouble(),
            towVehicle = towVehicle.trim(),
            truckTowRatingLbs = towRating,
            desiredFeatures = selectedFeatures,
            sort = sortOption
        )
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MatchInk850,
        contentColor = MaterialTheme.colorScheme.onSurface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Filter Dealer Inventory",
                    style = MaterialTheme.typography.headlineMedium
                )
                TextButton(
                    onClick = {
                        selectedTypes = emptySet()
                        priceMinText = ""
                        priceMaxText = ""
                        location = ""
                        radiusMiles = 200f
                        condition = RvConditionOption.ANY
                        sleepsMin = 0
                        lengthMaxFt = 0f
                        towVehicle = ""
                        towRatingText = ""
                        selectedFeatures = emptySet()
                        sortOption = RvSortOption.BEST_MATCH
                    },
                    modifier = Modifier.testTag("filter_reset_button")
                ) {
                    Text("Reset", color = MatchAqua)
                }
            }

            // RV Types
            FilterSectionLabel("RV Type")
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                RvTypeOption.entries.forEach { option ->
                    val isSelected = option in selectedTypes
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            selectedTypes = if (isSelected) selectedTypes - option else selectedTypes + option
                        },
                        label = { Text(option.displayLabel) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MatchAqua,
                            selectedLabelColor = MatchInk950
                        ),
                        modifier = Modifier.testTag("filter_type_${option.wireValue}")
                    )
                }
            }

            // Price Range
            FilterSectionLabel("Price Range (USD)")
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = priceMinText,
                    onValueChange = { priceMinText = it.filter(Char::isDigit).take(7) },
                    label = { Text("Min $") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier
                        .weight(1f)
                        .testTag("filter_price_min_input")
                )
                OutlinedTextField(
                    value = priceMaxText,
                    onValueChange = { priceMaxText = it.filter(Char::isDigit).take(7) },
                    label = { Text("Max $") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier
                        .weight(1f)
                        .testTag("filter_price_max_input")
                )
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(30000 to "Under $30k", 60000 to "Under $60k", 100000 to "Under $100k").forEach { (valUsd, label) ->
                    FilterChip(
                        selected = priceMaxText == valUsd.toString(),
                        onClick = { priceMaxText = valUsd.toString() },
                        label = { Text(label) }
                    )
                }
            }

            // Location & Radius
            FilterSectionLabel("Location & Radius")
            OutlinedTextField(
                value = location,
                onValueChange = { location = it.take(80) },
                label = { Text("City, State, or ZIP (e.g. Austin, TX)") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("filter_location_input")
            )
            if (location.isNotBlank()) {
                Column {
                    Text(
                        text = "Search radius: ${radiusMiles.roundToInt()} miles",
                        style = MaterialTheme.typography.labelMedium,
                        color = MatchAqua
                    )
                    Slider(
                        value = radiusMiles,
                        onValueChange = { radiusMiles = it },
                        valueRange = 25f..1000f,
                        colors = SliderDefaults.colors(thumbColor = MatchAqua, activeTrackColor = MatchAqua)
                    )
                }
            }

            // Condition
            FilterSectionLabel("Condition")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RvConditionOption.entries.forEach { opt ->
                    FilterChip(
                        selected = condition == opt,
                        onClick = { condition = opt },
                        label = { Text(opt.displayLabel) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MatchAqua,
                            selectedLabelColor = MatchInk950
                        )
                    )
                }
            }

            // Sleeps & Max Length
            FilterSectionLabel("Minimum Sleeps: ${if (sleepsMin == 0) "Any" else "$sleepsMin+"}")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(0 to "Any", 2 to "2+", 4 to "4+", 6 to "6+", 8 to "8+").forEach { (num, label) ->
                    FilterChip(
                        selected = sleepsMin == num,
                        onClick = { sleepsMin = num },
                        label = { Text(label) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MatchAqua,
                            selectedLabelColor = MatchInk950
                        )
                    )
                }
            }

            Column {
                val lenLabel = if (lengthMaxFt < 12f) "Max Length: Any" else "Max Length: ${lengthMaxFt.roundToInt()} ft"
                FilterSectionLabel(lenLabel)
                Slider(
                    value = lengthMaxFt,
                    onValueChange = { lengthMaxFt = it },
                    valueRange = 0f..45f,
                    colors = SliderDefaults.colors(thumbColor = MatchAqua, activeTrackColor = MatchAqua)
                )
            }

            // Tow Capacity
            FilterSectionLabel("Tow Vehicle & Rating (Optional)")
            OutlinedTextField(
                value = towVehicle,
                onValueChange = { towVehicle = it.take(120) },
                label = { Text("Tow vehicle (e.g. 2023 Ford F-150 3.5L)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = towRatingText,
                onValueChange = { towRatingText = it.filter(Char::isDigit).take(5) },
                label = { Text("Max tow rating (lbs)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth()
            )

            // Desired Features
            FilterSectionLabel("Preferred Features")
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                RvFeatureOption.entries.forEach { feat ->
                    val isSelected = feat in selectedFeatures
                    FilterChip(
                        selected = isSelected,
                        onClick = {
                            selectedFeatures = if (isSelected) selectedFeatures - feat else selectedFeatures + feat
                        },
                        label = { Text(feat.displayLabel) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MatchAqua,
                            selectedLabelColor = MatchInk950
                        )
                    )
                }
            }

            // Sort
            FilterSectionLabel("Sort By (Includes Newest Model Year)")
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                RvSortOption.entries.forEach { opt ->
                    FilterChip(
                        selected = sortOption == opt,
                        onClick = { sortOption = opt },
                        label = { Text(opt.displayLabel) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MatchAqua,
                            selectedLabelColor = MatchInk950
                        )
                    )
                }
            }

            HorizontalDivider(color = MatchInk700)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        val f = buildFilter()
                        onSaveAlert(f)
                    },
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .testTag("filter_save_alert_button")
                ) {
                    Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = MatchAqua)
                    Spacer(Modifier.width(6.dp))
                    Text("Save Alert")
                }

                Button(
                    onClick = {
                        onApply(buildFilter())
                        onDismiss()
                    },
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MatchAqua,
                        contentColor = MatchInk950
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp)
                        .testTag("filter_apply_button")
                ) {
                    Text("Apply Filters", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun FilterSectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}
