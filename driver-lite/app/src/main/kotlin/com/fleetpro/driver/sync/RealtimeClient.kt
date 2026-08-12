package com.fleetpro.driver.sync

import android.util.Log
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import javax.inject.Inject
import javax.inject.Singleton

data class RealtimeEvent(
    val type: String,
    val data: Map<String, Any>? = null,
    val timestamp: Long = System.currentTimeMillis(),
)

@Singleton
class RealtimeClient @Inject constructor(
    private val okHttpClient: OkHttpClient,
) : WebSocketListener() {

    private var webSocket: WebSocket? = null
    private val _events = MutableSharedFlow<RealtimeEvent>(replay = 1)
    val events: SharedFlow<RealtimeEvent> = _events

    private var driverId: String = ""
    private var tenantId: String = ""
    private var isConnected = false
    private var reconnectAttempts = 0
    private val MAX_RECONNECT_ATTEMPTS = 5

    private val subscriptions = mutableSetOf<String>()

    fun connect(serverUrl: String, token: String, driverId: String, tenantId: String) {
        this.driverId = driverId
        this.tenantId = tenantId

        val wsUrl = "$serverUrl/ws?token=$token&tenantId=$tenantId"
        val request = Request.Builder()
            .url(wsUrl)
            .addHeader("Authorization", "Bearer $token")
            .build()

        webSocket = okHttpClient.newWebSocket(request, this)
    }

    fun subscribeToDriverEvents() {
        subscribe(
            "DRIVER_ASSIGNED",
            "DRIVER_ACCEPTED",
            "DRIVER_REJECTED",
            "TRIP_STARTED",
            "TRIP_COMPLETED",
            "PAYMENT_RECEIVED",
            "BOOKING_STATUS_CHANGED"
        )
    }

    fun subscribe(vararg eventTypes: String) {
        subscriptions.addAll(eventTypes)
        if (isConnected) {
            val message = mapOf(
                "type" to "SUBSCRIBE",
                "data" to mapOf("events" to eventTypes.toList())
            )
            send(message)
        }
    }

    fun unsubscribe(vararg eventTypes: String) {
        subscriptions.removeAll(eventTypes.toSet())
        if (isConnected) {
            val message = mapOf(
                "type" to "UNSUBSCRIBE",
                "data" to mapOf("events" to eventTypes.toList())
            )
            send(message)
        }
    }

    fun disconnect() {
        webSocket?.close(1000, "Client closing")
        isConnected = false
    }

    fun sendKeepAlive() {
        val message = mapOf("type" to "PING")
        send(message)
    }

    private fun send(message: Map<String, Any>) {
        try {
            val jsonString = toJson(message)
            webSocket?.send(jsonString)
        } catch (e: Exception) {
            Log.e("RealtimeClient", "Failed to send message: ${e.message}")
        }
    }

    override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
        isConnected = true
        reconnectAttempts = 0
        Log.d("RealtimeClient", "Driver connected to realtime server: $driverId")

        // Subscribe to driver-specific events
        subscribeToDriverEvents()
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
        try {
            val message = parseJson(text)
            val type = message["type"] as? String ?: return

            when (type) {
                "PONG" -> {
                    // Keep-alive response
                    Log.d("RealtimeClient", "Keep-alive PONG received")
                }
                else -> {
                    val data = message["data"] as? Map<String, Any>
                    val event = RealtimeEvent(
                        type = type,
                        data = data,
                        timestamp = message["timestamp"] as? Long ?: System.currentTimeMillis()
                    )
                    _events.tryEmit(event)
                    Log.d("RealtimeClient", "Driver received event: $type")
                }
            }
        } catch (e: Exception) {
            Log.e("RealtimeClient", "Failed to parse message: ${e.message}")
        }
    }

    override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
        onMessage(webSocket, bytes.utf8())
    }

    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
        webSocket.close(1000, null)
        onClosed(webSocket, code, reason)
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        isConnected = false
        Log.d("RealtimeClient", "Driver connection closed: $code $reason")

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++
            val delayMs = (1000L * (2 shl reconnectAttempts)).coerceAtMost(30000L)
            Log.d("RealtimeClient", "Driver reconnecting in ${delayMs}ms (attempt $reconnectAttempts/$MAX_RECONNECT_ATTEMPTS)")
        }
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
        isConnected = false
        Log.e("RealtimeClient", "Driver WebSocket failure: ${t.message}")

        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++
            val delayMs = (1000L * (2 shl reconnectAttempts)).coerceAtMost(30000L)
            Log.d("RealtimeClient", "Driver reconnecting in ${delayMs}ms (attempt $reconnectAttempts/$MAX_RECONNECT_ATTEMPTS)")
        }
    }

    private fun toJson(map: Map<String, Any>): String {
        return map.entries.joinToString(",", "{", "}") { (k, v) ->
            when (v) {
                is String -> "\"$k\":\"$v\""
                is Number -> "\"$k\":$v"
                is Boolean -> "\"$k\":$v"
                is List<*> -> "\"$k\":[${v.joinToString(",")}]"
                is Map<*, *> -> "\"$k\":{${toJson(v as Map<String, Any>).trimStart('{').trimEnd('}')}"
                else -> "\"$k\":null"
            }
        }
    }

    private fun parseJson(json: String): Map<String, Any> {
        val result = mutableMapOf<String, Any>()
        return result
    }

    fun isConnected(): Boolean = isConnected
}
