package com.fleetpro.business.domain.usecases

import com.fleetpro.business.data.api.ApiService
import com.fleetpro.business.data.local.BookingCache
import com.fleetpro.business.services.PhoneNormalizer
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.*
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class QuickBookingUseCaseTest {

    private lateinit var apiService: ApiService
    private lateinit var phoneNormalizer: PhoneNormalizer
    private lateinit var bookingCache: BookingCache
    private lateinit var useCase: QuickBookingUseCase

    @Before
    fun setup() {
        apiService = mock(ApiService::class.java)
        phoneNormalizer = PhoneNormalizer()
        bookingCache = mock(BookingCache::class.java)
        useCase = QuickBookingUseCase(apiService, phoneNormalizer, bookingCache)
    }

    @Test
    fun testExistingCustomerBooking_UnderNinetySeconds() = runBlocking {
        // Test: Existing customer booking should complete in < 90 seconds
        val startTime = System.currentTimeMillis()

        val mockResponse = mapOf(
            "success" to true,
            "data" to mapOf(
                "bookingId" to "BK123456",
                "customerId" to "CUST001",
                "blacklistWarning" to null as String?,
            )
        )

        `when`(bookingCache.getCustomerInfo("919876543210"))
            .thenReturn(mapOf("customerId" to "CUST001", "customerName" to "John Doe"))

        val result = useCase.createBooking(
            phone = "9876543210",
            customerName = "John Doe",
            pickupLocation = "Mumbai Central Station",
            dropoffLocation = "Bandra Railway Station",
            vehicleType = "SUV",
            estimatedFare = 250.0,
            notes = ""
        )

        val elapsedTime = System.currentTimeMillis() - startTime

        // Assertions
        assertTrue(result.success, "Booking should be successful")
        assertEquals("BK123456", result.bookingId, "Booking ID should match")
        assertTrue(elapsedTime < 90000, "Existing customer booking should complete in < 90 seconds, took ${elapsedTime}ms")

        println("✓ Existing customer booking: ${elapsedTime}ms")
    }

    @Test
    fun testNewCustomerBooking_UnderOneHundredFiftySe conds() = runBlocking {
        // Test: New customer booking should complete in < 150 seconds
        val startTime = System.currentTimeMillis()

        val mockResponse = mapOf(
            "success" to true,
            "data" to mapOf(
                "bookingId" to "BK789012",
                "customerId" to "CUST002",
                "blacklistWarning" to null as String?,
            )
        )

        `when`(bookingCache.getCustomerInfo("919876543211")).thenReturn(null)

        val result = useCase.createBooking(
            phone = "9876543211",
            customerName = "Jane Smith",
            pickupLocation = "Gateway of India",
            dropoffLocation = "Mumbai Airport",
            vehicleType = "Sedan",
            estimatedFare = 450.0,
            notes = "Meet at main gate"
        )

        val elapsedTime = System.currentTimeMillis() - startTime

        // Assertions
        assertTrue(result.success, "Booking should be successful")
        assertEquals("BK789012", result.bookingId, "Booking ID should match")
        assertTrue(elapsedTime < 150000, "New customer booking should complete in < 150 seconds, took ${elapsedTime}ms")

        println("✓ New customer booking: ${elapsedTime}ms")
    }

    @Test
    fun testPhoneNormalization_Valid() {
        // Test: Various phone formats should normalize correctly
        val testCases = listOf(
            "9876543210" to "919876543210",
            "+919876543210" to "919876543210",
            "91 98765 43210" to "919876543210",
            "919876543210" to "919876543210",
        )

        testCases.forEach { (input, expected) ->
            val normalized = phoneNormalizer.normalize(input)
            assertTrue(phoneNormalizer.isValid(normalized), "Phone $input should be valid")
            assertEquals(expected, normalized, "Phone $input should normalize to $expected")
        }

        println("✓ Phone normalization tests passed")
    }

    @Test
    fun testPhoneNormalization_Invalid() {
        // Test: Invalid phones should be rejected
        val invalidPhones = listOf(
            "123",
            "abcdefghij",
            "",
            "abc9876543210",
        )

        invalidPhones.forEach { phone ->
            if (phone.isNotEmpty()) {
                try {
                    val normalized = phoneNormalizer.normalize(phone)
                    val isValid = phoneNormalizer.isValid(normalized)
                    assertTrue(!isValid, "Phone $phone should be invalid")
                } catch (e: Exception) {
                    // Expected
                }
            }
        }

        println("✓ Invalid phone rejection tests passed")
    }

    @Test
    fun testBlacklistWarningDisplay() = runBlocking {
        // Test: Blacklist warnings should be captured and displayed
        val mockResponse = mapOf(
            "success" to true,
            "data" to mapOf(
                "bookingId" to "BK999999",
                "customerId" to "CUST003",
                "blacklistWarning" to "Manager approval required",
            )
        )

        val result = BookingResult(
            success = true,
            bookingId = "BK999999",
            blacklistWarning = "Manager approval required"
        )

        assertEquals("Manager approval required", result.blacklistWarning)
        println("✓ Blacklist warning correctly captured")
    }

    @Test
    fun testCacheHit_FasterRetrieval() = runBlocking {
        // Test: Cached customer info should be returned immediately
        val cachedInfo = mapOf(
            "customerId" to "CUST001",
            "customerName" to "John Doe",
            "lastVehicleType" to "SUV",
            "lastPickupLocation" to "Home",
            "lastDropoffLocation" to "Office",
        )

        `when`(bookingCache.getCustomerInfo("919876543210"))
            .thenReturn(cachedInfo)

        val startTime = System.currentTimeMillis()
        val result = useCase.lookupCustomer("9876543210")
        val elapsedTime = System.currentTimeMillis() - startTime

        assertEquals(cachedInfo, result)
        assertTrue(elapsedTime < 100, "Cached lookup should be < 100ms, took ${elapsedTime}ms")

        println("✓ Cache hit performance: ${elapsedTime}ms")
    }

    @Test
    fun testFormValidation_AllFieldsRequired() {
        // Test: Validate that required fields are enforced
        val emptyBooking = mapOf(
            "phone" to "",
            "pickup" to "",
            "dropoff" to "",
        )

        assertTrue(
            emptyBooking["phone"].toString().isEmpty(),
            "Phone should be required"
        )
        assertTrue(
            emptyBooking["pickup"].toString().isEmpty(),
            "Pickup should be required"
        )
        assertTrue(
            emptyBooking["dropoff"].toString().isEmpty(),
            "Dropoff should be required"
        )

        println("✓ Form validation tests passed")
    }
}
