package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.MarkEmailRead
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.model.DealerInquiryRecord
import com.example.ui.UiState
import com.example.ui.components.RvFormatters
import com.example.ui.theme.MatchAqua
import com.example.ui.theme.MatchInk700
import com.example.ui.theme.MatchInk800
import com.example.ui.theme.MatchInk850
import com.example.ui.theme.MatchInk900
import com.example.ui.theme.MatchPassCoral

@Composable
fun InquiriesScreen(
    state: UiState<List<DealerInquiryRecord>>,
    refreshingInquiryId: String?,
    onRefreshStatus: (DealerInquiryRecord) -> Unit,
    onOpenRv: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MatchInk900)
            .padding(horizontal = 16.dp)
    ) {
        Text(
            text = "Dealer Inquiries",
            style = MaterialTheme.typography.headlineLarge,
            modifier = Modifier.padding(top = 12.dp, bottom = 4.dp)
        )
        Text(
            text = "Live delivery status and dealership replies synced with MatchRV.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 12.dp)
        )

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
                val inquiries = state.data
                if (inquiries.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.padding(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.MarkEmailRead,
                                contentDescription = null,
                                tint = MatchAqua,
                                modifier = Modifier.size(48.dp)
                            )
                            Text(
                                text = "No inquiries sent yet",
                                style = MaterialTheme.typography.titleLarge
                            )
                            Text(
                                text = "Tap any RV card to inspect full specs and send a verified dealer inquiry. You'll preview everything before it sends.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(inquiries, key = { it.id }) { inquiry ->
                            val statusColor = RvFormatters.inquiryStatusColor(inquiry.status)
                            val isRefreshing = refreshingInquiryId == inquiry.id

                            Card(
                                shape = RoundedCornerShape(18.dp),
                                colors = CardDefaults.cardColors(containerColor = MatchInk850),
                                border = BorderStroke(1.dp, MatchInk700),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            color = statusColor.copy(alpha = 0.16f)
                                        ) {
                                            Text(
                                                text = RvFormatters.inquiryStatusLabel(inquiry.status),
                                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                                color = statusColor,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                            )
                                        }
                                        Text(
                                            text = "ID: ${inquiry.mcpInquiryId.take(12)}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }

                                    Text(
                                        text = inquiry.rvTitle,
                                        style = MaterialTheme.typography.titleLarge
                                    )

                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Storefront,
                                            contentDescription = null,
                                            tint = MatchAqua,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        val loc = inquiry.dealerLocation?.let { " • $it" }.orEmpty()
                                        Text(
                                            text = "${inquiry.dealerName}$loc",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = MatchInk800
                                    ) {
                                        Text(
                                            text = "\"${inquiry.message}\"",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurface,
                                            modifier = Modifier.padding(12.dp)
                                        )
                                    }

                                    if (!inquiry.dealerReply.isNullOrBlank()) {
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = MatchAqua.copy(alpha = 0.12f),
                                            border = BorderStroke(1.dp, MatchAqua.copy(alpha = 0.35f))
                                        ) {
                                            Column(
                                                modifier = Modifier.padding(12.dp),
                                                verticalArrangement = Arrangement.spacedBy(4.dp)
                                            ) {
                                                Text(
                                                    text = "Dealer Reply",
                                                    style = MaterialTheme.typography.labelMedium,
                                                    color = MatchAqua
                                                )
                                                Text(
                                                    text = inquiry.dealerReply,
                                                    style = MaterialTheme.typography.bodyMedium
                                                )
                                            }
                                        }
                                    }

                                    HorizontalDivider(color = MatchInk700)

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        OutlinedButton(
                                            onClick = { onRefreshStatus(inquiry) },
                                            enabled = !isRefreshing,
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier
                                                .weight(1f)
                                                .height(48.dp)
                                                .testTag("refresh_inquiry_${inquiry.id}")
                                        ) {
                                            if (isRefreshing) {
                                                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MatchAqua)
                                            } else {
                                                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                                            }
                                            Spacer(Modifier.width(6.dp))
                                            Text("Refresh Status")
                                        }
                                        OutlinedButton(
                                            onClick = { onOpenRv(inquiry.unitId) },
                                            shape = RoundedCornerShape(12.dp),
                                            modifier = Modifier.height(48.dp)
                                        ) {
                                            Text("View RV")
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
}
