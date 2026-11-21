package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Style
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.ai.AiCuratedDeckResult
import com.example.data.model.RvSearchFilter
import com.example.data.model.RvSummary
import com.example.ui.AskAiUiState
import com.example.ui.theme.MatchAmber
import com.example.ui.theme.MatchAqua
import com.example.ui.theme.MatchInk700
import com.example.ui.theme.MatchInk800
import com.example.ui.theme.MatchInk850
import com.example.ui.theme.MatchInk900
import com.example.ui.theme.MatchInk950
import com.example.ui.theme.MatchPassCoral

private val STARTER_PROMPTS = listOf(
    "Class C under $60k within 200 miles of Austin, TX with a slide-out",
    "Lightweight bunkhouse travel trailer under 28 ft with solar",
    "Used Class A diesel under $150k in Florida",
    "Couples fifth wheel under $75k with outdoor kitchen"
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AskAiScreen(
    state: AskAiUiState,
    onRunSearch: (String) -> Unit,
    onOpenInDiscover: (AiCuratedDeckResult) -> Unit,
    onSaveSearchAlert: (RvSearchFilter) -> Unit,
    onCardTap: (RvSummary) -> Unit,
    onDeckDecision: (RvSummary, Boolean) -> Unit
) {
    var promptText by rememberSaveable { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MatchInk900),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = MatchAqua
                    )
                    Text(
                        text = "Ask MatchRV AI",
                        style = MaterialTheme.typography.headlineLarge,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                }
                Text(
                    text = "Describe your ideal RV, budget, tow vehicle, or location. MatchRV translates your needs into a live MCP search and builds a curated swipe deck.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        item {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MatchInk850),
                border = BorderStroke(1.dp, MatchInk700)
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = promptText,
                        onValueChange = { promptText = it.take(280) },
                        placeholder = {
                            Text("e.g. Class C under $60k within 200 miles with a slide-out")
                        },
                        minLines = 2,
                        maxLines = 4,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MatchAqua,
                            unfocusedBorderColor = MatchInk700
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("ask_ai_input")
                    )

                    Button(
                        onClick = {
                            if (promptText.isNotBlank()) onRunSearch(promptText)
                        },
                        enabled = promptText.isNotBlank() && state !is AskAiUiState.Loading,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MatchAqua,
                            contentColor = MatchInk950
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .testTag("ask_ai_submit_button")
                    ) {
                        if (state is AskAiUiState.Loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MatchInk950,
                                strokeWidth = 2.dp
                            )
                            Spacer(Modifier.width(10.dp))
                            Text("Curating live dealer RVs...", fontWeight = FontWeight.Bold)
                        } else {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Curate My Swipe Deck", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        if (state is AskAiUiState.Idle) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Try asking:",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    STARTER_PROMPTS.forEach { sample ->
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = MatchInk800,
                            border = BorderStroke(1.dp, MatchInk700),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    promptText = sample
                                    onRunSearch(sample)
                                }
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = null,
                                    tint = MatchAmber,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = sample,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }
            }
        }

        if (state is AskAiUiState.Error) {
            item {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MatchPassCoral.copy(alpha = 0.14f),
                    border = BorderStroke(1.dp, MatchPassCoral.copy(alpha = 0.4f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = state.message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MatchPassCoral,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        }

        if (state is AskAiUiState.Success) {
            val res = state.result
            item {
                Card(
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MatchInk850),
                    border = BorderStroke(1.dp, MatchAqua.copy(alpha = 0.35f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = res.agentSummary,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface
                        )

                        if (res.appliedCriteriaChips.isNotEmpty()) {
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                res.appliedCriteriaChips.forEach { chip ->
                                    AssistChip(
                                        onClick = {},
                                        label = { Text(chip, style = MaterialTheme.typography.labelSmall) },
                                        colors = AssistChipDefaults.assistChipColors(
                                            containerColor = MatchInk800,
                                            labelColor = MatchAqua
                                        )
                                    )
                                }
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MatchAmber.copy(alpha = 0.12f)
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Lightbulb,
                                    contentDescription = null,
                                    tint = MatchAmber,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = res.outfitterTip,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = { onOpenInDiscover(res) },
                                enabled = res.curatedDeck.isNotEmpty(),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MatchAqua,
                                    contentColor = MatchInk950
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .testTag("ai_open_discover_button")
                            ) {
                                Icon(Icons.Default.Style, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Swipe Full Deck", fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(
                                onClick = { onSaveSearchAlert(res.appliedFilter) },
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .height(48.dp)
                                    .testTag("ai_save_alert_button")
                            ) {
                                Icon(Icons.Default.NotificationsActive, contentDescription = "Save alert", tint = MatchAqua)
                            }
                        }
                    }
                }
            }

            if (res.curatedDeck.isEmpty()) {
                item {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = MatchInk850,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "No live dealer units matched every strict constraint. Try increasing your budget or search radius.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
            } else {
                val topCurated = res.curatedDeck.first()
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = "Agent-Curated Picks (${res.curatedDeck.size} ready)",
                            style = MaterialTheme.typography.titleMedium,
                            color = MatchAqua
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(420.dp)
                        ) {
                            RvSwipeCard(
                                rv = topCurated,
                                onTap = { onCardTap(topCurated) }
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OutlinedButton(
                                onClick = { onDeckDecision(topCurated, false) },
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .testTag("ai_card_pass_button")
                            ) {
                                Icon(Icons.Default.Close, contentDescription = null, tint = MatchPassCoral)
                                Spacer(Modifier.width(6.dp))
                                Text("Pass", color = MatchPassCoral)
                            }
                            Button(
                                onClick = { onDeckDecision(topCurated, true) },
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MatchAqua,
                                    contentColor = MatchInk950
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .testTag("ai_card_save_button")
                            ) {
                                Icon(Icons.Default.Favorite, contentDescription = null)
                                Spacer(Modifier.width(6.dp))
                                Text("Save RV", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
