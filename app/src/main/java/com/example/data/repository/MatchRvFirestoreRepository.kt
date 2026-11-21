package com.example.data.repository

import android.content.Context
import com.example.R
import com.example.data.model.AnalyticsEventRecord
import com.example.data.model.DealerInquiryRecord
import com.example.data.model.RvConditionOption
import com.example.data.model.RvDetail
import com.example.data.model.RvSearchFilter
import com.example.data.model.RvSummary
import com.example.data.model.SavedRvRecord
import com.example.data.model.SavedSearchAlertRecord
import com.example.data.model.sanitizeFirestoreDocId
import com.example.firebase.OperationType
import com.example.firebase.handleFirestoreError
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

class MatchRvFirestoreRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        )
    )

    private fun requireUserId(): String {
        return auth.currentUser?.uid
            ?: throw IllegalStateException("User must be signed in with Google before accessing Firestore.")
    }

    fun observeSavedRvs(userId: String): Flow<List<SavedRvRecord>> = flow {
        val path = "users/$userId/saved_rvs"
        emitAll(
            db.collection("users").document(userId).collection("saved_rvs")
                .snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        SavedRvRecord::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt?.seconds ?: 0L }
                }
                .catch { error ->
                    logStreamError(error, path, userId)
                    throw error
                }
        )
    }

    fun observeSavedAlerts(userId: String): Flow<List<SavedSearchAlertRecord>> = flow {
        val path = "users/$userId/saved_alerts"
        emitAll(
            db.collection("users").document(userId).collection("saved_alerts")
                .snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        SavedSearchAlertRecord::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt?.seconds ?: 0L }
                }
                .catch { error ->
                    logStreamError(error, path, userId)
                    throw error
                }
        )
    }

    fun observeInquiries(userId: String): Flow<List<DealerInquiryRecord>> = flow {
        val path = "users/$userId/inquiries"
        emitAll(
            db.collection("users").document(userId).collection("inquiries")
                .snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        DealerInquiryRecord::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt?.seconds ?: 0L }
                }
                .catch { error ->
                    logStreamError(error, path, userId)
                    throw error
                }
        )
    }

    fun observeAnalyticsEvents(userId: String): Flow<List<AnalyticsEventRecord>> = flow {
        val path = "users/$userId/analytics_events"
        emitAll(
            db.collection("users").document(userId).collection("analytics_events")
                .snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        AnalyticsEventRecord::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt?.seconds ?: 0L }
                }
                .catch { error ->
                    logStreamError(error, path, userId)
                    throw error
                }
        )
    }

    suspend fun saveRv(rv: RvSummary, detail: RvDetail? = null): Result<Unit> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Please sign in to save RVs."))
        val docId = sanitizeFirestoreDocId(rv.unitId)
        val path = "users/$uid/saved_rvs/$docId"
        return try {
            val price = (detail?.priceUsd ?: rv.priceUsd ?: 0.0).coerceIn(0.0, 5_000_000.0)
            val payload = mutableMapOf<String, Any?>(
                "userId" to uid,
                "unitId" to rv.unitId.take(160),
                "title" to (detail?.title ?: rv.title).ifBlank { "RV Listing" }.take(240),
                "make" to (detail?.make ?: rv.make).take(80),
                "rvType" to (detail?.rvType ?: rv.rvType.orEmpty()).take(60),
                "dealerName" to (detail?.dealerName ?: rv.dealer).take(180),
                "dealerState" to (detail?.dealerState ?: rv.dealerState).take(40),
                "savedPriceUsd" to price,
                "lastCheckedPriceUsd" to price,
                "hasPriceDrop" to false,
                "imageUrl" to (detail?.images?.firstOrNull() ?: rv.thumbnailUrl)?.take(1000),
                "listingUrl" to (detail?.listingUrl ?: rv.listingUrl)?.take(1000),
                "lengthFt" to (detail?.lengthFt ?: rv.lengthFt)?.coerceIn(0.0, 100.0),
                "sleeps" to (detail?.sleeps ?: rv.sleeps)?.coerceIn(0, 20),
                "gvwrLbs" to (detail?.gvwrLbs ?: rv.gvwrLbs)?.coerceIn(0.0, 100_000.0),
                "dryWeightLbs" to (detail?.dryWeightLbs ?: rv.dryWeightLbs)?.coerceIn(0.0, 100_000.0),
                "condition" to (detail?.condition ?: rv.condition)?.take(30),
                "year" to (detail?.year ?: rv.year)?.takeIf { it in 1950..2035 },
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }

            db.collection("users").document(uid)
                .collection("saved_rvs").document(docId)
                .set(payload)
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    suspend fun updateSavedRvPrice(
        savedId: String,
        newPriceUsd: Double,
        savedBaselinePriceUsd: Double,
        imageUrl: String?
    ): Result<Boolean> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Please sign in."))
        val path = "users/$uid/saved_rvs/$savedId"
        return try {
            val clamped = newPriceUsd.coerceIn(0.0, 5_000_000.0)
            val dropped = savedBaselinePriceUsd > 0.0 && clamped > 0.0 && clamped < savedBaselinePriceUsd
            val updates = mutableMapOf<String, Any?>(
                "lastCheckedPriceUsd" to clamped,
                "hasPriceDrop" to dropped,
                "imageUrl" to imageUrl?.take(1000),
                "updatedAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }

            db.collection("users").document(uid)
                .collection("saved_rvs").document(savedId)
                .update(updates)
                .await()
            Result.success(dropped)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
            Result.failure(e)
        }
    }

    suspend fun removeSavedRv(savedId: String): Result<Unit> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Please sign in."))
        val path = "users/$uid/saved_rvs/$savedId"
        return try {
            db.collection("users").document(uid)
                .collection("saved_rvs").document(savedId)
                .delete()
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, path)
            Result.failure(e)
        }
    }

    suspend fun saveSearchAlert(
        filter: RvSearchFilter,
        initialUnitIds: List<String>,
        customLabel: String? = null
    ): Result<Unit> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Please sign in to save search alerts."))
        val docRef = db.collection("users").document(uid).collection("saved_alerts").document()
        val path = docRef.path
        return try {
            val label = (customLabel?.takeIf { it.isNotBlank() } ?: filter.toSummaryLabel()).take(180)
            val payload = mutableMapOf<String, Any?>(
                "userId" to uid,
                "label" to label,
                "alertsEnabled" to true,
                "matchCount" to initialUnitIds.size.coerceIn(0, 1_000_000),
                "newMatchCount" to 0,
                "rvTypes" to filter.rvTypes.map { it.wireValue }.take(8).takeIf { it.isNotEmpty() },
                "priceMinUsd" to filter.priceMinUsd?.coerceIn(0.0, 5_000_000.0),
                "priceMaxUsd" to filter.priceMaxUsd?.coerceIn(0.0, 5_000_000.0),
                "location" to filter.location.trim().take(80).takeIf { it.isNotBlank() },
                "radiusMiles" to filter.radiusMiles?.coerceIn(1.0, 3000.0),
                "sleepsMin" to filter.sleepsMin?.coerceIn(1, 14),
                "lengthMaxFt" to filter.lengthMaxFt?.coerceIn(8.0, 60.0),
                "condition" to filter.condition.takeIf { it != RvConditionOption.ANY }?.wireValue,
                "towVehicle" to filter.towVehicle.trim().take(120).takeIf { it.isNotBlank() },
                "truckTowRatingLbs" to filter.truckTowRatingLbs?.coerceIn(1000.0, 40000.0),
                "sort" to filter.sort.wireValue,
                "lastCheckedUnitIds" to initialUnitIds.take(10),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }

            docRef.set(payload).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    suspend fun toggleSearchAlert(alertId: String, enabled: Boolean): Result<Unit> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Please sign in."))
        val path = "users/$uid/saved_alerts/$alertId"
        return try {
            db.collection("users").document(uid)
                .collection("saved_alerts").document(alertId)
                .update(
                    mapOf(
                        "alertsEnabled" to enabled,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
            Result.failure(e)
        }
    }

    suspend fun updateAlertCheckResult(
        alertId: String,
        matchCount: Int,
        newMatchCount: Int,
        latestUnitIds: List<String>
    ): Result<Unit> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Please sign in."))
        val path = "users/$uid/saved_alerts/$alertId"
        return try {
            db.collection("users").document(uid)
                .collection("saved_alerts").document(alertId)
                .update(
                    mapOf(
                        "matchCount" to matchCount.coerceIn(0, 1_000_000),
                        "newMatchCount" to newMatchCount.coerceIn(0, 1000),
                        "lastCheckedUnitIds" to latestUnitIds.take(10),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
            Result.failure(e)
        }
    }

    suspend fun deleteSearchAlert(alertId: String): Result<Unit> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Please sign in."))
        val path = "users/$uid/saved_alerts/$alertId"
        return try {
            db.collection("users").document(uid)
                .collection("saved_alerts").document(alertId)
                .delete()
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, path)
            Result.failure(e)
        }
    }

    suspend fun recordDealerInquiry(
        mcpInquiryId: String,
        statusToken: String,
        unitId: String,
        rvTitle: String,
        dealerName: String,
        dealerLocation: String?,
        status: String,
        message: String,
        dryRun: Boolean,
        priceUsd: Double?,
        imageUrl: String?
    ): Result<Unit> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Please sign in."))
        val docId = sanitizeFirestoreDocId(mcpInquiryId)
        val path = "users/$uid/inquiries/$docId"
        return try {
            val safeStatus = if (status in listOf("delivered", "queued_for_matchrv", "failed", "dry_run", "replied")) {
                status
            } else {
                "queued_for_matchrv"
            }
            val payload = mutableMapOf<String, Any?>(
                "userId" to uid,
                "mcpInquiryId" to mcpInquiryId.take(128),
                "statusToken" to statusToken.take(256),
                "unitId" to unitId.take(160),
                "rvTitle" to rvTitle.ifBlank { "RV Unit" }.take(240),
                "dealerName" to dealerName.ifBlank { "Dealership" }.take(180),
                "dealerLocation" to dealerLocation?.take(120)?.takeIf { it.isNotBlank() },
                "status" to safeStatus,
                "message" to message.ifBlank { "Dealer inquiry" }.take(2000),
                "dryRun" to dryRun,
                "priceUsd" to priceUsd?.coerceIn(0.0, 5_000_000.0),
                "imageUrl" to imageUrl?.take(1000),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }

            db.collection("users").document(uid)
                .collection("inquiries").document(docId)
                .set(payload)
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    suspend fun updateInquiryStatus(
        inquiryDocId: String,
        status: String,
        dealerReply: String?
    ): Result<Unit> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Please sign in."))
        val path = "users/$uid/inquiries/$inquiryDocId"
        return try {
            val safeStatus = if (status in listOf("delivered", "queued_for_matchrv", "failed", "dry_run", "replied")) {
                status
            } else {
                "queued_for_matchrv"
            }
            val updates = mutableMapOf<String, Any?>(
                "status" to safeStatus,
                "dealerReply" to dealerReply?.take(2000)?.takeIf { it.isNotBlank() },
                "updatedAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }

            db.collection("users").document(uid)
                .collection("inquiries").document(inquiryDocId)
                .update(updates)
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, path)
            Result.failure(e)
        }
    }

    suspend fun trackAnalyticsEvent(
        eventType: String,
        unitId: String? = null,
        queryText: String? = null,
        rvType: String? = null,
        priceUsd: Double? = null,
        metadata: String? = null
    ): Result<Unit> {
        val uid = auth.currentUser?.uid ?: return Result.success(Unit)
        if (eventType !in listOf("swipe_right", "swipe_left", "save", "inquiry_sent", "agent_search")) {
            return Result.failure(IllegalArgumentException("Invalid analytics event type: $eventType"))
        }
        val docRef = db.collection("users").document(uid).collection("analytics_events").document()
        val path = docRef.path
        return try {
            val payload = mutableMapOf<String, Any?>(
                "userId" to uid,
                "eventType" to eventType,
                "unitId" to unitId?.take(160),
                "queryText" to queryText?.take(300),
                "rvType" to rvType?.take(60),
                "priceUsd" to priceUsd?.coerceIn(0.0, 5_000_000.0),
                "metadata" to metadata?.take(240),
                "createdAt" to FieldValue.serverTimestamp()
            ).filterValues { it != null }

            docRef.set(payload).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, path)
            Result.failure(e)
        }
    }

    private fun logStreamError(error: Throwable, path: String, uid: String) {
        val firestoreError = generateSequence(error) { it.cause }
            .filterIsInstance<FirebaseFirestoreException>()
            .firstOrNull()
        if (firestoreError == null && error is CancellationException) throw error
        val exceptionToLog = firestoreError ?: (error as? Exception)
        if (exceptionToLog != null && auth.currentUser?.uid == uid) {
            handleFirestoreError(exceptionToLog, OperationType.LIST, path)
        }
    }
}
