package com.fleetpro.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun LoginScreen(onLoginSuccess: () -> Unit) {
    var phone by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.surface)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Header
        Text(
            text = "FleetPro Business",
            style = MaterialTheme.typography.h4,
            modifier = Modifier.padding(bottom = 32.dp)
        )

        // Phone input
        TextField(
            value = phone,
            onValueChange = { phone = it },
            label = { Text("Phone Number") },
            placeholder = { Text("Enter 10-digit number") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            enabled = !isLoading,
            singleLine = true
        )

        // PIN input
        TextField(
            value = pin,
            onValueChange = { pin = it },
            label = { Text("PIN") },
            placeholder = { Text("Enter 4-digit PIN") },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp),
            visualTransformation = PasswordVisualTransformation(),
            enabled = !isLoading,
            singleLine = true
        )

        // Error message
        if (errorMessage.isNotEmpty()) {
            Text(
                text = errorMessage,
                color = MaterialTheme.colors.error,
                style = MaterialTheme.typography.body2,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }

        // Login button
        Button(
            onClick = {
                if (phone.isEmpty() || pin.isEmpty()) {
                    errorMessage = "Please enter phone and PIN"
                    return@Button
                }
                isLoading = true
                // TODO: Call authentication API
                // For now, simulate successful login after 2 seconds
                Thread {
                    Thread.sleep(2000)
                    onLoginSuccess()
                }.start()
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            enabled = !isLoading
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = MaterialTheme.colors.surface,
                    modifier = Modifier.size(24.dp)
                )
            } else {
                Text("LOGIN")
            }
        }
    }
}
