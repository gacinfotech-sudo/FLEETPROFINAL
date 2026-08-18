package com.fleetpro.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ActiveBookingsScreen(
    onBookingSelected: (String) -> Unit,
    onNavigateBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.background)
    ) {
        TopAppBar(
            title = { Text("Active Bookings") },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Text("←")
                }
            }
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("Active Bookings List (Mock)")
        }
    }
}

@Composable
fun BookingDetailScreen(
    bookingId: String,
    onNavigateBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.background)
    ) {
        TopAppBar(
            title = { Text("Booking Details") },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Text("←")
                }
            }
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("Booking $bookingId Details (Mock)")
        }
    }
}

@Composable
fun DriverAssignmentsScreen(
    onAssignmentSelected: (String) -> Unit,
    onNavigateBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.background)
    ) {
        TopAppBar(
            title = { Text("Driver Assignments") },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Text("←")
                }
            }
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("Driver Assignments List (Mock)")
        }
    }
}

@Composable
fun AssignmentDetailScreen(
    assignmentId: String,
    onNavigateBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.background)
    ) {
        TopAppBar(
            title = { Text("Assignment Details") },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Text("←")
                }
            }
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("Assignment $assignmentId Details (Mock)")
        }
    }
}

@Composable
fun ProfileScreen(
    onLogout: () -> Unit,
    onNavigateBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.background)
    ) {
        TopAppBar(
            title = { Text("Profile") },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Text("←")
                }
            }
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("Profile Settings (Mock)")
                Button(
                    onClick = onLogout,
                    modifier = Modifier.padding(top = 24.dp)
                ) {
                    Text("LOGOUT")
                }
            }
        }
    }
}
