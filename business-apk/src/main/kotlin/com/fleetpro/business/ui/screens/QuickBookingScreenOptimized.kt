package com.fleetpro.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Notes
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.fleetpro.business.ui.vm.QuickBookingViewModel
import com.fleetpro.business.ui.theme.FleetProBusinessTheme

@Composable
fun QuickBookingScreenOptimized(
    viewModel: QuickBookingViewModel = hiltViewModel(),
    onBookingSuccess: (String) -> Unit = {},
) {
    val state by viewModel.state.collectAsState()
    val phoneValidation by viewModel.phoneValidation.collectAsState()

    FleetProBusinessTheme {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .background(MaterialTheme.colors.background)
                .padding(16.dp)
        ) {
            // Header
            Text(
                text = "Quick Booking",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colors.primary,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            Text(
                text = "Create a booking in under 2 minutes",
                fontSize = 14.sp,
                color = MaterialTheme.colors.onBackground.copy(alpha = 0.7f),
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // Success Dialog
            if (state.bookingSuccess) {
                BookingSuccessDialog(
                    bookingId = state.bookingId,
                    estimatedFare = state.estimatedFare,
                    onDismiss = {
                        viewModel.resetForm()
                        onBookingSuccess(state.bookingId)
                    }
                )
            }

            // Blacklist Warning
            if (state.blacklistWarning.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    backgroundColor = Color(0xFFFFF3CD),
                    elevation = 2.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Filled.Error,
                            contentDescription = "Warning",
                            tint = Color(0xFFFF6B6B),
                            modifier = Modifier
                                .size(24.dp)
                                .padding(end = 8.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Manager Approval Required",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                            Text(
                                text = state.blacklistWarning,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                        IconButton(onClick = { viewModel.dismissBlacklistWarning() }) {
                            Text("✕", fontSize = 16.sp)
                        }
                    }
                }
            }

            // Error message
            if (state.errorMessage.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    backgroundColor = Color(0xFFFFEBEE),
                    elevation = 2.dp
                ) {
                    Text(
                        text = state.errorMessage,
                        color = Color(0xFFD32F2F),
                        fontSize = 12.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            // Phone Input (with real-time validation)
            QuickInputField(
                label = "Customer Phone",
                value = state.customerPhone,
                onValueChange = { viewModel.onPhoneChanged(it) },
                icon = Icons.Filled.Phone,
                error = state.fieldErrors["customerPhone"],
                isValid = phoneValidation ?: (state.customerPhone.isEmpty()),
                placeholder = "Enter 10-digit phone",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp)
            )

            // Show customer name only if new customer or editable
            if (!state.hasExistingCustomer || state.customerName.isEmpty()) {
                QuickInputField(
                    label = "Customer Name",
                    value = state.customerName,
                    onValueChange = { viewModel.onCustomerNameChanged(it) },
                    error = state.fieldErrors["customerName"],
                    isValid = state.customerName.isNotEmpty() || state.hasExistingCustomer,
                    placeholder = "Enter customer name",
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                )
            } else {
                // Display existing customer name (read-only)
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp),
                    backgroundColor = MaterialTheme.colors.surface.copy(alpha = 0.5f),
                    elevation = 0.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Filled.CheckCircle,
                            contentDescription = "Existing customer",
                            tint = Color(0xFF4CAF50),
                            modifier = Modifier
                                .size(20.dp)
                                .padding(end = 8.dp)
                        )
                        Column {
                            Text("Customer Name", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text(state.customerName, fontSize = 14.sp)
                        }
                    }
                }
            }

            // Pickup Location (with smart defaults from history)
            QuickInputField(
                label = "Pickup Location",
                value = state.pickupLocation,
                onValueChange = { viewModel.onPickupLocationChanged(it) },
                error = state.fieldErrors["pickupLocation"],
                isValid = state.pickupLocation.isNotEmpty(),
                placeholder = state.lastPickupLocation ?: "Enter pickup location",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                icon = Icons.Filled.LocationOn
            )

            // Dropoff Location
            QuickInputField(
                label = "Dropoff Location",
                value = state.dropoffLocation,
                onValueChange = { viewModel.onDropoffLocationChanged(it) },
                error = state.fieldErrors["dropoffLocation"],
                isValid = state.dropoffLocation.isNotEmpty() && state.dropoffLocation != state.pickupLocation,
                placeholder = state.lastDropoffLocation ?: "Enter dropoff location",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                icon = Icons.Filled.LocationOn
            )

            // Vehicle Type Dropdown
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Filled.DirectionsCar,
                    contentDescription = "Vehicle type",
                    tint = MaterialTheme.colors.primary,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Vehicle Type", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = state.vehicleType,
                        onValueChange = { viewModel.onVehicleTypeChanged(it) },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = LocalTextStyle.current.copy(fontSize = 14.sp),
                        singleLine = true
                    )
                }
            }

            // Estimated Fare
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("₹", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Estimated Fare (Optional)", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = if (state.estimatedFare > 0) state.estimatedFare.toString() else "",
                        onValueChange = { viewModel.onEstimatedFareChanged(it) },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = LocalTextStyle.current.copy(fontSize = 14.sp),
                        singleLine = true
                    )
                }
            }

            // Notes (optional)
            QuickInputField(
                label = "Booking Notes (Optional)",
                value = state.bookingNotes,
                onValueChange = { viewModel.onNotesChanged(it) },
                error = null,
                isValid = true,
                placeholder = "Add any special requests",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 20.dp),
                icon = Icons.Filled.Notes,
                singleLine = false,
                maxLines = 2
            )

            // Main CTA: Single Submit Button
            Button(
                onClick = { viewModel.createBooking() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                enabled = !state.isLoading && state.customerPhone.isNotEmpty() && state.pickupLocation.isNotEmpty() && state.dropoffLocation.isNotEmpty(),
                colors = ButtonDefaults.buttonColors(
                    backgroundColor = MaterialTheme.colors.primary,
                    disabledBackgroundColor = MaterialTheme.colors.primary.copy(alpha = 0.5f)
                )
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White
                    )
                } else {
                    Text(
                        text = "Create Booking",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }

            // Clear Button
            OutlinedButton(
                onClick = { viewModel.resetForm() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(40.dp)
                    .padding(top = 8.dp),
                enabled = !state.isLoading
            ) {
                Text("Clear Form", fontSize = 14.sp)
            }
        }
    }
}

