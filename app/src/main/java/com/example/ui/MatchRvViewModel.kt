package com.example.ui

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.ai.AiCuratedDeckResult
import com.example.data.ai.AskAiRepository
import com.example.data.mcp.MatchRvMcpClient
import com.example.data.model.AnalyticsEventRecord
import com.example.data.model.DealerInquiryPreview
import com.example.data.model.DealerInquiryReceipt
import com.example.data.model.DealerInquiryRecord
import com.example.data.model.RvComparisonResult
import com.example.data.model.RvDetail
import com.example.data.model.RvSearchFilter
import com.example.data.model.RvSummary
import com.example.data.model.SavedRvRecord
import com.example.data.model.SavedSearchAlertRecord
import com.example.data.model.TowFitEvaluation
import com.example.data.repository.MatchRvFirestoreRepository
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

private const val TAG = "MatchRvViewModel"

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

enum class BrowseMode { SWIPE, GRID }

data class DiscoverUiState(
    val deck: List<RvSummary> = emptyList(),
    val passedStack: List<RvSummary> = emptyList(),
    val filter: RvSearchFilter = RvSearchFilter(),
    val browseMode: BrowseMode = BrowseMode.SWIPE,
    val isLoading: Boolean = true,
    val isPrefetching: Boolean = false,
    val errorMessage: String? = null,
    val eligibleInventoryCount: Int? = null,
    val aiCuratedSummary: String? = null,
    val batchIndex: Int = 0
)

sealed interface AskAiUiState {
    data object Idle : AskAiUiState
    data object Loading : AskAiUiState
    data class Success(val result: AiCuratedDeckResult) : AskAiUiState
    data class Error(val message: String) : AskAiUiState
}

data class DetailUiState(
    val unitId: String = "",
    val summary: RvSummary? = null,
    val detail: RvDetail? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isCheckingTowFit: Boolean = false,
    val towFitResult: TowFitEvaluation? = null,
    val towFitError: String? = null
)

sealed interface InquiryFlowState {
    data object Idle : InquiryFlowState
    data object Preparing : InquiryFlowState
    data class PreviewReady(val preview: DealerInquiryPreview) : InquiryFlowState
    data object Sending : InquiryFlowState
    data class Sent(val receipt: DealerInquiryReceipt) : InquiryFlowState
    data class Error(val message: String) : InquiryFlowState
}

data class CompareUiState(
    val selectedUnitIds: Set<String> = emptySet(),
    val isComparing: Boolean = false,
    val result: RvComparisonResult? = null,
    val errorMessage: String? = null
)

data class AlertNotificationEvent(
    val id: Int,
    val title: String,
    val body: String
)

