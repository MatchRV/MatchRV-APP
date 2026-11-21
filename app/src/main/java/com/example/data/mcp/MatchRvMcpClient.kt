package com.example.data.mcp

import android.util.Log
import com.example.data.model.DealerInquiryPreview
import com.example.data.model.DealerInquiryReceipt
import com.example.data.model.DealerInquiryStatusResult
import com.example.data.model.McpSearchResult
import com.example.data.model.RvComparisonItem
import com.example.data.model.RvComparisonResult
import com.example.data.model.RvConditionOption
import com.example.data.model.RvDetail
import com.example.data.model.RvSearchFilter
import com.example.data.model.RvSummary
import com.example.data.model.TowFitEvaluation
import com.example.data.model.TowFitUnitVerdict
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

private const val TAG = "MatchRvMcpClient"
private const val MCP_ENDPOINT = "https://matchrv.com/mcp"
private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

class MatchRvMcpClient(
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()
) {
    private val sessionMutex = Mutex()
    @Volatile
    private var sessionId: String? = null
    private val requestId = AtomicInteger(1)

    // In-memory cache for hydrated get_rv details and thumbnails
    private val detailCache = ConcurrentHashMap<String, RvDetail>()

    fun getCachedDetail(unitId: String): RvDetail? = detailCache[unitId]

    private suspend fun ensureSession(forceReset: Boolean = false): String? {
        if (!forceReset && sessionId != null) return sessionId
        return sessionMutex.withLock {
            if (!forceReset && sessionId != null) return@withLock sessionId
            val initParams = JSONObject().apply {
                put("protocolVersion", "2024-11-05")
                put("capabilities", JSONObject())
                put("clientInfo", JSONObject().apply {
                    put("name", "matchrv-android")
                    put("version", "1.0.0")
                })
            }
            val (_, newSid) = executeRawRpc(
                method = "initialize",
                params = initParams,
                currentSessionId = null,
                includeId = true
            )
            sessionId = newSid
            // Send initialized notification (best effort)
            runCatching {
                executeRawRpc(
                    method = "notifications/initialized",
                    params = null,
                    currentSessionId = sessionId,
                    includeId = false
                )
            }
            sessionId
        }
    }

    private suspend fun callTool(
        toolName: String,
        arguments: JSONObject
    ): Pair<JSONObject, String> = withContext(Dispatchers.IO) {
        val sid = ensureSession()
        val params = JSONObject().apply {
            put("name", toolName)
            put("arguments", arguments)
        }
        val (responseJson, _) = try {
            executeRawRpc("tools/call", params, sid, includeId = true)
        } catch (e: McpSessionExpiredException) {
            val freshSid = ensureSession(forceReset = true)
            executeRawRpc("tools/call", params, freshSid, includeId = true)
        }

        if (responseJson.has("error") && !responseJson.isNull("error")) {
            val errObj = responseJson.optJSONObject("error")
            val msg = errObj?.optString("message").orEmpty().ifBlank { "MatchRV MCP error" }
            throw IOException(msg)
        }

        val resultObj = responseJson.optJSONObject("result")
            ?: throw IOException("Empty MCP result for $toolName")

        if (resultObj.optBoolean("isError", false)) {
            val errText = extractTextContent(resultObj).ifBlank { "Tool $toolName returned an error." }
            throw IOException(errText)
        }

        val textSummary = extractTextContent(resultObj)
        val structured = resultObj.optJSONObject("structuredContent")
            ?: runCatching {
                if (textSummary.trim().startsWith("{")) JSONObject(textSummary) else JSONObject()
            }.getOrDefault(JSONObject())

        structured to textSummary
    }

    private fun extractTextContent(resultObj: JSONObject): String {
        val arr = resultObj.optJSONArray("content") ?: return ""
        val sb = StringBuilder()
        for (i in 0 until arr.length()) {
            val item = arr.optJSONObject(i) ?: continue
            val text = item.optString("text")
            if (text.isNotBlank()) {
                if (sb.isNotEmpty()) sb.append("\n")
                sb.append(text)
            }
        }
        return sb.toString()
    }

    private fun executeRawRpc(
        method: String,
        params: JSONObject?,
        currentSessionId: String?,
        includeId: Boolean
    ): Pair<JSONObject, String?> {
        val bodyJson = JSONObject().apply {
            put("jsonrpc", "2.0")
            put("method", method)
            if (includeId) put("id", requestId.getAndIncrement())
            if (params != null) put("params", params)
        }
        val reqBuilder = Request.Builder()
            .url(MCP_ENDPOINT)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("User-Agent", "MatchRV-Android/1.0")
            .post(bodyJson.toString().toRequestBody(JSON_MEDIA_TYPE))

        if (!currentSessionId.isNullOrBlank()) {
            reqBuilder.header("Mcp-Session-Id", currentSessionId)
        }

        httpClient.newCall(reqBuilder.build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val returnedSid = response.header("Mcp-Session-Id")
                ?: response.header("mcp-session-id")
                ?: currentSessionId

            if (response.code == 400 || response.code == 404) {
                if (currentSessionId != null && raw.contains("session", ignoreCase = true)) {
                    throw McpSessionExpiredException()
                }
            }
            if (!response.isSuccessful) {
                Log.e(TAG, "MCP HTTP ${response.code}: ${raw.take(400)}")
                throw IOException("MatchRV server responded with HTTP ${response.code}")
            }
            if (!includeId && raw.isBlank()) {
                return JSONObject() to returnedSid
            }
            val parsed = parseMcpPayload(raw)
                ?: throw IOException("Unable to parse response from MatchRV MCP")
            return parsed to returnedSid
        }
    }

    private fun parseMcpPayload(raw: String): JSONObject? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return null
        if (trimmed.startsWith("{")) {
            return runCatching { JSONObject(trimmed) }.getOrNull()
        }
        var lastJson: JSONObject? = null
        trimmed.lineSequence().forEach { line ->
            if (line.startsWith("data:")) {
                val data = line.removePrefix("data:").trim()
                if (data.startsWith("{")) {
                    runCatching { JSONObject(data) }.getOrNull()?.let { lastJson = it }
                }
            }
        }
        return lastJson
    }

    suspend fun searchRvs(
        filter: RvSearchFilter,
        excludeModels: List<String> = emptyList(),
        limit: Int = 10
    ): McpSearchResult {
        val args = JSONObject().apply {
            put("shopper_requested_results_now", true)
            put("shopper_words", "just show me matching RVs")
            put("limit", limit.coerceIn(1, 10))

            if (filter.rvTypes.isNotEmpty()) {
                put("rv_types", JSONArray(filter.rvTypes.map { it.wireValue }))
            }
            if (filter.priceMinUsd != null && filter.priceMinUsd > 0.0) {
                put("price_min_usd", filter.priceMinUsd.coerceIn(0.0, 2_000_000.0))
            }
            if (filter.priceMaxUsd != null && filter.priceMaxUsd > 0.0) {
                put("price_max_usd", filter.priceMaxUsd.coerceIn(0.0, 2_000_000.0))
            }
            if (filter.location.isNotBlank()) {
                put("location", filter.location.trim().take(80))
                if (filter.radiusMiles != null) {
                    put("radius_miles", filter.radiusMiles.coerceIn(1.0, 3000.0))
                }
            }
            if (filter.condition != RvConditionOption.ANY) {
                put("condition", filter.condition.wireValue)
            }
            if (filter.sleepsMin != null) {
                put("sleeps_min", filter.sleepsMin.coerceIn(1, 14))
            }
            if (filter.lengthMaxFt != null) {
                put("length_max_ft", filter.lengthMaxFt.coerceIn(8.0, 60.0))
            }
            if (filter.towVehicle.isNotBlank()) {
                put("tow_vehicle", filter.towVehicle.trim().take(120))
            }
            if (filter.truckTowRatingLbs != null) {
                put("truck_tow_rating_lbs", filter.truckTowRatingLbs.coerceIn(1000.0, 40000.0))
            }
            if (filter.desiredFeatures.isNotEmpty()) {
                put("desired_features", JSONArray(filter.desiredFeatures.map { it.wireValue }))
            }
            if (!filter.fuelType.isNullOrBlank() && filter.fuelType in listOf("gas", "diesel")) {
                put("fuel_type", filter.fuelType)
            }
            if (filter.make.isNotBlank()) {
                put("make", filter.make.trim().take(60))
            }
            if (filter.query.isNotBlank()) {
                put("query", filter.query.trim().take(240))
            }
            if (excludeModels.isNotEmpty()) {
                put("exclude_models", JSONArray(excludeModels.take(6)))
            }
            put("sort", filter.sort.wireValue)

            if (filter.lengthMinFt != null) {
                put("constraints", JSONObject().apply {
                    put("lengthMinFt", filter.lengthMinFt.coerceIn(8.0, 60.0))
                })
            }
        }

        val (structured, _) = callTool("search_rvs", args)
        val resultsArray = structured.optJSONArray("results") ?: JSONArray()
        val units = buildList {
            for (i in 0 until resultsArray.length()) {
                val obj = resultsArray.optJSONObject(i) ?: continue
                val unitId = obj.optString("unit_id").ifBlank { obj.optString("id") }
                if (unitId.isBlank()) continue
                val walkthrough = obj.optJSONObject("walkthrough")
                val cached = detailCache[unitId]
                val title = obj.optString("title").ifBlank { "RV Listing" }
                add(
                    RvSummary(
                        unitId = unitId,
                        title = title,
                        make = obj.optString("make").ifBlank { cached?.make.orEmpty() },
                        priceUsd = obj.optNullableDouble("price") ?: cached?.priceUsd,
                        lengthFt = obj.optNullableDouble("lengthFt") ?: cached?.lengthFt,
                        dryWeightLbs = obj.optNullableDouble("dryLbs") ?: cached?.dryWeightLbs,
                        gvwrLbs = obj.optNullableDouble("gvwrLbs") ?: cached?.gvwrLbs,
                        sleeps = obj.optNullableInt("sleeps") ?: cached?.sleeps,
                        distanceMi = obj.optNullableDouble("distanceMi"),
                        dealer = obj.optString("dealer").ifBlank { cached?.dealerName.orEmpty() },
                        dealerState = obj.optString("dealerState").ifBlank { cached?.dealerState.orEmpty() },
                        matchScore = obj.optNullableInt("match"),
                        verified = obj.optBoolean("verified", false),
                        floorplan = obj.optNullableString("floorplan")?.takeUnless { it == "unknown" },
                        walkthroughUrl = walkthrough?.optNullableString("url"),
                        walkthroughLabel = walkthrough?.optNullableString("label"),
                        listingUrl = obj.optNullableString("sleepsSourceUrl") ?: cached?.listingUrl,
                        thumbnailUrl = cached?.images?.firstOrNull(),
                        rvType = cached?.rvType,
                        condition = cached?.condition,
                        year = cached?.year ?: extractYearFromTitle(title),
                        isHydrated = cached != null
                    )
                )
            }
        }

        val quality = structured.optJSONObject("inventoryQuality")
        val coverage = structured.optJSONObject("coverage")
        return McpSearchResult(
            units = units,
            eligibleUnitsCount = quality?.optNullableInt("eligibleUnits"),
            scope = coverage?.optString("scope").orEmpty().ifBlank { "nationwide" },
            expandedRadiusMiles = coverage?.optNullableDouble("expanded_radius_miles"),
            timingMs = structured.optNullableLong("timingMs")
        )
    }

    suspend fun getRv(unitId: String, forceRefresh: Boolean = false): RvDetail {
        if (!forceRefresh) {
            detailCache[unitId]?.let { return it }
        }
        val args = JSONObject().apply {
            put("unit_id", unitId)
        }
        val (structured, _) = callTool("get_rv", args)
        val unit = structured.optJSONObject("unit")
            ?: throw IOException("Unit details unavailable for $unitId")
        val availability = structured.optJSONObject("availability")
        val walkthrough = structured.optJSONObject("walkthrough")
        val dealer = unit.optJSONObject("dealer")
        val provenance = unit.optJSONObject("provenance")
        val boondocking = unit.optJSONObject("boondocking")

        val images = buildList {
            val arr = unit.optJSONArray("images")
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val u = arr.optString(i)
                    if (u.startsWith("http")) add(u)
                }
            }
        }

        val features = buildList {
            val arr = unit.optJSONArray("features")
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val f = arr.optString(i)
                    if (f.isNotBlank()) add(f)
                }
            }
        }

        val boondockingKnown = buildList {
            val arr = boondocking?.optJSONArray("knownInputs")
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val s = arr.optString(i)
                    if (s.isNotBlank()) add(s)
                }
            }
        }

        val powertrain = mutableListOf<Pair<String, String>>()
        val pt = unit.optJSONObject("powertrainAndTowing")
            ?: structured.optJSONObject("powertrainAndTowing")
        if (pt != null) {
            val keys = pt.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val rawVal = pt.opt(key)
                val formatted = when (rawVal) {
                    is JSONObject -> rawVal.opt("value")?.takeIf { it != JSONObject.NULL }?.toString()
                    is String, is Number, is Boolean -> rawVal.toString()
                    else -> null
                }
                if (!formatted.isNullOrBlank()) {
                    val label = key.replace(Regex("([A-Z])"), " $1")
                        .replaceFirstChar { it.uppercase() }
                    powertrain.add(label to formatted)
                }
            }
        }

        val detail = RvDetail(
            unitId = unit.optString("id").ifBlank { unitId },
            vin = unit.optNullableString("vin"),
            stockNumber = unit.optNullableString("stockNumber"),
            title = unit.optString("title").ifBlank { "RV Unit" },
            year = unit.optNullableInt("year"),
            make = unit.optNullableString("make"),
            model = unit.optNullableString("model"),
            trim = unit.optNullableString("trim"),
            floorplanCode = unit.optNullableString("floorplanCode"),
            rvType = unit.optNullableString("rvType"),
            condition = unit.optNullableString("condition"),
            status = availability?.optNullableString("status") ?: unit.optNullableString("status"),
            priceUsd = unit.extractSpecDouble("priceUsd"),
            priceNote = unit.optJSONObject("priceUsd")?.optNullableString("note"),
            msrpUsd = unit.extractSpecDouble("msrpUsd"),
            lengthFt = unit.extractSpecDouble("lengthFt"),
            dryWeightLbs = unit.extractSpecDouble("dryWeightLbs"),
            gvwrLbs = unit.extractSpecDouble("gvwrLbs"),
            hitchWeightLbs = unit.extractSpecDouble("hitchWeightLbs"),
            sleeps = unit.extractSpecInt("sleeps"),
            slideouts = unit.extractSpecInt("slideouts"),
            freshWaterGal = unit.extractSpecDouble("freshWaterGal"),
            greyWaterGal = unit.extractSpecDouble("greyWaterGal"),
            blackWaterGal = unit.extractSpecDouble("blackWaterGal"),
            bunkhouse = unit.extractSpecBoolean("bunkhouse"),
            solar = unit.extractSpecBoolean("solar"),
            lithiumBattery = unit.extractSpecBoolean("lithiumBattery"),
            generator = unit.extractSpecBoolean("generator"),
            fourSeason = unit.extractSpecBoolean("fourSeason"),
            outdoorKitchen = unit.extractSpecBoolean("outdoorKitchen"),
            boondockingScore = boondocking?.optNullableInt("score"),
            boondockingKnown = boondockingKnown,
            dealerName = dealer?.optString("name").orEmpty().ifBlank { "Authorized RV Dealer" },
            dealerCity = dealer?.optNullableString("city"),
            dealerState = dealer?.optNullableString("state"),
            dealerWebsite = dealer?.optNullableString("website"),
            images = images,
            description = unit.optNullableString("description"),
            features = features,
            listingUrl = availability?.optNullableString("dealerListingUrl")
                ?: provenance?.optNullableString("listingUrl"),
            lastSeenAt = availability?.optNullableString("lastSeenAt")
                ?: provenance?.optNullableString("lastSeenAt"),
            availabilityGuidance = availability?.optNullableString("guidance"),
            walkthroughUrl = walkthrough?.optNullableString("url"),
            walkthroughLabel = walkthrough?.optNullableString("label"),
            powertrainSummary = powertrain
        )

        detailCache[unitId] = detail
        return detail
    }

    suspend fun evaluateTowFit(
        unitIds: List<String>,
        vehicle: String,
        truckPayloadLbs: Double? = null,
        passengersLbs: Double? = null,
        cargoLbs: Double? = null
    ): TowFitEvaluation {
        require(unitIds.isNotEmpty()) { "At least one RV unit is required" }
        require(vehicle.isNotBlank()) { "Please enter your tow vehicle" }
        val args = JSONObject().apply {
            put("unit_ids", JSONArray(unitIds.take(6)))
            put("vehicle", vehicle.trim().take(120))
            if (truckPayloadLbs != null && truckPayloadLbs > 0) put("truck_payload_lbs", truckPayloadLbs)
            if (passengersLbs != null && passengersLbs >= 0) put("passengers_lbs", passengersLbs)
            if (cargoLbs != null && cargoLbs >= 0) put("cargo_lbs", cargoLbs)
        }
        val (structured, textSummary) = callTool("evaluate_tow_fit", args)
        val verdicts = mutableListOf<TowFitUnitVerdict>()
        val resultsArr = structured.optJSONArray("results")
            ?: structured.optJSONArray("evaluations")
            ?: structured.optJSONArray("units")
            ?: JSONArray()
        for (i in 0 until resultsArr.length()) {
            val item = resultsArr.optJSONObject(i) ?: continue
            val details = mutableListOf<String>()
            item.optNullableString("summary")?.let { details.add(it) }
            item.optNullableString("reason")?.let { details.add(it) }
            item.optJSONArray("notes")?.let { arr ->
                for (j in 0 until arr.length()) {
                    arr.optString(j).takeIf { it.isNotBlank() }?.let { details.add(it) }
                }
            }
            item.optJSONArray("warnings")?.let { arr ->
                for (j in 0 until arr.length()) {
                    arr.optString(j).takeIf { it.isNotBlank() }?.let { details.add(it) }
                }
            }
            verdicts.add(
                TowFitUnitVerdict(
                    unitId = item.optString("unit_id").ifBlank { item.optString("unitId") },
                    title = item.optString("title").ifBlank { "RV Unit" },
                    verdict = item.optString("verdict")
                        .ifBlank { item.optString("status") }
                        .ifBlank { "Screening Complete" },
                    details = details
                )
            )
        }
        val readableSummary = structured.optNullableString("summary")
            ?: structured.optNullableString("disclaimer")
            ?: textSummary.take(800).ifBlank { "Tow-fit screening completed for $vehicle." }

        return TowFitEvaluation(
            vehicleLabel = vehicle.trim(),
            summaryText = readableSummary,
            unitVerdicts = verdicts
        )
    }

    suspend fun compareRvs(unitIds: List<String>): RvComparisonResult {
        require(unitIds.size in 2..4) { "Select 2 to 4 RVs to compare" }
        val args = JSONObject().apply {
            put("unit_ids", JSONArray(unitIds))
        }
        val (structured, textSummary) = callTool("compare_rvs", args)
        val items = mutableListOf<RvComparisonItem>()
        val arr = structured.optJSONArray("units")
            ?: structured.optJSONArray("comparison")
            ?: structured.optJSONArray("results")
            ?: JSONArray()

        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val uid = obj.optString("unit_id").ifBlank { obj.optString("id") }
            val cached = detailCache[uid]
            val highlights = mutableListOf<String>()
            obj.optJSONArray("highlights")?.let { h ->
                for (j in 0 until h.length()) {
                    h.optString(j).takeIf { it.isNotBlank() }?.let { highlights.add(it) }
                }
            }
            obj.optJSONArray("pros")?.let { h ->
                for (j in 0 until h.length()) {
                    h.optString(j).takeIf { it.isNotBlank() }?.let { highlights.add(it) }
                }
            }
            items.add(
                RvComparisonItem(
                    unitId = uid,
                    title = obj.optString("title").ifBlank { cached?.title ?: "RV" },
                    priceUsd = obj.extractSpecDouble("priceUsd")
                        ?: obj.optNullableDouble("price")
                        ?: cached?.priceUsd,
                    lengthFt = obj.extractSpecDouble("lengthFt") ?: cached?.lengthFt,
                    sleeps = obj.extractSpecInt("sleeps") ?: cached?.sleeps,
                    dryWeightLbs = obj.extractSpecDouble("dryWeightLbs")
                        ?: obj.optNullableDouble("dryLbs")
                        ?: cached?.dryWeightLbs,
                    gvwrLbs = obj.extractSpecDouble("gvwrLbs") ?: cached?.gvwrLbs,
                    dealer = obj.optString("dealer")
                        .ifBlank { obj.optJSONObject("dealer")?.optString("name").orEmpty() }
                        .ifBlank { cached?.dealerName ?: "Dealer" },
                    highlights = highlights
                )
            )
        }
        return RvComparisonResult(
            summaryText = structured.optNullableString("summary")
                ?: textSummary.take(1000).ifBlank { "Side-by-side comparison ready." },
            rows = items
        )
    }

    suspend fun prepareDealerInquiry(
        unitId: String,
        name: String,
        email: String?,
        phone: String?,
        message: String
    ): DealerInquiryPreview {
        require(name.isNotBlank()) { "Please enter your name." }
        require(!email.isNullOrBlank() || !phone.isNullOrBlank()) {
            "Please provide an email address or phone number."
        }
        require(message.isNotBlank()) { "Please include a message for the dealer." }

        val args = JSONObject().apply {
            put("unit_id", unitId)
            put("name", name.trim().take(100))
            if (!email.isNullOrBlank()) put("email", email.trim().take(120))
            if (!phone.isNullOrBlank()) put("phone", phone.trim().take(40))
            put("message", message.trim().take(1800))
        }

        val (structured, textSummary) = callTool("prepare_dealer_inquiry", args)
        val previewObj = structured.optJSONObject("preview") ?: structured
        val token = structured.optNullableString("confirmation_token")
            ?: structured.optNullableString("confirmationToken")
            ?: previewObj.optNullableString("confirmation_token")
            ?: previewObj.optNullableString("confirmationToken")
            ?: throw IOException("MatchRV did not return a confirmation token. Please check your contact details.")

        val dealerObj = previewObj.optJSONObject("dealer")
        val rvObj = previewObj.optJSONObject("rv") ?: previewObj.optJSONObject("unit")
        val shopperObj = previewObj.optJSONObject("shopper")

        return DealerInquiryPreview(
            confirmationToken = token,
            expiresAt = structured.optNullableString("expires_at")
                ?: structured.optNullableString("expiresAt"),
            dealerName = dealerObj?.optNullableString("name")
                ?: previewObj.optNullableString("dealerName")
                ?: previewObj.optNullableString("dealer")
                ?: "Dealership",
            dealerLocation = dealerObj?.let {
                listOfNotNull(it.optNullableString("city"), it.optNullableString("state"))
                    .joinToString(", ")
                    .ifBlank { it.optNullableString("location") }
            } ?: previewObj.optNullableString("dealerLocation"),
            deliveryMethod = previewObj.optNullableString("deliveryMethod")
                ?: previewObj.optNullableString("delivery")
                ?: structured.optNullableString("deliveryMethod")
                ?: "MatchRV Verified Dealer Delivery",
            rvTitle = rvObj?.optNullableString("title")
                ?: previewObj.optNullableString("rvTitle")
                ?: "RV Unit",
            vin = rvObj?.optNullableString("vin") ?: previewObj.optNullableString("vin"),
            stockNumber = rvObj?.optNullableString("stockNumber")
                ?: rvObj?.optNullableString("stock_number")
                ?: previewObj.optNullableString("stockNumber"),
            priceUsd = rvObj?.optNullableDouble("priceUsd")
                ?: rvObj?.optNullableDouble("price")
                ?: previewObj.optNullableDouble("priceUsd"),
            shopperName = shopperObj?.optNullableString("name") ?: name.trim(),
            shopperEmail = shopperObj?.optNullableString("email") ?: email?.trim(),
            shopperPhone = shopperObj?.optNullableString("phone") ?: phone?.trim(),
            message = previewObj.optNullableString("message") ?: message.trim(),
            rawSummary = textSummary.takeIf { it.isNotBlank() }
        )
    }

    suspend fun sendDealerInquiry(
        confirmationToken: String,
        dryRun: Boolean = false
    ): DealerInquiryReceipt {
        require(confirmationToken.isNotBlank()) { "Missing confirmation token." }
        val args = JSONObject().apply {
            put("confirmation_token", confirmationToken)
            put("confirmed", true)
            if (dryRun) put("dry_run", true)
        }
        val (structured, textSummary) = callTool("send_dealer_inquiry", args)
        val inquiryId = structured.optNullableString("inquiry_id")
            ?: structured.optNullableString("inquiryId")
            ?: "inq_${System.currentTimeMillis()}"
        val statusToken = structured.optNullableString("status_token")
            ?: structured.optNullableString("statusToken")
            ?: "dry_run_token"
        val rawStatus = structured.optNullableString("status")
            ?: if (dryRun) "dry_run" else "queued_for_matchrv"
        val normalizedStatus = when (rawStatus.lowercase()) {
            "delivered", "queued_for_matchrv", "failed", "dry_run", "replied" -> rawStatus.lowercase()
            else -> if (dryRun) "dry_run" else "queued_for_matchrv"
        }

        return DealerInquiryReceipt(
            inquiryId = inquiryId,
            statusToken = statusToken,
            status = normalizedStatus,
            statusMessage = structured.optNullableString("message")
                ?: structured.optNullableString("summary")
                ?: textSummary.ifBlank { "Inquiry recorded with status: $normalizedStatus" },
            dryRun = dryRun || normalizedStatus == "dry_run"
        )
    }

    suspend fun getDealerInquiryStatus(
        inquiryId: String,
        statusToken: String
    ): DealerInquiryStatusResult {
        val args = JSONObject().apply {
            put("inquiry_id", inquiryId)
            put("status_token", statusToken)
        }
        val (structured, textSummary) = callTool("get_dealer_inquiry_status", args)
        val replyObj = structured.optJSONObject("reply") ?: structured.optJSONObject("dealerReply")
        val replyText = replyObj?.optNullableString("message")
            ?: replyObj?.optNullableString("body")
            ?: structured.optNullableString("dealer_reply")
            ?: structured.optNullableString("dealerReply")
        val rawStatus = structured.optNullableString("status") ?: "queued_for_matchrv"
        val normalizedStatus = if (!replyText.isNullOrBlank()) {
            "replied"
        } else {
            when (rawStatus.lowercase()) {
                "delivered", "queued_for_matchrv", "failed", "dry_run", "replied" -> rawStatus.lowercase()
                else -> "queued_for_matchrv"
            }
        }
        return DealerInquiryStatusResult(
            inquiryId = inquiryId,
            status = normalizedStatus,
            dealerReply = replyText,
            statusSummary = structured.optNullableString("summary")
                ?: textSummary.ifBlank { "Current status: $normalizedStatus" }
        )
    }

    private fun extractYearFromTitle(title: String): Int? {
        val match = Regex("\\b(19[89]\\d|20[0-3]\\d)\\b").find(title)
        return match?.groupValues?.getOrNull(1)?.toIntOrNull()
    }

    private class McpSessionExpiredException : IOException("MCP session expired")
}

