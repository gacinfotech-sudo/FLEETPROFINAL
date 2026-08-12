package com.fleetpro.business.ui.vm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import com.fleetpro.business.domain.usecases.QuickBookingUseCase
import com.fleetpro.business.services.PhoneNormalizer
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

data class QuickBookingState(
    val isLoading: Boolean = false,
    val customerPhone: String = "",
    val customerName: String = "",
    val customerId: String = "",
    val pickupLocation: String = "",
    val dropoffLocation: String = "",
    val vehicleType: String = "SUV",
    val estimatedFare: Double = 0.0,
    val bookingNotes: String = "",
    val hasExistingCustomer: Boolean = false,
    val bookingId: String = "",
    val bookingSuccess: Boolean = false,
    val errorMessage: String = "",
    val fieldErrors: Map<String, String> = emptyMap(),
    val blacklistWarning: String = "",
    val lastBookings: List<Map<String, Any>> = emptyList(),
    val lastVehicleType: String? = null,
    val lastPickupLocation: String? = null,
    val lastDropoffLocation: String? = null,
    val phoneNormalizationError: Boolean = false,
)

@HiltViewModel
class QuickBookingViewModel @Inject constructor(
    private val quickBookingUseCase: QuickBookingUseCase,
    private val phoneNormalizer: PhoneNormalizer,
) : ViewModel() {

    private val _state = MutableStateFlow(QuickBookingState())
    val state: StateFlow<QuickBookingState> = _state

    private val _phoneValidation = MutableStateFlow<Boolean?>(null)
    val phoneValidation: StateFlow<Boolean?> = _phoneValidation

    fun onPhoneChanged(phone: String) {
        _state.value = _state.value.copy(customerPhone = phone)

        // Real-time phone normalization validation
        if (phone.isNotEmpty()) {
            viewModelScope.launch {
                try {
                    val normalized = phoneNormalizer.normalize(phone)
                    val isValid = phoneNormalizer.isValid(normalized)
                    _phoneValidation.value = isValid
                    _state.value = _state.value.copy(phoneNormalizationError = !isValid)

                    if (isValid) {
                        // Auto-lookup existing customer when phone is valid
                        lookupCustomer(phone)
                    }
                } catch (e: Exception) {
                    _phoneValidation.value = false
                    _state.value = _state.value.copy(phoneNormalizationError = true)
                }
            }
        }
    }

    fun onCustomerNameChanged(name: String) {
        _state.value = _state.value.copy(customerName = name)
    }

    fun onPickupLocationChanged(location: String) {
        _state.value = _state.value.copy(pickupLocation = location)
    }

    fun onDropoffLocationChanged(location: String) {
        _state.value = _state.value.copy(dropoffLocation = location)
    }

    fun onVehicleTypeChanged(type: String) {
        _state.value = _state.value.copy(vehicleType = type)
    }

    fun onEstimatedFareChanged(fare: String) {
        val fareAmount = fare.toDoubleOrNull() ?: 0.0
        _state.value = _state.value.copy(estimatedFare = fareAmount)
    }

    fun onNotesChanged(notes: String) {
        _state.value = _state.value.copy(bookingNotes = notes)
    }

    private fun lookupCustomer(phone: String) {
        viewModelScope.launch {
            try {
                val customerInfo = quickBookingUseCase.lookupCustomer(phone)
                if (customerInfo != null) {
                    // Existing customer found - auto-populate defaults
                    _state.value = _state.value.copy(
                        hasExistingCustomer = true,
                        customerId = customerInfo["customerId"] as? String ?: "",
                        customerName = customerInfo["customerName"] as? String ?: "",
                        lastVehicleType = customerInfo["lastVehicleType"] as? String,
                        lastPickupLocation = customerInfo["lastPickupLocation"] as? String,
                        lastDropoffLocation = customerInfo["lastDropoffLocation"] as? String,
                        vehicleType = (customerInfo["lastVehicleType"] as? String) ?: "SUV",
                        pickupLocation = customerInfo["lastPickupLocation"] as? String ?: "",
                        dropoffLocation = customerInfo["lastDropoffLocation"] as? String ?: "",
                    )
                } else {
                    // New customer
                    _state.value = _state.value.copy(
                        hasExistingCustomer = false,
                        customerId = "",
                    )
                }
            } catch (e: Exception) {
                // Silent fail - not critical for booking
                _state.value = _state.value.copy(hasExistingCustomer = false)
            }
        }
    }

    fun validateFields(): Boolean {
        val errors = mutableMapOf<String, String>()

        val currentState = _state.value

        // Phone validation
        if (currentState.customerPhone.isEmpty()) {
            errors["customerPhone"] = "Phone number required"
        } else if (!_phoneValidation.value!!) {
            errors["customerPhone"] = "Invalid phone number"
        }

        // Name validation (if new customer)
        if (!currentState.hasExistingCustomer && currentState.customerName.isEmpty()) {
            errors["customerName"] = "Customer name required"
        }

        // Pickup location validation
        if (currentState.pickupLocation.isEmpty()) {
            errors["pickupLocation"] = "Pickup location required"
        }

        // Dropoff location validation
        if (currentState.dropoffLocation.isEmpty()) {
            errors["dropoffLocation"] = "Dropoff location required"
        }

        // Location mismatch validation
        if (currentState.pickupLocation == currentState.dropoffLocation) {
            errors["dropoffLocation"] = "Dropoff must differ from pickup"
        }

        _state.value = _state.value.copy(fieldErrors = errors)
        return errors.isEmpty()
    }

    fun createBooking() {
        if (!validateFields()) {
            _state.value = _state.value.copy(
                errorMessage = "Please fix the highlighted fields"
            )
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, errorMessage = "")

            try {
                val result = quickBookingUseCase.createBooking(
                    phone = _state.value.customerPhone,
                    customerName = _state.value.customerName,
                    pickupLocation = _state.value.pickupLocation,
                    dropoffLocation = _state.value.dropoffLocation,
                    vehicleType = _state.value.vehicleType,
                    estimatedFare = _state.value.estimatedFare,
                    notes = _state.value.bookingNotes,
                )

                if (result.success) {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        bookingId = result.bookingId,
                        bookingSuccess = true,
                        blacklistWarning = result.blacklistWarning ?: "",
                        errorMessage = "",
                    )
                    // Clear form for next booking
                    resetForm()
                } else {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        errorMessage = result.error ?: "Booking creation failed",
                    )
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Network error - please retry",
                )
            }
        }
    }

    fun resetForm() {
        _state.value = QuickBookingState()
        _phoneValidation.value = null
    }

    fun dismissBlacklistWarning() {
        _state.value = _state.value.copy(blacklistWarning = "")
    }
}
