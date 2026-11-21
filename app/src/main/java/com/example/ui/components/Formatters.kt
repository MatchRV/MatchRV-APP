package com.example.ui.components

import androidx.compose.ui.graphics.Color
import com.example.ui.theme.MatchAmber
import com.example.ui.theme.MatchAqua
import com.example.ui.theme.MatchEmber
import com.example.ui.theme.MatchPassCoral
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.roundToInt

object RvFormatters {
    private val currencyFormat = NumberFormat.getCurrencyInstance(Locale.US).apply {
        maximumFractionDigits = 0
    }
    private val numberFormat = NumberFormat.getIntegerInstance(Locale.US)

    fun price(amount: Double?): String {
        if (amount == null || amount <= 0.0) return "Price on request"
        return currencyFormat.format(amount)
    }

    fun length(feet: Double?): String? {
        if (feet == null || feet <= 0.0) return null
        val rounded = (feet * 10.0).roundToInt() / 10.0
        return if (rounded % 1.0 == 0.0) "${rounded.toInt()} ft" else "$rounded ft"
    }

    fun weight(lbs: Double?): String? {
        if (lbs == null || lbs <= 0.0) return null
        return "${numberFormat.format(lbs.roundToInt())} lbs"
    }

    fun distance(miles: Double?): String? {
        if (miles == null || miles < 0.0) return null
        return "${numberFormat.format(miles.roundToInt())} mi"
    }

    fun inquiryStatusLabel(status: String): String = when (status.lowercase()) {
        "delivered" -> "Delivered to Dealer"
        "queued_for_matchrv" -> "Queued via MatchRV"
        "replied" -> "Dealer Replied"
        "dry_run" -> "Test Dry Run"
        "failed" -> "Delivery Failed"
        else -> status.replace("_", " ").replaceFirstChar { it.uppercase() }
    }

    fun inquiryStatusColor(status: String): Color = when (status.lowercase()) {
        "delivered", "replied" -> MatchAqua
        "queued_for_matchrv", "dry_run" -> MatchAmber
        "failed" -> MatchPassCoral
        else -> MatchEmber
    }
}
