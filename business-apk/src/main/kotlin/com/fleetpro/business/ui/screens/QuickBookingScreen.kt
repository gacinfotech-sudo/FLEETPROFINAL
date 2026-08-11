package com.fleetpro.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun QuickBookingScreen(
    onBookingCreated: () -> Unit,
    onNavigateBack: () -> Unit
) {
    var phone by remember { mutableStateOf("") }
    var customerName by remember { mutableStateOf("") }
    var pickupLocation by remember { mutableStateOf("") }
    var dropLocation by remember { mutableStateOf("") }
    var fare by remember { mutableStateOf("") }
    var advance by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var customerFound by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.background)
    ) {
        // Header
        TopAppBar(
            title = { Text("Quick Booking") },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Text("←")
                }
            }
        )

        // Form
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Step 1: Phone lookup
            Text(
                text = "Step 1: Customer Phone",
                style = MaterialTheme.typography.subtitle1,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            TextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text("Phone Number") },
                placeholder = { Text("98765 43210") },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                enabled = !isLoading,
                singleLine = true
            )

            if (phone.length == 10 && !customerFound) {
                Button(
                    onClick = {
                        isLoading = true
                        // TODO: Call PhoneNormalizer + customer lookup
                        Thread {
                            Thread.sleep(500)  // Simulate API call
                            customerName = "Rajesh Sharma"  // Mock data
                            customerFound = true
                            isLoading = false
                        }.start()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                ) {
                    Text("LOOKUP CUSTOMER")
                }
            }

            if (customerFound) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    backgroundColor = MaterialTheme.colors.surface
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp)
                    ) {
                        Text("✅ Customer Found", style = MaterialTheme.typography.subtitle2)
                        Text(customerName, style = MaterialTheme.typography.body1)
                    }
                }
            }

            if (customerFound) {
                // Step 2: Booking details
                Text(
                    text = "Step 2: Trip Details",
                    style = MaterialTheme.typography.subtitle1,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                TextField(
                    value = pickupLocation,
                    onValueChange = { pickupLocation = it },
                    label = { Text("Pickup Location") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    singleLine = true
                )

                TextField(
                    value = dropLocation,
                    onValueChange = { dropLocation = it },
                    label = { Text("Drop Location") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    singleLine = true
                )

                // Step 3: Pricing
                Text(
                    text = "Step 3: Pricing",
                    style = MaterialTheme.typography.subtitle1,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                TextField(
                    value = fare,
                    onValueChange = { fare = it },
                    label = { Text("Fare (₹)") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    singleLine = true
                )

                TextField(
                    value = advance,
                    onValueChange = { advance = it },
                    label = { Text("Advance (₹)") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp),
                    singleLine = true
                )

                // Error
                if (errorMessage.isNotEmpty()) {
                    Text(
                        text = errorMessage,
                        color = MaterialTheme.colors.error,
                        style = MaterialTheme.typography.body2,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )
                }

                // Create button
                Button(
                    onClick = {
                        if (pickupLocation.isEmpty() || fare.isEmpty()) {
                            errorMessage = "Please fill all required fields"
                            return@Button
                        }
                        isLoading = true
                        // TODO: Call BookingService.create()
                        Thread {
                            Thread.sleep(1000)
                            onBookingCreated()
                        }.start()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    enabled = !isLoading,
                    colors = ButtonDefaults.buttonColors(
                        backgroundColor = MaterialTheme.colors.secondary
                    )
                ) {
                    Text("CONFIRM BOOKING")
                }
            }
        }
    }
}
