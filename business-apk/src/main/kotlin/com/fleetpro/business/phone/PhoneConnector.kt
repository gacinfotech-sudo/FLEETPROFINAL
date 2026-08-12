package com.fleetpro.business.phone

import android.content.Context
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import android.util.Log
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import com.fleetpro.business.services.PhoneNormalizer
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class CallInfo(
    val incomingNumber: String,
    val normalizedNumber: String,
    val customerName: String? = null,
    val customerId: String? = null,
    val lastBookingId: String? = null,
    val bookingCount: Int = 0,
    val callStartTime: Long = System.currentTimeMillis(),
    val isKnownCustomer: Boolean = false,
)

@Singleton
class PhoneConnector @Inject constructor(
    @ApplicationContext private val context: Context,
    private val phoneNormalizer: PhoneNormalizer,
) : PhoneStateListener() {

    private val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    private val _incomingCalls = MutableSharedFlow<CallInfo>(replay = 1)
    val incomingCalls: SharedFlow<CallInfo> = _incomingCalls

    private val customerLookupCallback = mutableMapOf<String, suspend (String) -> Map<String, Any>?>()
    private var lastIncomingNumber: String = ""

    fun initialize(customerLookup: suspend (String) -> Map<String, Any>?) {
        telephonyManager.listen(this, LISTEN_CALL_STATE)
        customerLookupCallback["lookup"] = customerLookup
        Log.d("PhoneConnector", "Phone listener initialized")
    }

    fun stop() {
        telephonyManager.listen(this, LISTEN_NONE)
        Log.d("PhoneConnector", "Phone listener stopped")
    }

    override fun onCallStateChanged(state: Int, incomingNumber: String?) {
        super.onCallStateChanged(state, incomingNumber)

        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                if (!incomingNumber.isNullOrEmpty()) {
                    lastIncomingNumber = incomingNumber
                    handleIncomingCall(incomingNumber)
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                lastIncomingNumber = ""
                Log.d("PhoneConnector", "Call ended")
            }
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                Log.d("PhoneConnector", "Call answered")
            }
        }
    }

    private fun handleIncomingCall(phoneNumber: String) {
        try {
            val normalizedNumber = phoneNormalizer.normalize(phoneNumber)

            if (!phoneNormalizer.isValid(normalizedNumber)) {
                Log.w("PhoneConnector", "Invalid phone: $phoneNumber")
                return
            }

            Log.d("PhoneConnector", "Incoming call from: $normalizedNumber")

            // Create initial call info (will be enriched with customer data)
            val callInfo = CallInfo(
                incomingNumber = phoneNumber,
                normalizedNumber = normalizedNumber,
                callStartTime = System.currentTimeMillis()
            )

            // Emit immediately for UI responsiveness
            _incomingCalls.tryEmit(callInfo)

            // Lookup customer async (non-blocking)
            lookupCustomerForCall(normalizedNumber)

        } catch (e: Exception) {
            Log.e("PhoneConnector", "Failed to handle incoming call: ${e.message}")
        }
    }

    private fun lookupCustomerForCall(normalizedNumber: String) {
        try {
            val lookup = customerLookupCallback["lookup"] ?: return

            // Placeholder for async lookup (implement with coroutines in production)
            Thread {
                try {
                    // Simulate lookup
                    Thread.sleep(100) // Lookup should be < 200ms

                    val callInfo = CallInfo(
                        incomingNumber = normalizedNumber,
                        normalizedNumber = normalizedNumber,
                        customerName = "John Doe", // Would come from lookup
                        customerId = "CUST001",
                        lastBookingId = "BK123456",
                        bookingCount = 15,
                        isKnownCustomer = true
                    )

                    _incomingCalls.tryEmit(callInfo)
                    Log.d("PhoneConnector", "Customer lookup completed: ${callInfo.customerName}")

                } catch (e: Exception) {
                    Log.e("PhoneConnector", "Customer lookup failed: ${e.message}")
                }
            }.start()

        } catch (e: Exception) {
            Log.e("PhoneConnector", "Failed to lookup customer: ${e.message}")
        }
    }

    // Get current incoming call info
    fun getCurrentCallInfo(): CallInfo? {
        return if (lastIncomingNumber.isNotEmpty()) {
            val normalized = phoneNormalizer.normalize(lastIncomingNumber)
            CallInfo(
                incomingNumber = lastIncomingNumber,
                normalizedNumber = normalized,
                callStartTime = System.currentTimeMillis()
            )
        } else {
            null
        }
    }

    // Format phone for display
    fun formatPhoneForDisplay(phoneNumber: String): String {
        return try {
            val normalized = phoneNormalizer.normalize(phoneNumber)
            // Format as +91 98765 43210
            if (normalized.startsWith("91") && normalized.length == 12) {
                "+${normalized.substring(0, 2)} ${normalized.substring(2, 7)} ${normalized.substring(7)}"
            } else {
                normalized
            }
        } catch (e: Exception) {
            phoneNumber
        }
    }
}
