package com.example.data.model

enum class RvTypeOption(val wireValue: String, val displayLabel: String) {
    TRAVEL_TRAILER("travel_trailer", "Travel Trailer"),
    FIFTH_WHEEL("fifth_wheel", "Fifth Wheel"),
    CLASS_C("class_c", "Class C"),
    CLASS_A("class_a", "Class A"),
    CLASS_B("class_b", "Class B"),
    TOY_HAULER("toy_hauler", "Toy Hauler"),
    POPUP_CAMPER("popup_camper", "Pop-Up"),
    TRUCK_CAMPER("truck_camper", "Truck Camper");

    companion object {
        fun fromWire(value: String?): RvTypeOption? =
            entries.firstOrNull { it.wireValue.equals(value, ignoreCase = true) }

        fun displayNameFor(wire: String?): String =
            fromWire(wire)?.displayLabel
                ?: wire?.replace("_", " ")?.replaceFirstChar { it.uppercase() }
                ?: "RV"
    }
}

enum class RvFeatureOption(val wireValue: String, val displayLabel: String) {
    BUNKHOUSE("bunkhouse", "Bunkhouse"),
    OUTDOOR_KITCHEN("outdoor_kitchen", "Outdoor Kitchen"),
    SOLAR("solar", "Solar"),
    LITHIUM("lithium", "Lithium"),
    GENERATOR("generator", "Generator"),
    FOUR_SEASON("four_season", "4-Season"),
    TWO_ENTRY_DOORS("two_entry_doors", "2 Entry Doors");

    companion object {
        fun fromWire(value: String?): RvFeatureOption? =
            entries.firstOrNull { it.wireValue.equals(value, ignoreCase = true) }
    }
}

enum class RvSortOption(val wireValue: String, val displayLabel: String) {
    BEST_MATCH("best_match", "Best Match"),
    PRICE_ASC("price_asc", "Price: Low-High"),
    PRICE_DESC("price_desc", "Price: High-Low"),
    DISTANCE("distance", "Closest First"),
    NEWEST_MODEL_YEAR("newest_model_year", "Newest Year");

    companion object {
        fun fromWire(value: String?): RvSortOption =
            entries.firstOrNull { it.wireValue.equals(value, ignoreCase = true) } ?: BEST_MATCH
    }
}

enum class RvConditionOption(val wireValue: String, val displayLabel: String) {
    ANY("any", "Any"),
    NEW("new", "New"),
    USED("used", "Used");

    companion object {
        fun fromWire(value: String?): RvConditionOption =
            entries.firstOrNull { it.wireValue.equals(value, ignoreCase = true) } ?: ANY
    }
}

data class RvSearchFilter(
    val rvTypes: Set<RvTypeOption> = emptySet(),
    val priceMinUsd: Double? = null,
    val priceMaxUsd: Double? = null,
    val location: String = "",
    val radiusMiles: Double? = null,
    val condition: RvConditionOption = RvConditionOption.ANY,
    val sleepsMin: Int? = null,
    val lengthMinFt: Double? = null,
    val lengthMaxFt: Double? = null,
    val towVehicle: String = "",
    val truckTowRatingLbs: Double? = null,
    val desiredFeatures: Set<RvFeatureOption> = emptySet(),
    val fuelType: String? = null,
    val make: String = "",
    val query: String = "",
    val sort: RvSortOption = RvSortOption.BEST_MATCH
) {
    fun activeFilterCount(): Int {
        var count = 0
        if (rvTypes.isNotEmpty()) count++
        if (priceMinUsd != null || priceMaxUsd != null) count++
        if (location.isNotBlank()) count++
        if (condition != RvConditionOption.ANY) count++
        if (sleepsMin != null) count++
        if (lengthMinFt != null || lengthMaxFt != null) count++
        if (towVehicle.isNotBlank() || truckTowRatingLbs != null) count++
        if (desiredFeatures.isNotEmpty()) count++
        if (!fuelType.isNullOrBlank()) count++
        if (make.isNotBlank()) count++
        if (sort != RvSortOption.BEST_MATCH) count++
        return count
    }

    fun toSummaryLabel(): String {
        val parts = mutableListOf<String>()
        if (rvTypes.isNotEmpty()) {
            parts.add(rvTypes.joinToString("/") { it.displayLabel })
        } else if (make.isNotBlank()) {
            parts.add(make.trim())
        } else {
            parts.add("All RVs")
        }
        if (priceMaxUsd != null) {
            parts.add("under $${formatCompactCurrency(priceMaxUsd)}")
        } else if (priceMinUsd != null) {
            parts.add("from $${formatCompactCurrency(priceMinUsd)}")
        }
        if (location.isNotBlank()) {
            val r = radiusMiles?.toInt()
            if (r != null) parts.add("within ${r}mi of ${location.trim()}")
            else parts.add("near ${location.trim()}")
        }
        if (sleepsMin != null) parts.add("sleeps $sleepsMin+")
        if (lengthMaxFt != null) parts.add("<=${lengthMaxFt.toInt()}ft")
        return parts.joinToString(" • ").take(175)
    }

    private fun formatCompactCurrency(amount: Double): String {
        return if (amount >= 1000.0) "${(amount / 1000.0).toInt()}k" else amount.toInt().toString()
    }
}

