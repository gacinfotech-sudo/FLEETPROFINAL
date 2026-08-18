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
fun HomeScreen(
    onNavigateToBooking: () -> Unit,
    onNavigateToBookings: () -> Unit,
    onNavigateToAssignments: () -> Unit,
    onNavigateToProfile: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colors.background)
    ) {
        // Header
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colors.primary)
                .padding(16.dp)
        ) {
            Text(
                text = "Welcome, Manager",
                style = MaterialTheme.typography.h5,
                color = MaterialTheme.colors.surface,
                modifier = Modifier.align(Alignment.CenterStart)
            )
        }

        // Content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Stats row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatCard(
                    title = "Active",
                    value = "12",
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    title = "Pending",
                    value = "5",
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    title = "Completed",
                    value = "47",
                    modifier = Modifier.weight(1f)
                )
            }

            // Quick booking button (PROMINENT)
            Button(
                onClick = onNavigateToBooking,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .padding(bottom = 24.dp),
                colors = ButtonDefaults.buttonColors(
                    backgroundColor = MaterialTheme.colors.secondary
                ),
                shape = MaterialTheme.shapes.large
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "+ QUICK BOOKING",
                        style = MaterialTheme.typography.h6,
                        color = MaterialTheme.colors.surface
                    )
                    Text(
                        text = "Create new booking in 1-2 minutes",
                        style = MaterialTheme.typography.caption,
                        color = MaterialTheme.colors.surface
                    )
                }
            }

            // Menu buttons
            MenuButton(
                title = "Active Bookings",
                subtitle = "View today's bookings",
                onClick = onNavigateToBookings,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            MenuButton(
                title = "Driver Assignments",
                subtitle = "Manage driver duties",
                onClick = onNavigateToAssignments,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            MenuButton(
                title = "Profile & Settings",
                subtitle = "Your account",
                onClick = onNavigateToProfile
            )
        }
    }
}

@Composable
fun StatCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = MaterialTheme.shapes.medium,
        elevation = 4.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.h5
            )
            Text(
                text = title,
                style = MaterialTheme.typography.caption
            )
        }
    }
}

@Composable
fun MenuButton(
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        elevation = 2.dp
    ) {
        Button(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp),
            colors = ButtonDefaults.buttonColors(
                backgroundColor = MaterialTheme.colors.surface
            )
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.Start,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.subtitle1
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.caption
                )
            }
        }
    }
}
