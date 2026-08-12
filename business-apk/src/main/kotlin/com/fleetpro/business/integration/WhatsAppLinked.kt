package com.fleetpro.business.integration

import android.content.Context
import android.util.Log
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import com.fleetpro.business.data.api.ApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class WhatsAppLinkedSession(
    val sessionId: String,
    val qrCode: String,
    val status: String, // PENDING, LINKED, EXPIRED
    val createdAt: Long,
    val expiresAt: Long,
    val linkedPhone: String? = null,
)

data class LinkedConversation(
    val conversationId: String,
    val phoneNumber: String,
    val lastMessage: String? = null,
    val lastMessageTime: Long? = null,
    val unreadCount: Int = 0,
    val linkedAt: Long,
)

@Singleton
class WhatsAppLinked @Inject constructor(
    @ApplicationContext private val context: Context,
    private val apiService: ApiService,
) {

    private val TAG = "WhatsAppLinked"

    private val _sessions = MutableSharedFlow<WhatsAppLinkedSession>(replay = 1)
    val sessions: SharedFlow<WhatsAppLinkedSession> = _sessions

    private val _conversations = MutableSharedFlow<List<LinkedConversation>>(replay = 1)
    val conversations: SharedFlow<List<LinkedConversation>> = _conversations

    private val _messages = MutableSharedFlow<Map<String, Any>>(replay = 1)
    val messages: SharedFlow<Map<String, Any>> = _messages

    /**
     * Generate QR code for account linking
     */
    suspend fun generateQRCode(): WhatsAppLinkedSession {
        return try {
            val response = apiService.generateWhatsAppQR()
            if (response.isSuccessful) {
                val body = response.body() ?: throw Exception("Empty response")
                val data = body["data"] as? Map<String, Any> ?: throw Exception("No data")

                val session = WhatsAppLinkedSession(
                    sessionId = data["sessionId"] as? String ?: "",
                    qrCode = data["qrCode"] as? String ?: "",
                    status = "PENDING",
                    createdAt = System.currentTimeMillis(),
                    expiresAt = System.currentTimeMillis() + (60 * 1000), // 60 second expiry
                    linkedPhone = null
                )

                _sessions.emit(session)
                Log.d(TAG, "QR code generated: ${session.sessionId}")
                session
            } else {
                throw Exception("Failed to generate QR: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "QR generation failed: ${e.message}")
            throw e
        }
    }

    /**
     * Check if QR code is scanned and linked
     */
    suspend fun checkQRStatus(sessionId: String): WhatsAppLinkedSession {
        return try {
            val response = apiService.checkWhatsAppQRStatus(sessionId)
            if (response.isSuccessful) {
                val body = response.body() ?: throw Exception("Empty response")
                val data = body["data"] as? Map<String, Any> ?: throw Exception("No data")

                val session = WhatsAppLinkedSession(
                    sessionId = sessionId,
                    qrCode = data["qrCode"] as? String ?: "",
                    status = data["status"] as? String ?: "PENDING",
                    createdAt = (data["createdAt"] as? Number)?.toLong() ?: System.currentTimeMillis(),
                    expiresAt = (data["expiresAt"] as? Number)?.toLong() ?: 0L,
                    linkedPhone = data["linkedPhone"] as? String
                )

                _sessions.emit(session)
                Log.d(TAG, "QR status checked: ${session.status}")
                session
            } else {
                throw Exception("Failed to check QR status: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "QR status check failed: ${e.message}")
            throw e
        }
    }

    /**
     * Fetch linked conversations
     */
    suspend fun fetchConversations(): List<LinkedConversation> {
        return try {
            val response = apiService.getWhatsAppConversations()
            if (response.isSuccessful) {
                val body = response.body() ?: throw Exception("Empty response")
                val data = body["data"] as? List<Map<String, Any>> ?: emptyList()

                val conversations = data.map { conv ->
                    LinkedConversation(
                        conversationId = conv["conversationId"] as? String ?: "",
                        phoneNumber = conv["phoneNumber"] as? String ?: "",
                        lastMessage = conv["lastMessage"] as? String,
                        lastMessageTime = (conv["lastMessageTime"] as? Number)?.toLong(),
                        unreadCount = (conv["unreadCount"] as? Number)?.toInt() ?: 0,
                        linkedAt = (conv["linkedAt"] as? Number)?.toLong() ?: System.currentTimeMillis()
                    )
                }

                _conversations.emit(conversations)
                Log.d(TAG, "Fetched ${conversations.size} conversations")
                conversations
            } else {
                throw Exception("Failed to fetch conversations: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Conversation fetch failed: ${e.message}")
            throw e
        }
    }

    /**
     * Send message via linked WhatsApp
     * One-to-one messaging only (no broadcast)
     */
    suspend fun sendMessage(
        phoneNumber: String,
        message: String,
        conversationId: String,
    ): Boolean {
        return try {
            val response = apiService.sendWhatsAppLinkedMessage(
                mapOf(
                    "phoneNumber" to phoneNumber,
                    "message" to message,
                    "conversationId" to conversationId,
                    "idempotencyKey" to "${conversationId}_${System.currentTimeMillis()}"
                )
            )

            if (response.isSuccessful) {
                Log.d(TAG, "Message sent to $phoneNumber")
                true
            } else {
                Log.e(TAG, "Failed to send message: ${response.code()}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Send message failed: ${e.message}")
            false
        }
    }

    /**
     * Fetch messages for conversation
     */
    suspend fun fetchMessages(conversationId: String): List<Map<String, Any>> {
        return try {
            val response = apiService.getWhatsAppMessages(conversationId)
            if (response.isSuccessful) {
                val body = response.body() ?: throw Exception("Empty response")
                val messages = body["data"] as? List<Map<String, Any>> ?: emptyList()

                _messages.emit(mapOf("conversationId" to conversationId, "messages" to messages))
                Log.d(TAG, "Fetched ${messages.size} messages")
                messages
            } else {
                throw Exception("Failed to fetch messages: ${response.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Fetch messages failed: ${e.message}")
            throw e
        }
    }

    /**
     * Unlink WhatsApp account
     */
    suspend fun unlinkAccount(): Boolean {
        return try {
            val response = apiService.unlinkWhatsAppAccount()
            if (response.isSuccessful) {
                Log.d(TAG, "Account unlinked")
                true
            } else {
                Log.e(TAG, "Failed to unlink: ${response.code()}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Unlink failed: ${e.message}")
            false
        }
    }

    /**
     * Get account status
     */
    suspend fun getStatus(): Map<String, Any>? {
        return try {
            val response = apiService.getWhatsAppStatus()
            if (response.isSuccessful) {
                val body = response.body() ?: throw Exception("Empty response")
                body["data"] as? Map<String, Any>
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Status check failed: ${e.message}")
            null
        }
    }
}