data class RvSummary(
    val unitId: String,
    val title: String,
    val make: String,
    val priceUsd: Double?,
    val lengthFt: Double?,
    val dryWeightLbs: Double?,
    val gvwrLbs: Double?,
    val sleeps: Int?,
    val distanceMi: Double?,
    val dealer: String,
    val dealerState: String,
    val matchScore: Int?,
    val verified: Boolean,
    val floorplan: String?,
    val walkthroughUrl: String?,
    val walkthroughLabel: String?,
    val listingUrl: String?,
    // Populated dynamically when get_rv hydrates this card
    val thumbnailUrl: String? = null,
    val rvType: String? = null,
    val condition: String? = null,
    val year: Int? = null,
    val isHydrated: Boolean = false
)

data class RvDetail(
    val unitId: String,
    val vin: String?,
    val stockNumber: String?,
    val title: String,
    val year: Int?,
    val make: String?,
    val model: String?,
    val trim: String?,
    val floorplanCode: String?,
    val rvType: String?,
    val condition: String?,
    val status: String?,
    val priceUsd: Double?,
    val priceNote: String?,
    val msrpUsd: Double?,
    val lengthFt: Double?,
    val dryWeightLbs: Double?,
    val gvwrLbs: Double?,
    val hitchWeightLbs: Double?,
    val sleeps: Int?,
    val slideouts: Int?,
    val freshWaterGal: Double?,
    val greyWaterGal: Double?,
    val blackWaterGal: Double?,
    val bunkhouse: Boolean?,
    val solar: Boolean?,
    val lithiumBattery: Boolean?,
    val generator: Boolean?,
    val fourSeason: Boolean?,
    val outdoorKitchen: Boolean?,
    val boondockingScore: Int?,
    val boondockingKnown: List<String>,
    val dealerName: String,
    val dealerCity: String?,
    val dealerState: String?,
    val dealerWebsite: String?,
    val images: List<String>,
    val description: String?,
    val features: List<String>,
    val listingUrl: String?,
    val lastSeenAt: String?,
    val availabilityGuidance: String?,
    val walkthroughUrl: String?,
    val walkthroughLabel: String?,
    val powertrainSummary: List<Pair<String, String>>
)

data class McpSearchResult(
    val units: List<RvSummary>,
    val eligibleUnitsCount: Int?,
    val scope: String,
    val expandedRadiusMiles: Double?,
    val timingMs: Long?
)

data class DealerInquiryPreview(
    val confirmationToken: String,
    val expiresAt: String?,
    val dealerName: String,
    val dealerLocation: String?,
    val deliveryMethod: String,
    val rvTitle: String,
    val vin: String?,
    val stockNumber: String?,
    val priceUsd: Double?,
    val shopperName: String,
    val shopperEmail: String?,
    val shopperPhone: String?,
    val message: String,
    val rawSummary: String?
)

data class DealerInquiryReceipt(
    val inquiryId: String,
    val statusToken: String,
    val status: String,
    val statusMessage: String,
    val dryRun: Boolean
)

data class DealerInquiryStatusResult(
    val inquiryId: String,
    val status: String,
    val dealerReply: String?,
    val statusSummary: String
)

data class TowFitEvaluation(
    val vehicleLabel: String,
    val summaryText: String,
    val unitVerdicts: List<TowFitUnitVerdict>
)

data class TowFitUnitVerdict(
    val unitId: String,
    val title: String,
    val verdict: String,
    val details: List<String>
)

data class RvComparisonResult(
    val summaryText: String,
    val rows: List<RvComparisonItem>
)

data class RvComparisonItem(
    val unitId: String,
    val title: String,
    val priceUsd: Double?,
    val lengthFt: Double?,
    val sleeps: Int?,
    val dryWeightLbs: Double?,
    val gvwrLbs: Double?,
    val dealer: String,
    val highlights: List<String>
)