class MatchRvViewModel(
    private val currentUserId: String,
    private val mcpClient: MatchRvMcpClient,
    private val firestoreRepository: MatchRvFirestoreRepository,
    private val askAiRepository: AskAiRepository
) : ViewModel() {

    private val _discoverState = MutableStateFlow(DiscoverUiState())
    val discoverState: StateFlow<DiscoverUiState> = _discoverState.asStateFlow()

    private val _askAiState = MutableStateFlow<AskAiUiState>(AskAiUiState.Idle)
    val askAiState: StateFlow<AskAiUiState> = _askAiState.asStateFlow()

    private val _detailState = MutableStateFlow(DetailUiState())
    val detailState: StateFlow<DetailUiState> = _detailState.asStateFlow()

    private val _inquiryState = MutableStateFlow<InquiryFlowState>(InquiryFlowState.Idle)
    val inquiryState: StateFlow<InquiryFlowState> = _inquiryState.asStateFlow()

    private val _compareState = MutableStateFlow(CompareUiState())
    val compareState: StateFlow<CompareUiState> = _compareState.asStateFlow()

    private val _snackbarMessage = MutableStateFlow<String?>(null)
    val snackbarMessage: StateFlow<String?> = _snackbarMessage.asStateFlow()

    private val _notificationEvent = MutableStateFlow<AlertNotificationEvent?>(null)
    val notificationEvent: StateFlow<AlertNotificationEvent?> = _notificationEvent.asStateFlow()

    private val _isRefreshingAlerts = MutableStateFlow(false)
    val isRefreshingAlerts: StateFlow<Boolean> = _isRefreshingAlerts.asStateFlow()

    private val _isRefreshingPrices = MutableStateFlow(false)
    val isRefreshingPrices: StateFlow<Boolean> = _isRefreshingPrices.asStateFlow()

    private val _refreshingInquiryId = MutableStateFlow<String?>(null)
    val refreshingInquiryId: StateFlow<String?> = _refreshingInquiryId.asStateFlow()

    private val seenUnitIds = mutableSetOf<String>()
    private val seenModelsForPagination = mutableListOf<String>()
    private val hydrationSemaphore = Semaphore(4)

    val savedRvsState: StateFlow<UiState<List<SavedRvRecord>>> =
        firestoreRepository.observeSavedRvs(currentUserId)
            .map<List<SavedRvRecord>, UiState<List<SavedRvRecord>>> { UiState.Success(it) }
            .catch { error -> emitFirestoreError("observeSavedRvs", error) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000L), UiState.Loading)

    val savedAlertsState: StateFlow<UiState<List<SavedSearchAlertRecord>>> =
        firestoreRepository.observeSavedAlerts(currentUserId)
            .map<List<SavedSearchAlertRecord>, UiState<List<SavedSearchAlertRecord>>> { UiState.Success(it) }
            .catch { error -> emitFirestoreError("observeSavedAlerts", error) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000L), UiState.Loading)

    val inquiriesState: StateFlow<UiState<List<DealerInquiryRecord>>> =
        firestoreRepository.observeInquiries(currentUserId)
            .map<List<DealerInquiryRecord>, UiState<List<DealerInquiryRecord>>> { UiState.Success(it) }
            .catch { error -> emitFirestoreError("observeInquiries", error) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000L), UiState.Loading)

    val analyticsState: StateFlow<UiState<List<AnalyticsEventRecord>>> =
        firestoreRepository.observeAnalyticsEvents(currentUserId)
            .map<List<AnalyticsEventRecord>, UiState<List<AnalyticsEventRecord>>> { UiState.Success(it) }
            .catch { error -> emitFirestoreError("observeAnalytics", error) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000L), UiState.Loading)

    init {
        loadInitialDeck(RvSearchFilter())
    }

    private suspend fun <T> kotlinx.coroutines.flow.FlowCollector<UiState<T>>.emitFirestoreError(
        opName: String,
        error: Throwable
    ) {
        val firestoreError = generateSequence(error) { it.cause }
            .filterIsInstance<FirebaseFirestoreException>()
            .firstOrNull()
        if (firestoreError == null && error is CancellationException) throw error
        val rootError = firestoreError ?: error
        Log.w(TAG, "Firestore stream error in $opName", rootError)
        emit(UiState.Error(rootError.localizedMessage ?: "Unable to sync data"))
    }

    fun consumeSnackbar() {
        _snackbarMessage.value = null
    }

    fun consumeNotificationEvent() {
        _notificationEvent.value = null
    }

    fun setBrowseMode(mode: BrowseMode) {
        _discoverState.update { it.copy(browseMode = mode) }
    }

    fun applyFilter(newFilter: RvSearchFilter, aiSummary: String? = null) {
        seenUnitIds.clear()
        seenModelsForPagination.clear()
        loadInitialDeck(newFilter, aiSummary)
    }

    fun resetFilters() {
        applyFilter(RvSearchFilter(), aiSummary = null)
    }

    fun loadInitialDeck(filter: RvSearchFilter = _discoverState.value.filter, aiSummary: String? = null) {
        viewModelScope.launch {
            _discoverState.update {
                it.copy(
                    filter = filter,
                    isLoading = true,
                    errorMessage = null,
                    aiCuratedSummary = aiSummary,
                    batchIndex = 0,
                    passedStack = emptyList()
                )
            }
            try {
                val res = mcpClient.searchRvs(filter = filter, limit = 10)
                seenUnitIds.clear()
                seenModelsForPagination.clear()
                res.units.forEach {
                    seenUnitIds.add(it.unitId)
                    extractModelToken(it.title)?.let { m ->
                        if (m !in seenModelsForPagination) seenModelsForPagination.add(m)
                    }
                }
                _discoverState.update {
                    it.copy(
                        deck = res.units,
                        isLoading = false,
                        errorMessage = null,
                        eligibleInventoryCount = res.eligibleUnitsCount ?: it.eligibleInventoryCount,
                        batchIndex = 1
                    )
                }
                hydrateDeckPhotos(res.units)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load MatchRV deck", e)
                _discoverState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage
                            ?: "Unable to reach matchrv.com/mcp. Check your connection and retry."
                    )
                }
            }
        }
    }

    fun prefetchNextBatchIfNeeded() {
        val state = _discoverState.value
        if (state.isLoading || state.isPrefetching || state.deck.size > 4) return

        viewModelScope.launch {
            _discoverState.update { it.copy(isPrefetching = true) }
            try {
                val exclude = seenModelsForPagination.takeLast(6)
                val nextFilter = if (exclude.isEmpty()) {
                    // Step price band slightly if no model exclusions are available
                    val maxSeenPrice = state.deck.mapNotNull { it.priceUsd }.maxOrNull()
                    if (maxSeenPrice != null && state.filter.priceMinUsd == null) {
                        state.filter.copy(priceMinUsd = maxSeenPrice + 500.0)
                    } else {
                        state.filter
                    }
                } else {
                    state.filter
                }

                val res = mcpClient.searchRvs(
                    filter = nextFilter,
                    excludeModels = exclude,
                    limit = 10
                )
                val freshUnits = res.units.filter { it.unitId !in seenUnitIds }
                freshUnits.forEach {
                    seenUnitIds.add(it.unitId)
                    extractModelToken(it.title)?.let { m ->
                        if (m !in seenModelsForPagination) seenModelsForPagination.add(m)
                    }
                }
                if (freshUnits.isNotEmpty()) {
                    _discoverState.update {
                        it.copy(
                            deck = it.deck + freshUnits,
                            isPrefetching = false,
                            batchIndex = it.batchIndex + 1
                        )
                    }
                    hydrateDeckPhotos(freshUnits)
                } else {
                    _discoverState.update { it.copy(isPrefetching = false) }
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "Prefetch next batch failed: ${e.message}")
                _discoverState.update { it.copy(isPrefetching = false) }
            }
        }
    }

    private fun hydrateDeckPhotos(units: List<RvSummary>) {
        if (units.isEmpty()) return
        viewModelScope.launch {
            coroutineScope {
                units.take(8).map { unit ->
                    async {
                        if (unit.isHydrated && !unit.thumbnailUrl.isNullOrBlank()) return@async
                        hydrationSemaphore.withPermit {
                            runCatching { mcpClient.getRv(unit.unitId) }.onSuccess { detail ->
                                updateUnitWithDetail(unit.unitId, detail)
                            }
                        }
                    }
                }.awaitAll()
            }
        }
    }

    private fun updateUnitWithDetail(unitId: String, detail: RvDetail) {
        _discoverState.update { state ->
            state.copy(
                deck = state.deck.map { item ->
                    if (item.unitId == unitId) {
                        item.copy(
                            thumbnailUrl = detail.images.firstOrNull() ?: item.thumbnailUrl,
                            rvType = detail.rvType ?: item.rvType,
                            condition = detail.condition ?: item.condition,
                            year = detail.year ?: item.year,
                            priceUsd = detail.priceUsd ?: item.priceUsd,
                            lengthFt = detail.lengthFt ?: item.lengthFt,
                            dryWeightLbs = detail.dryWeightLbs ?: item.dryWeightLbs,
                            gvwrLbs = detail.gvwrLbs ?: item.gvwrLbs,
                            sleeps = detail.sleeps ?: item.sleeps,
                            listingUrl = detail.listingUrl ?: item.listingUrl,
                            isHydrated = true
                        )
                    } else item
                }
            )
        }
        // Also hydrate Ask AI curated deck if currently displayed
        val ai = _askAiState.value
        if (ai is AskAiUiState.Success) {
            val updated = ai.result.curatedDeck.map { item ->
                if (item.unitId == unitId) {
                    item.copy(
                        thumbnailUrl = detail.images.firstOrNull() ?: item.thumbnailUrl,
                        rvType = detail.rvType ?: item.rvType,
                        condition = detail.condition ?: item.condition,
                        year = detail.year ?: item.year,
                        priceUsd = detail.priceUsd ?: item.priceUsd,
                        isHydrated = true
                    )
                } else item
            }
            _askAiState.value = AskAiUiState.Success(ai.result.copy(curatedDeck = updated))
        }
    }

    fun swipeRightSave(rv: RvSummary) {
        removeCardFromDeck(rv, addToPassed = false)
        saveRvUnit(rv, fromSwipe = true)
    }

    fun swipeLeftPass(rv: RvSummary) {
        removeCardFromDeck(rv, addToPassed = true)
        viewModelScope.launch {
            firestoreRepository.trackAnalyticsEvent(
                eventType = "swipe_left",
                unitId = rv.unitId,
                rvType = rv.rvType,
                priceUsd = rv.priceUsd
            )
        }
    }

    fun undoLastPass() {
        _discoverState.update { state ->
            val last = state.passedStack.lastOrNull() ?: return@update state
            state.copy(
                deck = listOf(last) + state.deck,
                passedStack = state.passedStack.dropLast(1)
            )
        }
    }

    private fun removeCardFromDeck(rv: RvSummary, addToPassed: Boolean) {
        _discoverState.update { state ->
            val remaining = state.deck.filterNot { it.unitId == rv.unitId }
            val updatedPassed = if (addToPassed) (state.passedStack + rv).takeLast(15) else state.passedStack
            state.copy(deck = remaining, passedStack = updatedPassed)
        }
        prefetchNextBatchIfNeeded()
    }

    fun saveRvUnit(rv: RvSummary, fromSwipe: Boolean = false) {
        viewModelScope.launch {
            val cachedDetail = mcpClient.getCachedDetail(rv.unitId)
            val result = firestoreRepository.saveRv(rv, cachedDetail)
            if (result.isSuccess) {
                _snackbarMessage.value = "Saved ${rv.title.take(36)}"
                if (fromSwipe) {
                    firestoreRepository.trackAnalyticsEvent(
                        eventType = "swipe_right",
                        unitId = rv.unitId,
                        rvType = rv.rvType,
                        priceUsd = rv.priceUsd
                    )
                }
                firestoreRepository.trackAnalyticsEvent(
                    eventType = "save",
                    unitId = rv.unitId,
                    rvType = rv.rvType,
                    priceUsd = rv.priceUsd
                )
            } else {
                _snackbarMessage.value = result.exceptionOrNull()?.localizedMessage ?: "Failed to save RV"
            }
        }
    }

    fun removeSavedRv(savedId: String) {
        viewModelScope.launch {
            val res = firestoreRepository.removeSavedRv(savedId)
            if (res.isSuccess) {
                _snackbarMessage.value = "Removed from Saved RVs"
            } else {
                _snackbarMessage.value = "Could not remove RV"
            }
        }
    }

    fun openRvDetail(unitId: String, initialSummary: RvSummary? = null) {
        val cached = mcpClient.getCachedDetail(unitId)
        _inquiryState.value = InquiryFlowState.Idle
        _detailState.value = DetailUiState(
            unitId = unitId,
            summary = initialSummary,
            detail = cached,
            isLoading = cached == null,
            errorMessage = null
        )
        viewModelScope.launch {
            try {
                val detail = mcpClient.getRv(unitId, forceRefresh = cached == null)
                _detailState.update {
                    if (it.unitId == unitId) it.copy(detail = detail, isLoading = false, errorMessage = null)
                    else it
                }
                updateUnitWithDetail(unitId, detail)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load get_rv for $unitId", e)
                _detailState.update {
                    if (it.unitId == unitId) {
                        it.copy(
                            isLoading = false,
                            errorMessage = e.localizedMessage ?: "Could not load full RV record."
                        )
                    } else it
                }
            }
        }
    }

    fun evaluateTowFitForCurrentDetail(vehicle: String, payloadLbs: Double?) {
        val unitId = _detailState.value.unitId
        if (unitId.isBlank() || vehicle.isBlank()) return
        viewModelScope.launch {
            _detailState.update { it.copy(isCheckingTowFit = true, towFitError = null) }
            try {
                val eval = mcpClient.evaluateTowFit(
                    unitIds = listOf(unitId),
                    vehicle = vehicle,
                    truckPayloadLbs = payloadLbs
                )
                _detailState.update {
                    it.copy(isCheckingTowFit = false, towFitResult = eval, towFitError = null)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _detailState.update {
                    it.copy(
                        isCheckingTowFit = false,
                        towFitError = e.localizedMessage ?: "Tow-fit check failed."
                    )
                }
            }
        }
    }

    // --- 2-Step Verified Dealer Inquiry Flow ---

    fun resetInquiryFlow() {
        _inquiryState.value = InquiryFlowState.Idle
    }

    fun prepareDealerInquiry(
        unitId: String,
        name: String,
        email: String?,
        phone: String?,
        message: String
    ) {
        viewModelScope.launch {
            _inquiryState.value = InquiryFlowState.Preparing
            try {
                val preview = mcpClient.prepareDealerInquiry(
                    unitId = unitId,
                    name = name,
                    email = email,
                    phone = phone,
                    message = message
                )
                _inquiryState.value = InquiryFlowState.PreviewReady(preview)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "prepare_dealer_inquiry failed", e)
                _inquiryState.value = InquiryFlowState.Error(
                    e.localizedMessage ?: "Could not prepare dealer inquiry preview."
                )
            }
        }
    }

    fun confirmAndSendDealerInquiry(preview: DealerInquiryPreview, dryRun: Boolean) {
        val currentDetail = _detailState.value.detail
        val unitId = _detailState.value.unitId
        viewModelScope.launch {
            _inquiryState.value = InquiryFlowState.Sending
            try {
                val receipt = mcpClient.sendDealerInquiry(
                    confirmationToken = preview.confirmationToken,
                    dryRun = dryRun
                )
                val recordResult = firestoreRepository.recordDealerInquiry(
                    mcpInquiryId = receipt.inquiryId,
                    statusToken = receipt.statusToken,
                    unitId = unitId,
                    rvTitle = preview.rvTitle.ifBlank { currentDetail?.title ?: "RV Listing" },
                    dealerName = preview.dealerName.ifBlank { currentDetail?.dealerName ?: "Dealership" },
                    dealerLocation = preview.dealerLocation,
                    status = receipt.status,
                    message = preview.message,
                    dryRun = receipt.dryRun,
                    priceUsd = preview.priceUsd ?: currentDetail?.priceUsd,
                    imageUrl = currentDetail?.images?.firstOrNull()
                )
                if (recordResult.isFailure) {
                    Log.w(TAG, "Inquiry sent via MCP but failed to save to Firestore", recordResult.exceptionOrNull())
                }
                firestoreRepository.trackAnalyticsEvent(
                    eventType = "inquiry_sent",
                    unitId = unitId,
                    rvType = currentDetail?.rvType,
                    priceUsd = preview.priceUsd ?: currentDetail?.priceUsd,
                    metadata = if (receipt.dryRun) "dry_run:${receipt.status}" else receipt.status
                )
                _inquiryState.value = InquiryFlowState.Sent(receipt)
                _snackbarMessage.value = if (receipt.dryRun) {
                    "Test inquiry validated (dry run)"
                } else {
                    "Inquiry sent to ${preview.dealerName}"
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "send_dealer_inquiry failed", e)
                _inquiryState.value = InquiryFlowState.Error(
                    e.localizedMessage ?: "Failed to deliver dealer inquiry."
                )
            }
        }
    }

    fun refreshInquiryStatus(inquiry: DealerInquiryRecord) {
        viewModelScope.launch {
            _refreshingInquiryId.value = inquiry.id
            try {
                val res = mcpClient.getDealerInquiryStatus(
                    inquiryId = inquiry.mcpInquiryId,
                    statusToken = inquiry.statusToken
                )
                firestoreRepository.updateInquiryStatus(
                    inquiryDocId = inquiry.id,
                    status = res.status,
                    dealerReply = res.dealerReply
                )
                _snackbarMessage.value = "Status updated: ${res.status.replace("_", " ")}"
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _snackbarMessage.value = e.localizedMessage ?: "Unable to refresh inquiry status"
            } finally {
                _refreshingInquiryId.value = null
            }
        }
    }

    // --- Ask AI Search ---

    fun runAskAiSearch(prompt: String) {
        viewModelScope.launch {
            _askAiState.value = AskAiUiState.Loading
            firestoreRepository.trackAnalyticsEvent(
                eventType = "agent_search",
                queryText = prompt.trim()
            )
            val result = askAiRepository.runAgentSearch(prompt)
            result.onSuccess { curated ->
                _askAiState.value = AskAiUiState.Success(curated)
                hydrateDeckPhotos(curated.curatedDeck)
            }.onFailure { err ->
                _askAiState.value = AskAiUiState.Error(
                    err.localizedMessage ?: "Ask AI could not complete your search."
                )
            }
        }
    }

    fun loadAiCuratedDeckIntoDiscover(result: AiCuratedDeckResult) {
        seenUnitIds.clear()
        seenModelsForPagination.clear()
        result.curatedDeck.forEach {
            seenUnitIds.add(it.unitId)
            extractModelToken(it.title)?.let { m ->
                if (m !in seenModelsForPagination) seenModelsForPagination.add(m)
            }
        }
        _discoverState.update {
            it.copy(
                deck = result.curatedDeck,
                filter = result.appliedFilter,
                browseMode = BrowseMode.SWIPE,
                isLoading = false,
                errorMessage = null,
                aiCuratedSummary = result.agentSummary,
                passedStack = emptyList(),
                batchIndex = 1
            )
        }
        hydrateDeckPhotos(result.curatedDeck)
    }

    fun dismissCardFromAiDeck(rv: RvSummary, save: Boolean) {
        if (save) {
            saveRvUnit(rv, fromSwipe = true)
        } else {
            viewModelScope.launch {
                firestoreRepository.trackAnalyticsEvent(
                    eventType = "swipe_left",
                    unitId = rv.unitId,
                    rvType = rv.rvType,
                    priceUsd = rv.priceUsd
                )
            }
        }
        val current = _askAiState.value
        if (current is AskAiUiState.Success) {
            _askAiState.value = AskAiUiState.Success(
                current.result.copy(
                    curatedDeck = current.result.curatedDeck.filterNot { it.unitId == rv.unitId }
                )
            )
        }
    }

    // --- Saved Search Alerts & Price Drop Checks ---

    fun saveCurrentFilterAsAlert(filter: RvSearchFilter = _discoverState.value.filter) {
        viewModelScope.launch {
            val currentIds = _discoverState.value.deck.map { it.unitId }.take(10)
            val res = firestoreRepository.saveSearchAlert(filter, currentIds)
            if (res.isSuccess) {
                _snackbarMessage.value = "Saved search alert created!"
            } else {
                _snackbarMessage.value = "Could not save search alert"
            }
        }
    }

    fun toggleAlertEnabled(alertId: String, enabled: Boolean) {
        viewModelScope.launch {
            firestoreRepository.toggleSearchAlert(alertId, enabled)
        }
    }

    fun deleteAlert(alertId: String) {
        viewModelScope.launch {
            firestoreRepository.deleteSearchAlert(alertId)
            _snackbarMessage.value = "Search alert deleted"
        }
    }

    fun refreshSavedPricesNow() {
        val state = savedRvsState.value
        if (state !is UiState.Success || state.data.isEmpty()) {
            _snackbarMessage.value = "Save RVs first to check live price drops"
            return
        }
        viewModelScope.launch {
            _isRefreshingPrices.value = true
            var dropCount = 0
            try {
                state.data.take(10).forEach { saved ->
                    runCatching { mcpClient.getRv(saved.unitId, forceRefresh = true) }
                        .onSuccess { detail ->
                            val livePrice = detail.priceUsd
                            if (livePrice != null && livePrice > 0.0) {
                                val res = firestoreRepository.updateSavedRvPrice(
                                    savedId = saved.id,
                                    newPriceUsd = livePrice,
                                    savedBaselinePriceUsd = saved.savedPriceUsd,
                                    imageUrl = detail.images.firstOrNull() ?: saved.imageUrl
                                )
                                if (res.getOrDefault(false)) {
                                    dropCount++
                                }
                            }
                        }
                }
                if (dropCount > 0) {
                    val msg = "$dropCount saved RV${if (dropCount > 1) "s" else ""} dropped in price!"
                    _snackbarMessage.value = msg
                    _notificationEvent.value = AlertNotificationEvent(
                        id = 1001,
                        title = "MatchRV Price Drop Alert",
                        body = msg
                    )
                } else {
                    _snackbarMessage.value = "Prices checked against live MatchRV inventory — all up to date."
                }
            } finally {
                _isRefreshingPrices.value = false
            }
        }
    }

    fun checkSavedAlertsNow() {
        val state = savedAlertsState.value
        if (state !is UiState.Success || state.data.isEmpty()) {
            _snackbarMessage.value = "Save a search filter first to monitor new matches"
            return
        }
        viewModelScope.launch {
            _isRefreshingAlerts.value = true
            var totalNewMatches = 0
            try {
                state.data.filter { it.alertsEnabled }.forEach { alert ->
                    runCatching {
                        mcpClient.searchRvs(filter = alert.toSearchFilter(), limit = 10)
                    }.onSuccess { result ->
                        val latestIds = result.units.map { it.unitId }
                        val prevSet = alert.lastCheckedUnitIds.toSet()
                        val unseenCount = latestIds.count { it !in prevSet }
                        totalNewMatches += unseenCount
                        firestoreRepository.updateAlertCheckResult(
                            alertId = alert.id,
                            matchCount = result.units.size,
                            newMatchCount = unseenCount,
                            latestUnitIds = latestIds
                        )
                    }
                }
                if (totalNewMatches > 0) {
                    val msg = "$totalNewMatches new dealer RV match${if (totalNewMatches > 1) "es" else ""} found for your alerts!"
                    _snackbarMessage.value = msg
                    _notificationEvent.value = AlertNotificationEvent(
                        id = 1002,
                        title = "MatchRV New Match Alert",
                        body = msg
                    )
                } else {
                    _snackbarMessage.value = "All saved search alerts checked — no unseen matches yet."
                }
            } finally {
                _isRefreshingAlerts.value = false
            }
        }
    }

    // --- Side-by-Side Compare (compare_rvs) ---

    fun toggleCompareSelection(unitId: String) {
        _compareState.update { state ->
            val next = if (unitId in state.selectedUnitIds) {
                state.selectedUnitIds - unitId
            } else if (state.selectedUnitIds.size < 4) {
                state.selectedUnitIds + unitId
            } else {
                _snackbarMessage.value = "You can compare up to 4 RVs at once"
                state.selectedUnitIds
            }
            state.copy(selectedUnitIds = next)
        }
    }

    fun runCompareSelected() {
        val ids = _compareState.value.selectedUnitIds.toList()
        if (ids.size < 2) {
            _snackbarMessage.value = "Select at least 2 saved RVs to compare"
            return
        }
        viewModelScope.launch {
            _compareState.update { it.copy(isComparing = true, errorMessage = null) }
            try {
                val res = mcpClient.compareRvs(ids)
                _compareState.update { it.copy(isComparing = false, result = res) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _compareState.update {
                    it.copy(
                        isComparing = false,
                        errorMessage = e.localizedMessage ?: "Compare failed"
                    )
                }
            }
        }
    }

    fun clearCompareResult() {
        _compareState.update { it.copy(result = null, errorMessage = null) }
    }

    private fun extractModelToken(title: String): String? {
        val tokens = title.split(" ").filter { it.length >= 3 && !it.all { ch -> ch.isDigit() } }
        return tokens.drop(1).take(2).joinToString(" ").takeIf { it.isNotBlank() }?.take(50)
    }
}
