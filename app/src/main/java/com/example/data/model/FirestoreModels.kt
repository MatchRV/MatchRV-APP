package com.example.data.model

import androidx.annotation.Keep
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

fun sanitizeFirestoreDocId(raw: String): String {
    val cleaned = raw.replace(Regex("[^a-zA-Z0-9_\\-]"), "_").trim('_')
    return if (cleaned.isBlank()) "item_${System.currentTimeMillis()}" else cleaned.take(120)
}

@Keep
@IgnoreExtraProperties
data class SavedRvRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val unitId: String = "",
    val title: String = "",
    val make: String = "",
    val rvType: String = "",
    val dealerName: String = "",
    val dealerState: String = "",
    val savedPriceUsd: Double = 0.0,
    val lastCheckedPriceUsd: Double = 0.0,
    val hasPriceDrop: Boolean = false,
    val imageUrl: String? = null,
    val listingUrl: String? = null,
    val lengthFt: Double? = null,
    val sleeps: Long? = null,
    val gvwrLbs: Double? = null,
    val dryWeightLbs: Double? = null,
    val condition: String? = null,
    val year: Long? = null,
    val notes: String? = null,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun priceDropAmountUsd(): Double {
        return if (hasPriceDrop && savedPriceUsd > lastCheckedPriceUsd && lastCheckedPriceUsd > 0.0) {
            savedPriceUsd - lastCheckedPriceUsd
        } else 0.0
    }
}

@Keep
@IgnoreExtraProperties
data class SavedSearchAlertRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val label: String = "",
    val alertsEnabled: Boolean = true,
    val matchCount: Long = 0L,
    val newMatchCount: Long = 0L,
    val rvTypes: List<String> = emptyList(),
    val priceMinUsd: Double? = null,
    val priceMaxUsd: Double? = null,
    val location: String? = null,
    val radiusMiles: Double? = null,
    val sleepsMin: Long? = null,
    val lengthMaxFt: Double? = null,
    val condition: String? = null,
    val towVehicle: String? = null,
    val truckTowRatingLbs: Double? = null,
    val sort: String? = null,
    val lastCheckedUnitIds: List<String> = emptyList(),
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun toSearchFilter(): RvSearchFilter {
        return RvSearchFilter(
            rvTypes = rvTypes.mapNotNull { RvTypeOption.fromWire(it) }.toSet(),
            priceMinUsd = priceMinUsd,
            priceMaxUsd = priceMaxUsd,
            location = location.orEmpty(),
            radiusMiles = radiusMiles,
            condition = RvConditionOption.fromWire(condition),
            sleepsMin = sleepsMin?.toInt(),
            lengthMaxFt = lengthMaxFt,
            towVehicle = towVehicle.orEmpty(),
            truckTowRatingLbs = truckTowRatingLbs,
            sort = RvSortOption.fromWire(sort)
        )
    }
}

@Keep
@IgnoreExtraProperties
data class DealerInquiryRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val mcpInquiryId: String = "",
    val statusToken: String = "",
    val unitId: String = "",
    val rvTitle: String = "",
    val dealerName: String = "",
    val dealerLocation: String? = null,
    val status: String = "queued_for_matchrv",
    val message: String = "",
    val dryRun: Boolean = false,
    val priceUsd: Double? = null,
    val dealerReply: String? = null,
    val imageUrl: String? = null,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class AnalyticsEventRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val eventType: String = "",
    val unitId: String? = null,
    val queryText: String? = null,
    val rvType: String? = null,
    val priceUsd: Double? = null,
    val metadata: String? = null,
    @ServerTimestamp val createdAt: Timestamp? = null
)
