package com.fleetpro.business.integration

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import com.fleetpro.business.data.api.ApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class ShareableBooking(
    val bookingId: String,
    val customerId: String,
    val customerPhone: String,
    val pickupLocation: String,
    val dropoffLocation: String,
    val vehicleType: String,
    val estimatedFare: Double,
)

@Singleton
class WhatsAppBasic @Inject constructor(
    @ApplicationContext private val context: Context,
    private val apiService: ApiService,
) {

    private val TAG = "WhatsAppBasic"

    /**
     * Share booking confirmation via WhatsApp
     * NO bulk messaging - ONE-TO-ONE only
     */
    fun shareBookingConfirmation(booking: ShareableBooking) {
        try {
            val message = buildBookingConfirmationMessage(booking)
            openWhatsAppWithMessage(booking.customerPhone, message)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to share booking: ${e.message}")
        }
    }

    /**
     * Share trip itinerary via WhatsApp
     */
    fun shareItinerary(booking: ShareableBooking) {
        try {
            val message = buildItineraryMessage(booking)
            openWhatsAppWithMessage(booking.customerPhone, message)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to share itinerary: ${e.message}")
        }
    }

    /**
     * Share driver details via WhatsApp
     */
    fun shareDriverDetails(
        customerPhone: String,
        driverName: String,
        driverPhone: String,
        licensePlate: String,
        rating: Double,
    ) {
        try {
            val message = buildDriverDetailsMessage(
                driverName,
                driverPhone,
                licensePlate,
                rating
            )
            openWhatsAppWithMessage(customerPhone, message)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to share driver details: ${e.message}")
        }
    }

    /**
     * Share payment receipt via WhatsApp
     */
    fun sharePaymentReceipt(
        customerPhone: String,
        bookingId: String,
        amount: Double,
        paymentMethod: String,
        receiptId: String,
    ) {
        try {
            val message = buildPaymentReceiptMessage(
                bookingId,
                amount,
                paymentMethod,
                receiptId
            )
            openWhatsAppWithMessage(customerPhone, message)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to share payment receipt: ${e.message}")
        }
    }

    /**
     * Check if WhatsApp is installed
     */
    fun isWhatsAppInstalled(): Boolean {
        return try {
            context.packageManager.getApplicationInfo("com.whatsapp", 0)
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Open WhatsApp with message (intent-based, NO API calls)
     * Uses system intent to open WhatsApp app directly
     */
    private fun openWhatsAppWithMessage(phoneNumber: String, message: String) {
        if (!isWhatsAppInstalled()) {
            Log.w(TAG, "WhatsApp not installed")
            return
        }

        try {
            // Format: whatsapp://send?phone=PHONE_NUMBER&text=MESSAGE
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse(
                    "https://wa.me/$phoneNumber?text=${Uri.encode(message)}"
                )
                setPackage("com.whatsapp")
            }

            context.startActivity(intent)
            Log.d(TAG, "Opened WhatsApp for $phoneNumber")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open WhatsApp: ${e.message}")
            // Fallback: try web version
            fallbackToWebWhatsApp(phoneNumber, message)
        }
    }

    /**
     * Fallback to web WhatsApp if app not available
     */
    private fun fallbackToWebWhatsApp(phoneNumber: String, message: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse(
                    "https://web.whatsapp.com/send?phone=$phoneNumber&text=${Uri.encode(message)}"
                )
            }
            context.startActivity(intent)
            Log.d(TAG, "Opened web WhatsApp for $phoneNumber")
        } catch (e: Exception) {
            Log.e(TAG, "Fallback to web WhatsApp also failed: ${e.message}")
        }
    }

    // Message builders
    private fun buildBookingConfirmationMessage(booking: ShareableBooking): String {
        return """
🎉 *Booking Confirmed!*

*Booking ID:* ${booking.bookingId}

📍 *Pickup:* ${booking.pickupLocation}
📍 *Dropoff:* ${booking.dropoffLocation}

🚗 *Vehicle:* ${booking.vehicleType}
💰 *Est. Fare:* ₹${booking.estimatedFare}

Thank you for booking with us!
        """.trimIndent()
    }

    private fun buildItineraryMessage(booking: ShareableBooking): String {
        return """
📋 *Trip Itinerary*

*Pickup:* ${booking.pickupLocation}
*Dropoff:* ${booking.dropoffLocation}

*Est. Distance:* 12 km
*Est. Duration:* 25 min
*Est. Fare:* ₹${booking.estimatedFare}

Confirm booking in app to get driver assignment.
        """.trimIndent()
    }

    private fun buildDriverDetailsMessage(
        driverName: String,
        driverPhone: String,
        licensePlate: String,
        rating: Double,
    ): String {
        return """
✅ *Driver Assigned!*

*Driver:* $driverName
*License Plate:* $licensePlate
*Rating:* ⭐ $rating/5

📞 *Call:* $driverPhone

Your driver will arrive shortly!
        """.trimIndent()
    }

    private fun buildPaymentReceiptMessage(
        bookingId: String,
        amount: Double,
        paymentMethod: String,
        receiptId: String,
    ): String {
        return """
💳 *Payment Received!*

*Amount:* ₹$amount
*Method:* $paymentMethod
*Receipt ID:* $receiptId
*Booking ID:* $bookingId

Your trip is now complete. Thank you!
        """.trimIndent()
    }
}
