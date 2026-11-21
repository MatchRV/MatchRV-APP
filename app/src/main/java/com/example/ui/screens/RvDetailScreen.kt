package com.example.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.PlayCircleOutline
import androidx.compose.material.icons.filled.RvHookup
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.data.model.DealerInquiryPreview
import com.example.data.model.RvDetail
import com.example.data.model.RvSummary
import com.example.data.model.RvTypeOption
import com.example.ui.DetailUiState
import com.example.ui.InquiryFlowState
import com.example.ui.components.RvFormatters
import com.example.ui.theme.MatchAmber
import com.example.ui.theme.MatchAqua
import com.example.ui.theme.MatchInk700
import com.example.ui.theme.MatchInk800
import com.example.ui.theme.MatchInk850
import com.example.ui.theme.MatchInk900
import com.example.ui.theme.MatchInk950
import com.example.ui.theme.MatchPassCoral

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun RvDetailScreen(
    state: DetailUiState,
    inquiryState: InquiryFlowState,
    defaultUserName: String,
    defaultUserEmail: String,
    onBack: () -> Unit,
    onSave: (RvSummary) -> Unit,
    onCheckTowFit: (String, Double?) -> Unit,
    onPrepareInquiry: (String, String, String?, String?, String) -> Unit,
    onConfirmSendInquiry: (DealerInquiryPreview, Boolean) -> Unit,
    onResetInquiry: () -> Unit
) {
    BackHandler(onBack = onBack)

    val context = LocalContext.current
    var showInquirySheet by rememberSaveable { mutableStateOf(false) }
    var towVehicleInput by rememberSaveable { mutableStateOf("") }
    var payloadInput by rememberSaveable { mutableStateOf("") }

    val detail = state.detail
    val title = detail?.title ?: state.summary?.title ?: "RV Listing"

    Scaffold(
        containerColor = MatchInk900,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = detail?.make ?: "RV Details",
                        style = MaterialTheme.typography.titleLarge
                    )
                },
                navigationIcon = {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.testTag("detail_back_button")
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MatchInk900,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        },
        bottomBar = {
            Surface(
                color = MatchInk850,
                tonalElevation = 8.dp,
                border = BorderStroke(1.dp, MatchInk700)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = {
                            val summary = state.summary ?: detail?.let {
                                RvSummary(
                                    unitId = it.unitId,
                                    title = it.title,
                                    make = it.make.orEmpty(),
                                    priceUsd = it.priceUsd,
                                    lengthFt = it.lengthFt,
                                    dryWeightLbs = it.dryWeightLbs,
                                    gvwrLbs = it.gvwrLbs,
                                    sleeps = it.sleeps,
                                    distanceMi = null,
                                    dealer = it.dealerName,
                                    dealerState = it.dealerState.orEmpty(),
                                    matchScore = null,
                                    verified = true,
                                    floorplan = it.floorplanCode,
                                    walkthroughUrl = it.walkthroughUrl,
                                    walkthroughLabel = it.walkthroughLabel,
                                    listingUrl = it.listingUrl,
                                    thumbnailUrl = it.images.firstOrNull(),
                                    rvType = it.rvType,
                                    condition = it.condition,
                                    year = it.year,
                                    isHydrated = true
                                )
                            }
                            if (summary != null) onSave(summary)
                        },
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .height(52.dp)
                            .testTag("detail_save_button")
                    ) {
                        Icon(Icons.Default.Favorite, contentDescription = "Save RV", tint = MatchAqua)
                    }

                    Button(
                        onClick = {
                            onResetInquiry()
                            showInquirySheet = true
                        },
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MatchAqua,
                            contentColor = MatchInk950
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                            .testTag("contact_dealer_button")
                    ) {
                        Icon(Icons.Default.MailOutline, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "Contact Dealer",
                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        if (state.isLoading && detail == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    CircularProgressIndicator(color = MatchAqua)
                    Text(
                        text = "Loading full verified RV record...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentPadding = PaddingValues(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Photo Gallery Pager
                item {
                    val photos = detail?.images?.takeIf { it.isNotEmpty() }
                        ?: listOfNotNull(state.summary?.thumbnailUrl)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1.45f)
                            .background(MatchInk800)
                    ) {
                        if (photos.isEmpty()) {
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.RvHookup,
                                    contentDescription = null,
                                    tint = MatchAqua.copy(alpha = 0.4f),
                                    modifier = Modifier.size(64.dp)
                                )
                            }
                        } else {
                            val pagerState = rememberPagerState(pageCount = { photos.size })
                            HorizontalPager(
                                state = pagerState,
                                modifier = Modifier.fillMaxSize()
                            ) { page ->
                                AsyncImage(
                                    model = photos[page],
                                    contentDescription = "$title photo ${page + 1}",
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            }
                            Surface(
                                shape = CircleShape,
                                color = MatchInk950.copy(alpha = 0.8f),
                                modifier = Modifier
                                    .align(Alignment.BottomEnd)
                                    .padding(12.dp)
                            ) {
                                Text(
                                    text = "${pagerState.currentPage + 1} / ${photos.size}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color.White,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }

                // Header: Price, Title, Dealer
                item {
                    Column(
                        modifier = Modifier.padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.Bottom,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = RvFormatters.price(detail?.priceUsd ?: state.summary?.priceUsd),
                                style = MaterialTheme.typography.displayMedium.copy(
                                    fontFamily = MaterialTheme.typography.labelMedium.fontFamily
                                ),
                                color = MatchAqua
                            )
                            detail?.msrpUsd?.takeIf { it > 0 }?.let { msrp ->
                                Text(
                                    text = "MSRP ${RvFormatters.price(msrp)}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(bottom = 4.dp)
                                )
                            }
                        }
                        Text(
                            text = "Last listed price • Confirm out-the-door pricing with dealer",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Text(
                            text = title,
                            style = MaterialTheme.typography.headlineMedium,
                            color = MaterialTheme.colorScheme.onBackground
                        )

                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            detail?.rvType?.let {
                                AssistChip(onClick = {}, label = { Text(RvTypeOption.displayNameFor(it)) })
                            }
                            detail?.condition?.takeIf { it != "unknown" }?.let {
                                AssistChip(onClick = {}, label = { Text(it.uppercase()) })
                            }
                            detail?.stockNumber?.let {
                                AssistChip(onClick = {}, label = { Text("Stock #$it") })
                            }
                            detail?.vin?.let {
                                AssistChip(onClick = {}, label = { Text("VIN ${it.takeLast(8)}") })
                            }
                        }

                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MatchInk850),
                            border = BorderStroke(1.dp, MatchInk700),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Storefront,
                                    contentDescription = null,
                                    tint = MatchAmber,
                                    modifier = Modifier.size(28.dp)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = detail?.dealerName ?: state.summary?.dealer ?: "Authorized Dealer",
                                        style = MaterialTheme.typography.titleMedium
                                    )
                                    val loc = listOfNotNull(detail?.dealerCity, detail?.dealerState)
                                        .joinToString(", ")
                                        .ifBlank { state.summary?.dealerState.orEmpty() }
                                    if (loc.isNotBlank()) {
                                        Text(
                                            text = loc,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    detail?.lastSeenAt?.take(10)?.let { seen ->
                                        Text(
                                            text = "Verified live on dealer site: $seen",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MatchAqua
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // Specs Grid
                if (detail != null) {
                    item {
                        SpecsGridCard(detail)
                    }

                    if (!detail.walkthroughUrl.isNullOrBlank()) {
                        item {
                            OutlinedButton(
                                onClick = {
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(detail.walkthroughUrl))
                                    runCatching { context.startActivity(intent) }
                                },
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp)
                                    .height(48.dp)
                            ) {
                                Icon(Icons.Default.PlayCircleOutline, contentDescription = null, tint = MatchAmber)
                                Spacer(Modifier.width(8.dp))
                                Text("Watch Model Walkthrough (${detail.walkthroughLabel ?: "YouTube"})")
                            }
                        }
                    }

                    // Live Tow-Fit Screening via evaluate_tow_fit MCP tool
                    item {
                        Card(
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = MatchInk850),
                            border = BorderStroke(1.dp, MatchInk700),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(Icons.Default.DirectionsCar, contentDescription = null, tint = MatchAqua)
                                    Text(
                                        text = "Live Tow-Fit Screener",
                                        style = MaterialTheme.typography.titleMedium
                                    )
                                }
                                OutlinedTextField(
                                    value = towVehicleInput,
                                    onValueChange = { towVehicleInput = it.take(120) },
                                    label = { Text("Your tow vehicle (e.g. 2022 Ford F-150 3.5L)") },
                                    singleLine = true,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .testTag("tow_vehicle_input")
                                )
                                OutlinedTextField(
                                    value = payloadInput,
                                    onValueChange = { payloadInput = it.filter(Char::isDigit).take(5) },
                                    label = { Text("Door-sticker payload lbs (optional)") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Button(
                                    onClick = {
                                        onCheckTowFit(
                                            towVehicleInput.trim(),
                                            payloadInput.toDoubleOrNull()
                                        )
                                    },
                                    enabled = towVehicleInput.isNotBlank() && !state.isCheckingTowFit,
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = MatchInk800,
                                        contentColor = MatchAqua
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(48.dp)
                                        .testTag("check_tow_fit_button")
                                ) {
                                    if (state.isCheckingTowFit) {
                                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = MatchAqua)
                                        Spacer(Modifier.width(8.dp))
                                        Text("Evaluating weight limits...")
                                    } else {
                                        Text("Evaluate Tow Fit via MatchRV")
                                    }
                                }

                                state.towFitError?.let {
                                    Text(it, color = MatchPassCoral, style = MaterialTheme.typography.bodySmall)
                                }

                                state.towFitResult?.let { eval ->
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = MatchInk800
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(12.dp),
                                            verticalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Text(
                                                text = "Screening for ${eval.vehicleLabel}",
                                                style = MaterialTheme.typography.labelMedium,
                                                color = MatchAqua
                                            )
                                            eval.unitVerdicts.forEach { v ->
                                                Text(
                                                    text = "Verdict: ${v.verdict}",
                                                    style = MaterialTheme.typography.titleSmall,
                                                    color = MatchAmber
                                                )
                                                v.details.forEach { line ->
                                                    Text("• $line", style = MaterialTheme.typography.bodySmall)
                                                }
                                            }
                                            Text(
                                                text = eval.summaryText,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (!detail.description.isNullOrBlank()) {
                        item {
                            Column(
                                modifier = Modifier.padding(horizontal = 16.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text("Dealer Description", style = MaterialTheme.typography.titleMedium)
                                Text(
                                    text = detail.description,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // 2-Step Verified Dealer Inquiry Modal Sheet
    if (showInquirySheet) {
        DealerInquiryBottomSheet(
            unitId = state.unitId,
            rvTitle = title,
            dealerName = detail?.dealerName ?: state.summary?.dealer ?: "the dealer",
            inquiryState = inquiryState,
            defaultName = defaultUserName,
            defaultEmail = defaultUserEmail,
            onDismiss = { showInquirySheet = false },
            onPrepare = onPrepareInquiry,
            onConfirmSend = onConfirmSendInquiry,
            onReset = onResetInquiry
        )
    }
}

@Composable
private fun SpecsGridCard(detail: RvDetail) {
    val specs = buildList {
        RvFormatters.length(detail.lengthFt)?.let { add("Length" to it) }
        detail.sleeps?.let { add("Sleeps" to "$it people") }
        RvFormatters.weight(detail.dryWeightLbs)?.let { add("Dry Weight" to it) }
        RvFormatters.weight(detail.gvwrLbs)?.let { add("GVWR" to it) }
        RvFormatters.weight(detail.hitchWeightLbs)?.let { add("Hitch Weight" to it) }
        detail.slideouts?.let { add("Slide-Outs" to "$it") }
        detail.freshWaterGal?.let { add("Fresh Water" to "${it.toInt()} gal") }
        detail.greyWaterGal?.let { add("Grey Water" to "${it.toInt()} gal") }
        detail.blackWaterGal?.let { add("Black Water" to "${it.toInt()} gal") }
        detail.boondockingScore?.let { add("Boondocking" to "$it / 100") }
        detail.powertrainSummary.take(4).forEach { add(it) }
    }

    if (specs.isEmpty()) return

    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MatchInk850),
        border = BorderStroke(1.dp, MatchInk700),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("Verified Specifications", style = MaterialTheme.typography.titleMedium)
            specs.chunked(2).forEach { rowItems ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    rowItems.forEach { (label, value) ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MatchInk800,
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = label,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = value,
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontFamily = MaterialTheme.typography.labelMedium.fontFamily
                                    ),
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                    if (rowItems.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DealerInquiryBottomSheet(
    unitId: String,
    rvTitle: String,
    dealerName: String,
    inquiryState: InquiryFlowState,
    defaultName: String,
    defaultEmail: String,
    onDismiss: () -> Unit,
    onPrepare: (String, String, String?, String?, String) -> Unit,
    onConfirmSend: (DealerInquiryPreview, Boolean) -> Unit,
    onReset: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var shopperName by rememberSaveable { mutableStateOf(defaultName) }
    var shopperEmail by rememberSaveable { mutableStateOf(defaultEmail) }
    var shopperPhone by rememberSaveable { mutableStateOf("") }
    var message by rememberSaveable {
        mutableStateOf("Hi, I'm interested in the $rvTitle. Is it currently on the lot, and what is your best out-the-door price?")
    }
    var dryRunMode by rememberSaveable { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MatchInk850
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            when (inquiryState) {
                is InquiryFlowState.Idle, is InquiryFlowState.Preparing, is InquiryFlowState.Error -> {
                    Text(
                        text = "Step 1 of 2: Draft Dealer Inquiry",
                        style = MaterialTheme.typography.headlineMedium
                    )
                    Text(
                        text = "Nothing is sent yet. MatchRV will generate a verified preview for $dealerName so you can approve every detail first.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    if (inquiryState is InquiryFlowState.Error) {
                        Surface(
                            color = MatchPassCoral.copy(alpha = 0.14f),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = inquiryState.message,
                                color = MatchPassCoral,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }

                    OutlinedTextField(
                        value = shopperName,
                        onValueChange = { shopperName = it.take(100) },
                        label = { Text("Your Full Name *") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("inquiry_name_input")
                    )
                    OutlinedTextField(
                        value = shopperEmail,
                        onValueChange = { shopperEmail = it.take(120) },
                        label = { Text("Email Address") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("inquiry_email_input")
                    )
                    OutlinedTextField(
                        value = shopperPhone,
                        onValueChange = { shopperPhone = it.take(30) },
                        label = { Text("Phone Number (optional if email provided)") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("inquiry_phone_input")
                    )
                    OutlinedTextField(
                        value = message,
                        onValueChange = { message = it.take(1800) },
                        label = { Text("Message to Dealer *") },
                        minLines = 3,
                        maxLines = 5,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("inquiry_message_input")
                    )

                    val valid = shopperName.isNotBlank() &&
                        (shopperEmail.isNotBlank() || shopperPhone.isNotBlank()) &&
                        message.isNotBlank()

                    Button(
                        onClick = {
                            onPrepare(
                                unitId,
                                shopperName,
                                shopperEmail.takeIf { it.isNotBlank() },
                                shopperPhone.takeIf { it.isNotBlank() },
                                message
                            )
                        },
                        enabled = valid && inquiryState !is InquiryFlowState.Preparing,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MatchAqua,
                            contentColor = MatchInk950
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .testTag("prepare_inquiry_button")
                    ) {
                        if (inquiryState is InquiryFlowState.Preparing) {
                            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MatchInk950)
                            Spacer(Modifier.width(8.dp))
                            Text("Preparing verified preview...")
                        } else {
                            Text("Preview Inquiry (Sends Nothing)", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                is InquiryFlowState.PreviewReady, is InquiryFlowState.Sending -> {
                    val preview = (inquiryState as? InquiryFlowState.PreviewReady)?.preview
                    Text(
                        text = "Step 2 of 2: Approve & Send",
                        style = MaterialTheme.typography.headlineMedium,
                        color = MatchAqua
                    )
                    if (preview != null) {
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MatchInk800),
                            border = BorderStroke(1.dp, MatchAqua.copy(alpha = 0.4f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text("To: ${preview.dealerName}", style = MaterialTheme.typography.titleMedium)
                                preview.dealerLocation?.let {
                                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Text("Delivery: ${preview.deliveryMethod}", style = MaterialTheme.typography.labelSmall, color = MatchAqua)
                                HorizontalDivider(color = MatchInk700, modifier = Modifier.padding(vertical = 4.dp))
                                Text("RV: ${preview.rvTitle}", style = MaterialTheme.typography.titleSmall)
                                val meta = listOfNotNull(
                                    preview.priceUsd?.let { RvFormatters.price(it) },
                                    preview.vin?.let { "VIN $it" },
                                    preview.stockNumber?.let { "Stock #$it" }
                                ).joinToString(" • ")
                                if (meta.isNotBlank()) {
                                    Text(meta, style = MaterialTheme.typography.labelSmall, color = MatchAmber)
                                }
                                HorizontalDivider(color = MatchInk700, modifier = Modifier.padding(vertical = 4.dp))
                                Text("From: ${preview.shopperName}", style = MaterialTheme.typography.bodySmall)
                                listOfNotNull(preview.shopperEmail, preview.shopperPhone).joinToString(" • ")
                                    .takeIf { it.isNotBlank() }?.let {
                                        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                Text("\"${preview.message}\"", style = MaterialTheme.typography.bodyMedium)
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Test Mode (Dry Run)", style = MaterialTheme.typography.titleSmall)
                                Text(
                                    "Validate without contacting the dealership",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Switch(
                                checked = dryRunMode,
                                onCheckedChange = { dryRunMode = it },
                                colors = SwitchDefaults.colors(checkedTrackColor = MatchAmber)
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = onReset,
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp)
                            ) {
                                Text("Edit")
                            }
                            Button(
                                onClick = { onConfirmSend(preview, dryRunMode) },
                                enabled = inquiryState !is InquiryFlowState.Sending,
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MatchAqua,
                                    contentColor = MatchInk950
                                ),
                                modifier = Modifier
                                    .weight(1.4f)
                                    .height(52.dp)
                                    .testTag("confirm_send_inquiry_button")
                            ) {
                                if (inquiryState is InquiryFlowState.Sending) {
                                    CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MatchInk950)
                                } else {
                                    Text(
                                        text = if (dryRunMode) "Run Test Inquiry" else "Confirm & Send",
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    } else {
                        Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = MatchAqua)
                        }
                    }
                }

                is InquiryFlowState.Sent -> {
                    val receipt = inquiryState.receipt
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = MatchAqua,
                            modifier = Modifier.size(56.dp)
                        )
                        Text(
                            text = RvFormatters.inquiryStatusLabel(receipt.status),
                            style = MaterialTheme.typography.headlineMedium,
                            color = MatchAqua
                        )
                        Text(
                            text = receipt.statusMessage,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "Inquiry ID: ${receipt.inquiryId}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MatchAmber
                        )
                        Button(
                            onClick = onDismiss,
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MatchAqua,
                                contentColor = MatchInk950
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                        ) {
                            Text("Done", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
