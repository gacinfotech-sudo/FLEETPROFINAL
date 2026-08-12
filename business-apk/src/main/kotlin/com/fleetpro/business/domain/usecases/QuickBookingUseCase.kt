package com.fleetpro.business.domain.usecases

import com.fleetpro.business.data.api.ApiService
import com.fleetpro.business.data.local.BookingCache
import com.fleetpro.business.services.PhoneNormalizer
import javax.inject.Inject

data class BookingResult(
    val success: Boolean,
    val bookingId: String = "",
    val error: String? = null,
    val blacklistWarning: String? = null,
    val timingMs: Long = 0,
)

data class CustomerInfo(
    val customerId: String,
    val customerName: String,
    val lastVehicleType: String? = null,
    val lastPickupLocation: String? = null,
    val lastDropoffLocation: String? = null,
)

class QuickBookingUseCase @Inject constructor(
    private val apiService: ApiService,
    private val phoneNormalizer: PhoneNormalizer,
    private val bookingCache: BookingCache,
) {

    suspend fun lookupCustomer(phone: String): Map<String, Any>? {
        return try {
            val startTime = System.currentTimeMillis()
            val normalized = phoneNormalizer.normalize(phone)

            // Check local cache first (instant)
            val cached = bookingCache.getCustomerInfo(normalized)
            if (cached != null) {
                return cached
            }

            // Network lookup
            val response = apiService.getQuickCustomerLookup(phone)

            if (response.isSuccessful) {
                val body = response.body() ?: return null
                val data = body["data"] as? Map<String, Any> ?: return null

                // Cache the result
                bookingCache.cacheCustomerInfo(normalized, data)

                val timingMs = System.currentTimeMillis() - startTime
                if (timingMs > 500) {
                    println("Customer lookup took ${timingMs}ms")
                }

                return data
            }
            null
        } catch (e: Exception) {
            println("Customer lookup failed: ${e.message}")
            null
        }
    }

    suspend fun createBooking(
        phone: String,
        customerName: String,
        pickupLocation: String,
        dropoffLocation: String,
        vehicleType: String,
        estimatedFare: Double,
        notes: String,
    ): BookingResult {
        return try {
            val startTime = System.currentTimeMillis()
            val normalized = phoneNormalizer.normalize(phone)

            if (!phoneNormalizer.isValid(normalized)) {
                return BookingResult(
                    success = false,
                    error = "Invalid phone number format",
                )
            }

            // Prepare request body
            val requestBody = mapOf(
                "customerPhone" to normalized,
                "customerName" to customerName,
                "pickupLocation" to pickupLocation,
                "dropoffLocation" to dropoffLocation,
                "vehicleType" to vehicleType,
                "estimatedFare" to estimatedFare,
                "notes" to notes,
            )

            // API call
            val response = apiService.createQuickBooking(requestBody)

            if (response.isSuccessful) {
                val body = response.body() ?: return BookingResult(
                    success = false,
                    error = "Empty response",
                )

                val data = body["data"] as? Map<String, Any>
                val bookingId = data?.get("bookingId") as? String ?: ""
                val blacklistWarning = data?.get("blacklistWarning") as? String

                val timingMs = System.currentTimeMillis() - startTime
                println("Booking created in ${timingMs}ms: $bookingId")

                // Cache the new booking locally
                bookingCache.cacheBooking(
                    bookingId,
                    mapOf(
                        "phone" to normalized,
                        "pickup" to pickupLocation,
                        "dropoff" to dropoffLocation,
                        "vehicle" to vehicleType,
                        "fare" to estimatedFare,
                        "timestamp" to System.currentTimeMillis(),
                    ),
                )

                return BookingResult(
                    success = true,
                    bookingId = bookingId,
                    blacklistWarning = blacklistWarning,
                    timingMs = timingMs,
                )
            } else {
                val errorBody = response.errorBody()?.string() ?: "Unknown error"
                return BookingResult(
                    success = false,
                    error = errorBody,
                )
            }
        } catch (e: Exception) {
            return BookingResult(
                success = false,
                error = e.message ?: "Network error",
                timingMs = System.currentTimeMillis() - System.currentTimeMillis(),
            )
        }
    }

    fun getLastBookingDefaults(): Map<String, String>? {
        return bookingCache.getLastBookingDefaults()
    }
}
