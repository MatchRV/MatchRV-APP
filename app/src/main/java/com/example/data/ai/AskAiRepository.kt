package com.example.data.ai

import android.util.Log
import com.example.data.mcp.MatchRvMcpClient
import com.example.data.model.RvConditionOption
import com.example.data.model.RvFeatureOption
import com.example.data.model.RvSearchFilter
import com.example.data.model.RvSortOption
import com.example.data.model.RvSummary
import com.example.data.model.RvTypeOption
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

private const val TAG = "AskAiRepository"

data class AiCuratedDeckResult(
    val userPrompt: String,
    val agentSummary: String,
    val outfitterTip: String,
    val appliedFilter: RvSearchFilter,
    val appliedCriteriaChips: List<String>,
    val curatedDeck: List<RvSummary>
)

class AskAiRepository(
    private val mcpClient: MatchRvMcpClient
) {
    private val querySchema = Schema.obj(
        properties = mapOf(
            "agentSummary" to Schema.string(
                description = "A concise 1-2 sentence explanation of how you matched the shopper's RV request."
            ),
            "outfitterTip" to Schema.string(
                description = "One practical RV buying tip relevant to their query (e.g., payload, storage length, solar, or slide-out trade-offs)."
            ),
            "rvTypes" to Schema.array(
                items = Schema.enumeration(
                    values = RvTypeOption.entries.map { it.wireValue }
                ),
                description = "Matched RV types if mentioned by the shopper."
            ),
            "priceMinUsd" to Schema.double(
                description = "Minimum budget in USD if stated.",
                nullable = true
            ),
            "priceMaxUsd" to Schema.double(
                description = "Maximum budget in USD if stated.",
                nullable = true
            ),
            "location" to Schema.string(
                description = "City, state, or ZIP code if stated (no street address).",
                nullable = true
            ),
            "radiusMiles" to Schema.double(
                description = "Search radius in miles if stated (1 to 3000).",
                nullable = true
            ),
            "condition" to Schema.enumeration(
                values = listOf("any", "new", "used"),
                description = "Condition preference."
            ),
            "sleepsMin" to Schema.integer(
                description = "Minimum sleeping capacity if stated (1 to 14).",
                nullable = true
            ),
            "lengthMaxFt" to Schema.double(
                description = "Maximum length in feet if stated (8 to 60).",
                nullable = true
            ),
            "towVehicle" to Schema.string(
                description = "Tow vehicle year/make/model if stated.",
                nullable = true
            ),
            "truckTowRatingLbs" to Schema.double(
                description = "Explicit tow rating in pounds if stated.",
                nullable = true
            ),
            "desiredFeatures" to Schema.array(
                items = Schema.enumeration(
                    values = RvFeatureOption.entries.map { it.wireValue }
                ),
                description = "Preferred RV features if mentioned."
            ),
            "fuelType" to Schema.string(
                description = "Only 'gas' or 'diesel' if explicitly stated, otherwise null.",
                nullable = true
            ),
            "make" to Schema.string(
                description = "Manufacturer brand if explicitly named (e.g. Winnebago, Tiffin, Airstream, Grand Design).",
                nullable = true
            ),
            "keywords" to Schema.string(
                description = "Short RV keywords like 'slide-out' or 'bunkhouse' if useful for MCP search.",
                nullable = true
            ),
            "sort" to Schema.enumeration(
                values = RvSortOption.entries.map { it.wireValue },
                description = "Recommended sort order."
            )
        ),
        optionalProperties = listOf(
            "priceMinUsd",
            "priceMaxUsd",
            "location",
            "radiusMiles",
            "sleepsMin",
            "lengthMaxFt",
            "towVehicle",
            "truckTowRatingLbs",
            "fuelType",
            "make",
            "keywords"
        )
    )

    private val model by lazy {
        Firebase.ai.generativeModel(
            modelName = "gemini-3.8-flash",
            generationConfig = generationConfig {
                responseMimeType = "application/json"
                responseSchema = querySchema
            }
        )
    }

    suspend fun runAgentSearch(userPrompt: String): Result<AiCuratedDeckResult> {
        val cleanPrompt = userPrompt.trim()
        if (cleanPrompt.isBlank()) {
            return Result.failure(IllegalArgumentException("Tell MatchRV what kind of RV you're looking for."))
        }
        return try {
            val instruction = """
                You are the MatchRV AI Shopping Agent translating a buyer's natural-language RV request into exact filter parameters for the MatchRV MCP `search_rvs` tool.
                Rules:
                - Extract ONLY facts the shopper explicitly stated. Never invent a location, tow vehicle, fuel type, or budget they did not mention.
                - If they say "Class C", map to ["class_c"]. If "motorhome", map to ["class_a", "class_b", "class_c"].
                - If they mention "slide-out" or "slideout", include "slide-out" in keywords.
                - Keep agentSummary crisp, helpful, and buyer-focused.
                - Shopper request: "$cleanPrompt"
            """.trimIndent()

            val response = withTimeout(60_000L) {
                model.generateContent(instruction)
            }
            val jsonText = response.text
                ?: throw IllegalStateException("AI agent returned an empty response.")

            val parsed = JSONObject(jsonText)
            val rvTypes = buildSet {
                val arr = parsed.optJSONArray("rvTypes")
                if (arr != null) {
                    for (i in 0 until arr.length()) {
                        RvTypeOption.fromWire(arr.optString(i))?.let { add(it) }
                    }
                }
            }
            val desiredFeatures = buildSet {
                val arr = parsed.optJSONArray("desiredFeatures")
                if (arr != null) {
                    for (i in 0 until arr.length()) {
                        RvFeatureOption.fromWire(arr.optString(i))?.let { add(it) }
                    }
                }
            }

            val filter = RvSearchFilter(
                rvTypes = rvTypes,
                priceMinUsd = parsed.optNullableDouble("priceMinUsd"),
                priceMaxUsd = parsed.optNullableDouble("priceMaxUsd"),
                location = parsed.optNullableString("location").orEmpty(),
                radiusMiles = parsed.optNullableDouble("radiusMiles"),
                condition = RvConditionOption.fromWire(parsed.optNullableString("condition")),
                sleepsMin = parsed.optNullableInt("sleepsMin"),
                lengthMaxFt = parsed.optNullableDouble("lengthMaxFt"),
                towVehicle = parsed.optNullableString("towVehicle").orEmpty(),
                truckTowRatingLbs = parsed.optNullableDouble("truckTowRatingLbs"),
                desiredFeatures = desiredFeatures,
                fuelType = parsed.optNullableString("fuelType")
                    ?.lowercase()
                    ?.takeIf { it == "gas" || it == "diesel" },
                make = parsed.optNullableString("make").orEmpty(),
                query = parsed.optNullableString("keywords").orEmpty(),
                sort = RvSortOption.fromWire(parsed.optNullableString("sort"))
            )

            // Execute live MCP search with the AI-extracted constraints
            val mcpResult = mcpClient.searchRvs(filter = filter, limit = 10)

            val chips = buildList {
                filter.rvTypes.forEach { add(it.displayLabel) }
                if (filter.make.isNotBlank()) add(filter.make)
                if (filter.priceMaxUsd != null) add("Under $${filter.priceMaxUsd.toInt()}")
                if (filter.priceMinUsd != null) add("Min $${filter.priceMinUsd.toInt()}")
                if (filter.location.isNotBlank()) {
                    val r = filter.radiusMiles?.toInt()
                    add(if (r != null) "${filter.location} (${r}mi)" else filter.location)
                }
                if (filter.sleepsMin != null) add("Sleeps ${filter.sleepsMin}+")
                if (filter.lengthMaxFt != null) add("<= ${filter.lengthMaxFt.toInt()} ft")
                if (filter.condition != RvConditionOption.ANY) add(filter.condition.displayLabel)
                if (!filter.fuelType.isNullOrBlank()) add(filter.fuelType.replaceFirstChar { it.uppercase() })
                filter.desiredFeatures.forEach { add(it.displayLabel) }
                if (filter.query.isNotBlank()) add(filter.query)
            }

            Result.success(
                AiCuratedDeckResult(
                    userPrompt = cleanPrompt,
                    agentSummary = parsed.optString("agentSummary")
                        .ifBlank { "Curated live MatchRV dealer inventory for your criteria." },
                    outfitterTip = parsed.optString("outfitterTip")
                        .ifBlank { "Confirm current lot availability and out-the-door pricing directly with the dealer." },
                    appliedFilter = filter,
                    appliedCriteriaChips = chips,
                    curatedDeck = mcpResult.units
                )
            )
        } catch (e: TimeoutCancellationException) {
            Log.e(TAG, "AI agent search timed out", e)
            Result.failure(Exception("Ask AI timed out after 60 seconds. Please try again."))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Ask AI search failed", e)
            Result.failure(e)
        }
    }
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
