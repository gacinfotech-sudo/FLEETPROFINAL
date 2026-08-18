package com.fleetpro.business.ai

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.fleetpro.business.data.api.ApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ExtractedBookingData(
    val customerPhone: String? = null,
    val customerName: String? = null,
    val pickupLocation: String? = null,
    val dropoffLocation: String? = null,
    val pickupTime: String? = null,
    val vehicleType: String = "SUV",
    val estimatedFare: Double = 0.0,
    val notes: String? = null,
    val confidence: Int = 0,
)

data class BookingCopilotState(
    val isListening: Boolean = false,
    val inputText: String = "",
    val extractedData: ExtractedBookingData? = null,
    val isExtracting: Boolean = false,
    val extractionError: String? = null,
    val draftBookingId: String? = null,
    val bookingConfirmed: Boolean = false,
    val bookingId: String? = null,
    val needsReview: Boolean = false,
    val confidence: Int = 0,
)

@HiltViewModel
class BookingCopilotViewModel @Inject constructor(
    private val apiService: ApiService,
) : ViewModel() {

    private val _state = MutableStateFlow(BookingCopilotState())
    val state: StateFlow<BookingCopilotState> = _state

    fun updateInputText(text: String) {
        _state.value = _state.value.copy(inputText = text)
    }

    fun extractBookingDetails() {
        if (_state.value.inputText.isBlank()) {
            _state.value = _state.value.copy(
                extractionError = "Please enter booking details or speak to the microphone"
            )
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isExtracting = true, extractionError = null)

            try {
                val response = apiService.aiBookingExtract(
                    mapOf("text" to _state.value.inputText)
                )

                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val data = body["data"] as? Map<String, Any> ?: return@launch

                    val extractedData = ExtractedBookingData(
                        customerPhone = data["extractedData"]?.let { (it as Map<*, *>)["customerPhone"] as? String },
                        customerName = data["extractedData"]?.let { (it as Map<*, *>)["customerName"] as? String },
                        pickupLocation = data["extractedData"]?.let { (it as Map<*, *>)["pickupLocation"] as? String },
                        dropoffLocation = data["extractedData"]?.let { (it as Map<*, *>)["dropoffLocation"] as? String },
                        vehicleType = data["extractedData"]?.let { (it as Map<*, *>)["vehicleType"] as? String } ?: "SUV",
                        confidence = data["confidence"] as? Int ?: 0,
                    )

                    _state.value = _state.value.copy(
                        isExtracting = false,
                        extractedData = extractedData,
                        draftBookingId = data["draftBookingId"] as? String,
                        confidence = extractedData.confidence,
                        needsReview = data["needsReview"] as? Boolean ?: false,
                    )
                } else {
                    _state.value = _state.value.copy(
                        isExtracting = false,
                        extractionError = "Failed to extract booking details"
                    )
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isExtracting = false,
                    extractionError = e.message ?: "Network error"
                )
            }
        }
    }

    fun confirmBooking(overrides: Map<String, Any> = emptyMap()) {
        val extracted = _state.value.extractedData ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(isExtracting = true)

            try {
                val response = apiService.aiBookingConfirm(
                    mapOf(
                        "draftBookingId" to _state.value.draftBookingId,
                        "extractedData" to extracted,
                        "overrides" to overrides
                    )
                )

                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val data = body["data"] as? Map<String, Any> ?: return@launch

                    _state.value = _state.value.copy(
                        isExtracting = false,
                        bookingConfirmed = true,
                        bookingId = data["bookingId"] as? String,
                        inputText = "", // Clear input
                    )
                } else {
                    _state.value = _state.value.copy(
                        isExtracting = false,
                        extractionError = "Failed to confirm booking"
                    )
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isExtracting = false,
                    extractionError = e.message ?: "Network error"
                )
            }
        }
    }

    fun rejectBooking(reason: String = "") {
        viewModelScope.launch {
            try {
                apiService.aiBookingReject(
                    mapOf(
                        "draftBookingId" to _state.value.draftBookingId,
                        "reason" to reason
                    )
                )
                resetForm()
            } catch (e: Exception) {
                _state.value = _state.value.copy(extractionError = e.message)
            }
        }
    }

    fun resetForm() {
        _state.value = BookingCopilotState()
    }

    fun toggleListening() {
        _state.value = _state.value.copy(isListening = !_state.value.isListening)
        // Integrate with Android speech recognition
        // This is a placeholder - implement with SpeechRecognizer API
    }
}

