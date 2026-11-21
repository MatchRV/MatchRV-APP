package com.example

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MarkEmailRead
import androidx.compose.material.icons.filled.Style
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.example.data.ai.AskAiRepository
import com.example.data.mcp.MatchRvMcpClient
import com.example.data.model.AnalyticsEventRecord
import com.example.data.model.RvSummary
import com.example.data.repository.MatchRvFirestoreRepository
import com.example.firebase.authStateFlow
import com.example.firebase.configureAppCheck
import com.example.firebase.signOutUser
import com.example.ui.MatchRvViewModel
import com.example.ui.UiState
import com.example.ui.screens.AskAiScreen
import com.example.ui.screens.AuthScreen
import com.example.ui.screens.DiscoverScreen
import com.example.ui.screens.FilterBottomSheet
import com.example.ui.screens.InquiriesScreen
import com.example.ui.screens.RvDetailScreen
import com.example.ui.screens.SavedScreen
import com.example.ui.theme.MatchAqua
import com.example.ui.theme.MatchInk700
import com.example.ui.theme.MatchInk800
import com.example.ui.theme.MatchInk850
import com.example.ui.theme.MatchInk900
import com.example.ui.theme.MatchInk950
import com.example.ui.theme.MatchRvTheme
import com.example.util.AlertNotificationHelper
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestore

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // STEP 1: Mandatory App Check configuration with launch intent before UI/ViewModels
        configureAppCheck(this, intent)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )

        setContent {
            MatchRvTheme(darkTheme = true) {
                MatchRvRoot()
            }
        }

        lifecycleScope.launch(Dispatchers.IO) {
            AlertNotificationHelper.ensureChannel(applicationContext)
        }
    }
}

private enum class MainTab(
    val label: String,
    val icon: ImageVector,
    val testTag: String
) {
    DISCOVER("Discover", Icons.Default.Style, "nav_discover"),
    ASK_AI("Ask AI", Icons.Default.AutoAwesome, "nav_ask_ai"),
    SAVED("Saved", Icons.Default.Favorite, "nav_saved"),
    INQUIRIES("Inquiries", Icons.Default.MarkEmailRead, "nav_inquiries")
}