private fun JSONObject.optNullableString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    val v = optString(key)
    return v.takeIf { it.isNotBlank() && it != "null" }
}

private fun JSONObject.optNullableDouble(key: String): Double? {
    if (!has(key) || isNull(key)) return null
    val raw = opt(key)
    return when (raw) {
        is Number -> raw.toDouble()
        is String -> raw.toDoubleOrNull()
        else -> null
    }
}

private fun JSONObject.optNullableInt(key: String): Int? {
    if (!has(key) || isNull(key)) return null
    val raw = opt(key)
    return when (raw) {
        is Number -> raw.toInt()
        is String -> raw.toIntOrNull()
        else -> null
    }
}

private fun JSONObject.optNullableLong(key: String): Long? {
    if (!has(key) || isNull(key)) return null
    val raw = opt(key)
    return when (raw) {
        is Number -> raw.toLong()
        is String -> raw.toLongOrNull()
        else -> null
    }
}

private fun JSONObject.extractSpecDouble(key: String): Double? {
    if (!has(key) || isNull(key)) return null
    val raw = opt(key)
    return when (raw) {
        is JSONObject -> raw.optNullableDouble("value")
        is Number -> raw.toDouble()
        is String -> raw.toDoubleOrNull()
        else -> null
    }
}

private fun JSONObject.extractSpecInt(key: String): Int? {
    if (!has(key) || isNull(key)) return null
    val raw = opt(key)
    return when (raw) {
        is JSONObject -> raw.optNullableInt("value")
        is Number -> raw.toInt()
        is String -> raw.toIntOrNull()
        else -> null
    }
}

private fun JSONObject.extractSpecBoolean(key: String): Boolean? {
    if (!has(key) || isNull(key)) return null
    val raw = opt(key)
    return when (raw) {
        is JSONObject -> if (raw.isNull("value")) null else raw.opt("value") as? Boolean
        is Boolean -> raw
        else -> null
    }
}
