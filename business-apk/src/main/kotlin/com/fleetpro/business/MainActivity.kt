package com.fleetpro.business

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material.*
import androidx.compose.runtime.*
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.fleetpro.business.ui.screens.*
import com.fleetpro.business.ui.theme.FleetProBusinessTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            FleetProBusinessTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colors.background
                ) {
                    BusinessAppNavigation()
                }
            }
        }
    }
}

@Composable
fun BusinessAppNavigation() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = "login"
    ) {
        composable("login") {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate("home") {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }

        composable("home") {
            HomeScreen(
                onNavigateToBooking = { navController.navigate("quick_booking") },
                onNavigateToBookings = { navController.navigate("active_bookings") },
                onNavigateToAssignments = { navController.navigate("driver_assignments") },
                onNavigateToProfile = { navController.navigate("profile") }
            )
        }

        composable("quick_booking") {
            QuickBookingScreen(
                onBookingCreated = { navController.popBackStack() },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable("active_bookings") {
            ActiveBookingsScreen(
                onBookingSelected = { bookingId ->
                    navController.navigate("booking_detail/$bookingId")
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable("booking_detail/{bookingId}") { backStackEntry ->
            val bookingId = backStackEntry.arguments?.getString("bookingId") ?: ""
            BookingDetailScreen(
                bookingId = bookingId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable("driver_assignments") {
            DriverAssignmentsScreen(
                onAssignmentSelected = { assignmentId ->
                    navController.navigate("assignment_detail/$assignmentId")
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable("assignment_detail/{assignmentId}") { backStackEntry ->
            val assignmentId = backStackEntry.arguments?.getString("assignmentId") ?: ""
            AssignmentDetailScreen(
                assignmentId = assignmentId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable("profile") {
            ProfileScreen(
                onLogout = {
                    navController.navigate("login") {
                        popUpTo("home") { inclusive = true }
                    }
                },
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