@Composable
fun BookingCopilotScreen(
    viewModel: BookingCopilotViewModel = androidx.hilt.navigation.compose.hiltViewModel(),
    onBookingSuccess: (String) -> Unit = {},
) {
    val state by viewModel.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .background(MaterialTheme.colors.background)
            .padding(16.dp)
    ) {
        // Header
        Text(
            text = "AI Booking Copilot",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colors.primary,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        Text(
            text = "Speak or type booking details for instant extraction",
            fontSize = 14.sp,
            color = MaterialTheme.colors.onBackground.copy(alpha = 0.7f),
            modifier = Modifier.padding(bottom = 20.dp)
        )

        // Success dialog
        if (state.bookingConfirmed && state.bookingId != null) {
            AlertDialog(
                onDismissRequest = {
                    viewModel.resetForm()
                    onBookingSuccess(state.bookingId ?: "")
                },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Filled.CheckCircle,
                            contentDescription = "Success",
                            tint = Color(0xFF4CAF50),
                            modifier = Modifier.size(28.dp).padding(end = 8.dp)
                        )
                        Text("Booking Created!", fontWeight = FontWeight.Bold)
                    }
                },
                text = {
                    Text("Booking ID: ${state.bookingId}", fontSize = 12.sp)
                },
                confirmButton = {
                    Button(onClick = {
                        viewModel.resetForm()
                        onBookingSuccess(state.bookingId ?: "")
                    }) {
                        Text("Done")
                    }
                }
            )
        }

        // Input section
        if (state.extractedData == null) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                elevation = 2.dp
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    // Microphone button
                    Button(
                        onClick = { viewModel.toggleListening() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        colors = ButtonDefaults.buttonColors(
                            backgroundColor = if (state.isListening) Color(0xFFFF5252) else MaterialTheme.colors.primary
                        )
                    ) {
                        Icon(
                            if (state.isListening) Icons.Filled.Mic else Icons.Filled.Mic,
                            contentDescription = "Microphone",
                            modifier = Modifier
                                .size(20.dp)
                                .padding(end = 8.dp)
                        )
                        Text(
                            if (state.isListening) "Listening..." else "Speak Booking Details",
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Divider(modifier = Modifier.padding(vertical = 12.dp))

                    // Text input
                    OutlinedTextField(
                        value = state.inputText,
                        onValueChange = { viewModel.updateInputText(it) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(100.dp),
                        placeholder = { Text("Or type booking details here...") },
                        maxLines = 5
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Extract button
                    Button(
                        onClick = { viewModel.extractBookingDetails() },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.isExtracting && state.inputText.isNotBlank()
                    ) {
                        if (state.isExtracting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White
                            )
                        } else {
                            Text("Extract Booking Details")
                        }
                    }
                }
            }

            // Error message
            if (state.extractionError != null) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    backgroundColor = Color(0xFFFFEBEE)
                ) {
                    Text(
                        text = state.extractionError ?: "",
                        color = Color(0xFFD32F2F),
                        fontSize = 12.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        }

        // Extraction review section
        if (state.extractedData != null) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                elevation = 2.dp
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    // Confidence badge
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Extraction Review", fontWeight = FontWeight.Bold, fontSize = 14.sp)

                        val confidenceColor = when {
                            state.confidence >= 80 -> Color(0xFF4CAF50)
                            state.confidence >= 60 -> Color(0xFFFFC107)
                            else -> Color(0xFFFF9800)
                        }

                        Chip(
                            onClick = {},
                            modifier = Modifier.padding(start = 8.dp),
                            colors = ChipDefaults.chipColors(backgroundColor = confidenceColor)
                        ) {
                            Text("${state.confidence}% Confidence", fontSize = 11.sp)
                        }
                    }

                    // Review fields
                    ReviewField("Customer Phone", state.extractedData!!.customerPhone ?: "Not extracted")
                    ReviewField("Customer Name", state.extractedData!!.customerName ?: "Not extracted")
                    ReviewField("Pickup", state.extractedData!!.pickupLocation ?: "Not extracted")
                    ReviewField("Dropoff", state.extractedData!!.dropoffLocation ?: "Not extracted")
                    ReviewField("Vehicle", state.extractedData!!.vehicleType)
                    ReviewField("Est. Fare", "₹${state.extractedData!!.estimatedFare}")

                    if (state.needsReview) {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 12.dp),
                            backgroundColor = Color(0xFFFFF3CD)
                        ) {
                            Text(
                                "⚠️ Review fields below before confirming",
                                fontSize = 11.sp,
                                modifier = Modifier.padding(8.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Action buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { viewModel.confirmBooking() },
                            modifier = Modifier
                                .weight(1f)
                                .height(40.dp),
                            enabled = !state.isExtracting
                        ) {
                            Text("Confirm & Create", fontSize = 12.sp)
                        }

                        OutlinedButton(
                            onClick = { viewModel.rejectBooking() },
                            modifier = Modifier
                                .weight(1f)
                                .height(40.dp)
                        ) {
                            Text("Reject", fontSize = 12.sp)
                        }
                    }

                    OutlinedButton(
                        onClick = { viewModel.resetForm() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(36.dp)
                            .padding(top = 8.dp)
                    ) {
                        Text("Start Over", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun ReviewField(label: String, value: String) {
    Column(modifier = Modifier.padding(bottom = 8.dp)) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(
            value,
            fontSize = 13.sp,
            color = MaterialTheme.colors.onBackground,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}