@Composable
fun QuickInputField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    error: String? = null,
    isValid: Boolean = true,
    placeholder: String = "",
    icon: androidx.compose.material.Icon? = null,
    singleLine: Boolean = true,
    maxLines: Int = 1,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (icon != null) {
                Icon(
                    icon,
                    contentDescription = label,
                    tint = MaterialTheme.colors.primary,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            if (!isValid && error != null) {
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    Icons.Filled.Error,
                    contentDescription = "Error",
                    tint = Color(0xFFD32F2F),
                    modifier = Modifier.size(16.dp)
                )
            }
        }

        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (!isValid && error != null) {
                        Modifier.background(Color(0xFFFFEBEE), shape = RoundedCornerShape(4.dp))
                    } else {
                        Modifier
                    }
                ),
            textStyle = LocalTextStyle.current.copy(fontSize = 14.sp),
            singleLine = singleLine,
            maxLines = maxLines,
            placeholder = { Text(placeholder, fontSize = 12.sp) },
            isError = !isValid && error != null,
        )

        if (!isValid && error != null) {
            Text(
                text = error,
                color = Color(0xFFD32F2F),
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 4.dp, start = 8.dp)
            )
        }
    }
}

@Composable
fun BookingSuccessDialog(
    bookingId: String,
    estimatedFare: Double,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Filled.CheckCircle,
                    contentDescription = "Success",
                    tint = Color(0xFF4CAF50),
                    modifier = Modifier
                        .size(28.dp)
                        .padding(end = 8.dp)
                )
                Text("Booking Confirmed!", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column {
                Text("Booking ID: $bookingId", fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
                if (estimatedFare > 0) {
                    Text("Estimated Fare: ₹$estimatedFare", fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss) {
                Text("Done")
            }
        },
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)
    )
}