@Composable
private fun MatchRvRoot() {
    val auth = remember { Firebase.auth }
    val currentUser by auth.authStateFlow().collectAsStateWithLifecycle(initialValue = auth.currentUser)

    val user = currentUser
    if (user == null) {
        AuthScreen(onAuthSuccess = {})
    } else {
        key(user.uid) {
            MatchRvAuthenticatedShell(user = user)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MatchRvAuthenticatedShell(user: FirebaseUser) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember(context) { CredentialManager.create(context) }

    val viewModel: MatchRvViewModel = viewModel(
        key = user.uid,
        factory = viewModelFactory {
            initializer {
                val app = checkNotNull(this[APPLICATION_KEY]) {
                    "APPLICATION_KEY missing from CreationExtras"
                }
                val databaseId = app.getString(R.string.firestore_database_id)
                val db = FirebaseFirestore.getInstance(databaseId)
                val mcpClient = MatchRvMcpClient()
                val firestoreRepo = MatchRvFirestoreRepository(db)
                val aiRepo = AskAiRepository(mcpClient)
                MatchRvViewModel(
                    currentUserId = user.uid,
                    mcpClient = mcpClient,
                    firestoreRepository = firestoreRepo,
                    askAiRepository = aiRepo
                )
            }
        }
    )

    val discoverState by viewModel.discoverState.collectAsStateWithLifecycle()
    val askAiState by viewModel.askAiState.collectAsStateWithLifecycle()
    val detailState by viewModel.detailState.collectAsStateWithLifecycle()
    val inquiryState by viewModel.inquiryState.collectAsStateWithLifecycle()
    val savedRvsState by viewModel.savedRvsState.collectAsStateWithLifecycle()
    val savedAlertsState by viewModel.savedAlertsState.collectAsStateWithLifecycle()
    val inquiriesState by viewModel.inquiriesState.collectAsStateWithLifecycle()
    val analyticsState by viewModel.analyticsState.collectAsStateWithLifecycle()
    val compareState by viewModel.compareState.collectAsStateWithLifecycle()
    val snackbarMessage by viewModel.snackbarMessage.collectAsStateWithLifecycle()
    val notificationEvent by viewModel.notificationEvent.collectAsStateWithLifecycle()
    val isRefreshingPrices by viewModel.isRefreshingPrices.collectAsStateWithLifecycle()
    val isRefreshingAlerts by viewModel.isRefreshingAlerts.collectAsStateWithLifecycle()
    val refreshingInquiryId by viewModel.refreshingInquiryId.collectAsStateWithLifecycle()

    var activeTab by rememberSaveable { mutableStateOf(MainTab.DISCOVER) }
    var activeDetailUnitId by rememberSaveable { mutableStateOf<String?>(null) }
    var showFilterSheet by rememberSaveable { mutableStateOf(false) }
    var showProfileSheet by rememberSaveable { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = {}
    )

    LaunchedEffect(snackbarMessage) {
        val msg = snackbarMessage
        if (!msg.isNullOrBlank()) {
            snackbarHostState.showSnackbar(msg)
            viewModel.consumeSnackbar()
        }
    }

    LaunchedEffect(notificationEvent) {
        val evt = notificationEvent
        if (evt != null) {
            AlertNotificationHelper.postAlertNotification(
                context = context,
                notificationId = evt.id,
                title = evt.title,
                body = evt.body
            )
            viewModel.consumeNotificationEvent()
        }
    }

    fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    fun openDetail(unitId: String, summary: RvSummary? = null) {
        viewModel.openRvDetail(unitId, summary)
        activeDetailUnitId = unitId
    }

    if (activeDetailUnitId != null) {
        RvDetailScreen(
            state = detailState,
            inquiryState = inquiryState,
            defaultUserName = user.displayName.orEmpty(),
            defaultUserEmail = user.email.orEmpty(),
            onBack = { activeDetailUnitId = null },
            onSave = { viewModel.saveRvUnit(it) },
            onCheckTowFit = { vehicle, payload ->
                viewModel.evaluateTowFitForCurrentDetail(vehicle, payload)
            },
            onPrepareInquiry = { unitId, name, email, phone, msg ->
                viewModel.prepareDealerInquiry(unitId, name, email, phone, msg)
            },
            onConfirmSendInquiry = { preview, dryRun ->
                viewModel.confirmAndSendDealerInquiry(preview, dryRun)
            },
            onResetInquiry = { viewModel.resetInquiryFlow() }
        )
        return
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val isWideScreen = maxWidth >= 720.dp

        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(MatchInk900)
        ) {
            if (isWideScreen) {
                NavigationRail(
                    containerColor = MatchInk850,
                    modifier = Modifier.fillMaxHeight()
                ) {
                    Spacer(Modifier.height(16.dp))
                    MainTab.entries.forEach { tab ->
                        NavigationRailItem(
                            selected = activeTab == tab,
                            onClick = { activeTab = tab },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) },
                            colors = NavigationRailItemDefaults.colors(
                                selectedIconColor = MatchInk950,
                                selectedTextColor = MatchAqua,
                                indicatorColor = MatchAqua,
                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                            ),
                            modifier = Modifier.testTag(tab.testTag)
                        )
                    }
                }
            }

            Scaffold(
                modifier = Modifier.weight(1f),
                containerColor = MatchInk900,
                snackbarHost = { SnackbarHost(snackbarHostState) },
                topBar = {
                    TopAppBar(
                        title = {
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color.White
                            ) {
                                Image(
                                    painter = painterResource(id = R.drawable.matchrv_logo),
                                    contentDescription = "MatchRV",
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier
                                        .height(34.dp)
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        },
                        actions = {
                            IconButton(
                                onClick = { showProfileSheet = true },
                                modifier = Modifier.testTag("profile_menu_button")
                            ) {
                                Icon(
                                    imageVector = Icons.Default.AccountCircle,
                                    contentDescription = "Account and Activity",
                                    tint = MatchAqua,
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MatchInk900
                        )
                    )
                },
                bottomBar = {
                    if (!isWideScreen) {
                        NavigationBar(
                            containerColor = MatchInk850,
                            tonalElevation = 8.dp
                        ) {
                            MainTab.entries.forEach { tab ->
                                NavigationBarItem(
                                    selected = activeTab == tab,
                                    onClick = { activeTab = tab },
                                    icon = { Icon(tab.icon, contentDescription = tab.label) },
                                    label = { Text(tab.label) },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = MatchInk950,
                                        selectedTextColor = MatchAqua,
                                        indicatorColor = MatchAqua,
                                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                                    ),
                                    modifier = Modifier.testTag(tab.testTag)
                                )
                            }
                        }
                    }
                }
            ) { innerPadding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    when (activeTab) {
                        MainTab.DISCOVER -> DiscoverScreen(
                            state = discoverState,
                            onSwipeRight = { viewModel.swipeRightSave(it) },
                            onSwipeLeft = { viewModel.swipeLeftPass(it) },
                            onUndo = { viewModel.undoLastPass() },
                            onCardTap = { openDetail(it.unitId, it) },
                            onToggleMode = { viewModel.setBrowseMode(it) },
                            onOpenFilters = { showFilterSheet = true },
                            onRetry = { viewModel.loadInitialDeck() },
                            onResetFilters = { viewModel.resetFilters() },
                            onLoadMore = { viewModel.prefetchNextBatchIfNeeded() }
                        )

                        MainTab.ASK_AI -> AskAiScreen(
                            state = askAiState,
                            onRunSearch = { viewModel.runAskAiSearch(it) },
                            onOpenInDiscover = { res ->
                                viewModel.loadAiCuratedDeckIntoDiscover(res)
                                activeTab = MainTab.DISCOVER
                            },
                            onSaveSearchAlert = { filter ->
                                requestNotificationPermissionIfNeeded()
                                viewModel.saveCurrentFilterAsAlert(filter)
                            },
                            onCardTap = { openDetail(it.unitId, it) },
                            onDeckDecision = { rv, save -> viewModel.dismissCardFromAiDeck(rv, save) }
                        )

                        MainTab.SAVED -> SavedScreen(
                            savedRvsState = savedRvsState,
                            savedAlertsState = savedAlertsState,
                            compareState = compareState,
                            isRefreshingPrices = isRefreshingPrices,
                            isRefreshingAlerts = isRefreshingAlerts,
                            onOpenDetail = { saved ->
                                openDetail(
                                    unitId = saved.unitId,
                                    summary = RvSummary(
                                        unitId = saved.unitId,
                                        title = saved.title,
                                        make = saved.make,
                                        priceUsd = saved.lastCheckedPriceUsd.takeIf { it > 0 } ?: saved.savedPriceUsd,
                                        lengthFt = saved.lengthFt,
                                        dryWeightLbs = saved.dryWeightLbs,
                                        gvwrLbs = saved.gvwrLbs,
                                        sleeps = saved.sleeps?.toInt(),
                                        distanceMi = null,
                                        dealer = saved.dealerName,
                                        dealerState = saved.dealerState,
                                        matchScore = null,
                                        verified = true,
                                        floorplan = null,
                                        walkthroughUrl = null,
                                        walkthroughLabel = null,
                                        listingUrl = saved.listingUrl,
                                        thumbnailUrl = saved.imageUrl,
                                        rvType = saved.rvType,
                                        condition = saved.condition,
                                        year = saved.year?.toInt(),
                                        isHydrated = false
                                    )
                                )
                            },
                            onRemoveSaved = { viewModel.removeSavedRv(it) },
                            onRefreshPrices = {
                                requestNotificationPermissionIfNeeded()
                                viewModel.refreshSavedPricesNow()
                            },
                            onToggleCompare = { viewModel.toggleCompareSelection(it) },
                            onRunCompare = { viewModel.runCompareSelected() },
                            onClearCompare = { viewModel.clearCompareResult() },
                            onToggleAlert = { id, enabled ->
                                if (enabled) requestNotificationPermissionIfNeeded()
                                viewModel.toggleAlertEnabled(id, enabled)
                            },
                            onDeleteAlert = { viewModel.deleteAlert(it) },
                            onCheckAlertsNow = {
                                requestNotificationPermissionIfNeeded()
                                viewModel.checkSavedAlertsNow()
                            },
                            onApplyAlertFilter = { filter ->
                                viewModel.applyFilter(filter)
                                activeTab = MainTab.DISCOVER
                            }
                        )

                        MainTab.INQUIRIES -> InquiriesScreen(
                            state = inquiriesState,
                            refreshingInquiryId = refreshingInquiryId,
                            onRefreshStatus = { viewModel.refreshInquiryStatus(it) },
                            onOpenRv = { openDetail(it, null) }
                        )
                    }
                }
            }
        }
    }

    if (showFilterSheet) {
        FilterBottomSheet(
            currentFilter = discoverState.filter,
            onDismiss = { showFilterSheet = false },
            onApply = { viewModel.applyFilter(it) },
            onSaveAlert = { filter ->
                requestNotificationPermissionIfNeeded()
                viewModel.saveCurrentFilterAsAlert(filter)
            }
        )
    }

    if (showProfileSheet) {
        ProfileAnalyticsBottomSheet(
            user = user,
            analyticsState = analyticsState,
            onDismiss = { showProfileSheet = false },
            onSignOut = {
                showProfileSheet = false
                signOutUser(credentialManager, scope)
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileAnalyticsBottomSheet(
    user: FirebaseUser,
    analyticsState: UiState<List<AnalyticsEventRecord>>,
    onDismiss: () -> Unit,
    onSignOut: () -> Unit
) {
    val events = (analyticsState as? UiState.Success)?.data.orEmpty()
    val swipes = events.count { it.eventType == "swipe_right" || it.eventType == "swipe_left" }
    val saves = events.count { it.eventType == "save" }
    val aiSearches = events.count { it.eventType == "agent_search" }
    val inquiries = events.count { it.eventType == "inquiry_sent" }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MatchInk850
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = user.displayName ?: "MatchRV Shopper",
                    style = MaterialTheme.typography.headlineMedium
                )
                Text(
                    text = user.email ?: "Signed in with Google",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                text = "Your MatchRV Activity Analytics",
                style = MaterialTheme.typography.titleSmall,
                color = MatchAqua
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatChip("Swipes", swipes.toString(), Modifier.weight(1f))
                StatChip("Saves", saves.toString(), Modifier.weight(1f))
                StatChip("AI Searches", aiSearches.toString(), Modifier.weight(1f))
                StatChip("Inquiries", inquiries.toString(), Modifier.weight(1f))
            }

            HorizontalDivider(color = MatchInk700)

            OutlinedButton(
                onClick = onSignOut,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
                    .testTag("sign_out_button")
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Sign Out")
            }
        }
    }
}

@Composable
private fun StatChip(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MatchInk800,
        border = BorderStroke(1.dp, MatchInk700),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(vertical = 12.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge.copy(
                    fontFamily = MaterialTheme.typography.labelMedium.fontFamily
                ),
                color = MatchAqua
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
